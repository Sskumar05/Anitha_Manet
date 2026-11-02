import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Target,
  Layers,
  Share2,
  Settings,
  BarChart3,
  Clock,
  Shuffle,
  Battery,
  Info,
  ArrowRight,
  Database,
  User,
  Zap,
} from 'lucide-react';
import {
  SimulationResult,
  BackendHealth,
  SimulationConfig,
  SimulationHistoryItem,
  SweepResult,
  SweepParameter,
} from '../types/simulation';
import { apiService } from '../services/api';

interface OverviewPageProps {
  latestResult: SimulationResult | null;
  isRunning?: boolean;
  isStarting?: boolean;
  activeRunId?: string | null;
  backendHealth?: BackendHealth | null;
  config?: SimulationConfig;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  latestResult,
  isRunning = false,
  isStarting = false,
  activeRunId = null,
  backendHealth = null,
  config,
}) => {
  const navigate = useNavigate();
  const [historyResult, setHistoryResult] = useState<SimulationResult | null>(null);
  const [todayRuns, setTodayRuns] = useState<SimulationHistoryItem[]>([]);
  const [isLoadingTodayRuns, setIsLoadingTodayRuns] = useState<boolean>(true);

  // Helper to determine if a run was created today in client's application timezone
  const isCreatedToday = (dateStr?: string) => {
    if (!dateStr) return false;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return false;
      const now = new Date();
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    } catch {
      return false;
    }
  };

  // Fetch simulation history and filter runs executed today
  const fetchTodayRuns = async () => {
    try {
      const history = await apiService.getSimulationHistory(100);
      if (Array.isArray(history)) {
        const filtered = history.filter((item) => isCreatedToday(item.created_at));
        setTodayRuns(filtered);
      }
    } catch (err) {
      console.error('Failed to load today simulation runs:', err);
    } finally {
      setIsLoadingTodayRuns(false);
    }
  };

  useEffect(() => {
    fetchTodayRuns();
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isRunning) {
      interval = setInterval(fetchTodayRuns, 4000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [latestResult, isRunning, activeRunId]);

  // Include currently active running simulation if initiated today and not already in history
  const allTodayRuns = [...todayRuns];
  if (isRunning && activeRunId && !allTodayRuns.some((r) => r.run_id === activeRunId)) {
    allTodayRuns.unshift({
      run_id: activeRunId,
      protocol: config?.protocol || 'eAODV',
      node_count: config?.node_count || 50,
      mobility_speed: config?.mobility_speed || 20,
      simulation_area: config?.simulation_area || 1000,
      status: 'running',
      created_at: new Date().toISOString(),
    });
  }

  // Load the latest completed simulation result from database if none in memory
  useEffect(() => {
    if (!latestResult) {
      apiService
        .getSimulationHistory(1)
        .then((history) => {
          if (history && history.length > 0) {
            return apiService.getSimulationResults(history[0].run_id);
          }
          return null;
        })
        .then((res) => {
          if (res) setHistoryResult(res);
        })
        .catch(() => {
          // Backend offline or no historical runs exist yet
        });
    }
  }, [latestResult]);

  const [latestSweep, setLatestSweep] = useState<SweepResult | null>(null);

  // Load latest completed parametric sweep comparison (AODV vs eAODV)
  useEffect(() => {
    let isMounted = true;
    const fetchLatestComparison = async () => {
      try {
        const params: SweepParameter[] = ['speed', 'nodes', 'traffic'];
        for (const p of params) {
          const res = await apiService.getLatestSweep(p);
          if (res && res.status === 'completed') {
            if (isMounted) setLatestSweep(res);
            break;
          }
        }
      } catch {
        // Backend may be offline or no sweep completed yet
      }
    };
    fetchLatestComparison();
    return () => {
      isMounted = false;
    };
  }, [isRunning, latestResult]);

  const activeResult = latestResult || historyResult;
  const isEngineReady = Boolean(backendHealth?.ns3_engine?.ns3_detected);

  const savedConfig = activeResult
    ? {
        node_count: activeResult.node_count,
        mobility_speed: activeResult.mobility_speed,
        simulation_area: activeResult.simulation_area,
        protocol: activeResult.protocol,
      }
    : config
    ? {
        node_count: config.node_count,
        mobility_speed: config.mobility_speed,
        simulation_area: config.simulation_area,
        protocol: config.protocol,
      }
    : null;

  const formatRunDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatRunDateTime = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return `${d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}, ${d.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col bg-white px-6 sm:px-8 lg:px-10 py-6 w-full space-y-6 text-[#13141F]">
      {/* =========================================================================
          A. DASHBOARD HEADER
         ========================================================================= */}
      <header className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="relative">
          <h1 className="text-xl sm:text-2xl font-bold text-[#13141F] tracking-tight">
            Research Dashboard
          </h1>
          <div className="w-10 h-1 bg-[#635BFF] rounded-full mt-1.5"></div>
        </div>

        {/* <div className="flex items-center">
          User Profile Display
          <div className="w-8 h-8 rounded-full bg-indigo-100 text-[#635BFF] border border-indigo-200 flex items-center justify-center font-bold text-xs shadow-2xs">
            <User className="w-4 h-4" />
          </div>
        </div> */}
      </header>

      {/* =========================================================================
          B. MAIN RESEARCH BANNER
         ========================================================================= */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#F4F2FF] via-[#EFEBFE] to-[#F3F0FE] border border-[#E3DEF8] p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[0_4px_20px_rgba(99,91,255,0.04)]">
        {/* Left Content */}
        <div className="z-10 max-w-xl space-y-3">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#13141F] leading-snug tracking-tight">
            Reliable and Energy-Aware Routing in Highly Dynamic MANETs
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-lg">
            Developing a reliable and energy-efficient routing mechanism for highly dynamic mobile ad-hoc networks.
          </p>

          <div className="pt-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border border-indigo-100/90 text-xs font-semibold text-[#635BFF] shadow-xs">
              <Zap className="w-3.5 h-3.5 text-[#635BFF]" />
              <span>MANET Research Project</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-600 font-medium">NS-3.41 Environment</span>
            </div>
          </div>
        </div>

        {/* Right Illustration: Wireless Transmission Tower & Mobile Ad-Hoc Nodes */}
        <div className="shrink-0 w-full md:w-[380px] lg:w-[440px] h-[180px] sm:h-[190px] relative flex items-center justify-center">
          <svg
            className="w-full h-full"
            viewBox="0 0 440 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Background constellation decorative particles */}
            <circle cx="60" cy="50" r="1.5" fill="#635BFF" fillOpacity="0.4" />
            <circle cx="110" cy="160" r="2" fill="#635BFF" fillOpacity="0.3" />
            <circle cx="370" cy="40" r="1.5" fill="#635BFF" fillOpacity="0.4" />
            <circle cx="410" cy="130" r="2" fill="#635BFF" fillOpacity="0.3" />

            {/* Wireless signal propagation waves emanating from Tower */}
            <path
              d="M 205 60 C 195 48, 195 32, 205 20"
              stroke="#635BFF"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeOpacity="0.7"
            />
            <path
              d="M 195 68 C 180 50, 180 30, 195 12"
              stroke="#635BFF"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeOpacity="0.5"
            />
            <path
              d="M 185 76 C 165 52, 165 28, 185 4"
              stroke="#635BFF"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeOpacity="0.3"
            />

            <path
              d="M 235 60 C 245 48, 245 32, 235 20"
              stroke="#635BFF"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeOpacity="0.7"
            />
            <path
              d="M 245 68 C 260 50, 260 30, 245 12"
              stroke="#635BFF"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeOpacity="0.5"
            />
            <path
              d="M 255 76 C 275 52, 275 28, 255 4"
              stroke="#635BFF"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeOpacity="0.3"
            />

            {/* Interconnecting dashed wireless links between nodes and tower */}
            <line x1="220" y1="80" x2="65" y2="150" stroke="#7C73FF" strokeWidth="1.2" strokeDasharray="4 4" strokeOpacity="0.5" />
            <line x1="220" y1="80" x2="110" y2="70" stroke="#7C73FF" strokeWidth="1.2" strokeDasharray="4 4" strokeOpacity="0.5" />
            <line x1="220" y1="80" x2="330" y2="60" stroke="#7C73FF" strokeWidth="1.2" strokeDasharray="4 4" strokeOpacity="0.5" />
            <line x1="220" y1="80" x2="380" y2="145" stroke="#7C73FF" strokeWidth="1.2" strokeDasharray="4 4" strokeOpacity="0.5" />
            <line x1="220" y1="80" x2="295" y2="165" stroke="#7C73FF" strokeWidth="1.2" strokeDasharray="4 4" strokeOpacity="0.5" />
            <line x1="65" y1="150" x2="110" y2="70" stroke="#7C73FF" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.3" />
            <line x1="330" y1="60" x2="380" y2="145" stroke="#7C73FF" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.3" />
            <line x1="295" y1="165" x2="380" y2="145" stroke="#7C73FF" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.3" />

            {/* Center Transmission Tower */}
            <g transform="translate(198, 28)">
              {/* Antenna Mast Top */}
              <circle cx="22" cy="12" r="3.5" fill="#4B3BE7" />
              <line x1="22" y1="15" x2="22" y2="45" stroke="#4B3BE7" strokeWidth="2.5" />
              <line x1="14" y1="35" x2="30" y2="35" stroke="#4B3BE7" strokeWidth="2" />

              {/* Lattice Tower Legs */}
              <line x1="22" y1="45" x2="6" y2="145" stroke="#4B3BE7" strokeWidth="2.5" />
              <line x1="22" y1="45" x2="38" y2="145" stroke="#4B3BE7" strokeWidth="2.5" />

              {/* Horizontal Struts */}
              <line x1="18" y1="65" x2="26" y2="65" stroke="#4B3BE7" strokeWidth="1.8" />
              <line x1="14" y1="90" x2="30" y2="90" stroke="#4B3BE7" strokeWidth="1.8" />
              <line x1="10" y1="115" x2="34" y2="115" stroke="#4B3BE7" strokeWidth="2" />
              <line x1="6" y1="145" x2="38" y2="145" stroke="#4B3BE7" strokeWidth="2.5" />

              {/* Diagonal Cross-bracing */}
              <line x1="18" y1="65" x2="30" y2="90" stroke="#4B3BE7" strokeWidth="1.2" />
              <line x1="26" y1="65" x2="14" y2="90" stroke="#4B3BE7" strokeWidth="1.2" />
              <line x1="14" y1="90" x2="34" y2="115" stroke="#4B3BE7" strokeWidth="1.2" />
              <line x1="30" y1="90" x2="10" y2="115" stroke="#4B3BE7" strokeWidth="1.2" />
              <line x1="10" y1="115" x2="38" y2="145" stroke="#4B3BE7" strokeWidth="1.5" />
              <line x1="34" y1="115" x2="6" y2="145" stroke="#4B3BE7" strokeWidth="1.5" />
            </g>

            {/* Laptop Node 1: Left Bottom */}
            <g transform="translate(48, 138)">
              <rect x="5" y="4" width="26" height="17" rx="2" fill="#2E384D" />
              <rect x="7" y="6" width="22" height="13" rx="1" fill="#7C73FF" fillOpacity="0.4" />
              <path d="M 0 22 L 36 22 L 33 25 L 3 25 Z" fill="#2E384D" />
            </g>

            {/* Laptop Node 2: Left Upper */}
            <g transform="translate(95, 58)">
              <rect x="5" y="4" width="26" height="17" rx="2" fill="#2E384D" />
              <rect x="7" y="6" width="22" height="13" rx="1" fill="#7C73FF" fillOpacity="0.4" />
              <path d="M 0 22 L 36 22 L 33 25 L 3 25 Z" fill="#2E384D" />
            </g>

            {/* Laptop Node 3: Right Upper */}
            <g transform="translate(315, 48)">
              <rect x="5" y="4" width="26" height="17" rx="2" fill="#2E384D" />
              <rect x="7" y="6" width="22" height="13" rx="1" fill="#7C73FF" fillOpacity="0.4" />
              <path d="M 0 22 L 36 22 L 33 25 L 3 25 Z" fill="#2E384D" />
            </g>

            {/* Laptop Node 4: Right Mid */}
            <g transform="translate(365, 132)">
              <rect x="5" y="4" width="26" height="17" rx="2" fill="#2E384D" />
              <rect x="7" y="6" width="22" height="13" rx="1" fill="#7C73FF" fillOpacity="0.4" />
              <path d="M 0 22 L 36 22 L 33 25 L 3 25 Z" fill="#2E384D" />
            </g>

            {/* Laptop Node 5: Right Lower Center */}
            <g transform="translate(280, 155)">
              <rect x="5" y="4" width="26" height="17" rx="2" fill="#2E384D" />
              <rect x="7" y="6" width="22" height="13" rx="1" fill="#7C73FF" fillOpacity="0.4" />
              <path d="M 0 22 L 36 22 L 33 25 L 3 25 Z" fill="#2E384D" />
            </g>
          </svg>
        </div>
      </section>

      {/* =========================================================================
          KEY PERFORMANCE METRICS (Directly Below Research Banner)
         ========================================================================= */}
      {/* <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        Metric 1: Packet Delivery Ratio (PDR)
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex items-center gap-4 transition-all hover:border-indigo-100">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-[#635BFF] flex items-center justify-center shrink-0">
            <BarChart3 className="w-6 h-6 text-[#635BFF]" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs text-slate-500 font-medium block truncate">
              Packet Delivery Ratio (PDR)
            </span>
            <div className="text-xl sm:text-2xl font-extrabold text-[#13141F] tracking-tight mt-0.5">
              {activeResult
                ? activeResult.pdr !== null && activeResult.pdr !== undefined
                  ? `${activeResult.pdr.toFixed(1)}%`
                  : 'N/A'
                : '—'}
            </div>
          </div>
        </div>

        Metric 2: Average End-to-End Delay
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex items-center gap-4 transition-all hover:border-indigo-100">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-[#635BFF] flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6 text-[#635BFF]" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs text-slate-500 font-medium block truncate">
              Average End-to-End Delay
            </span>
            <div className="text-xl sm:text-2xl font-extrabold text-[#13141F] tracking-tight mt-0.5">
              {activeResult
                ? activeResult.delay_ms !== null && activeResult.delay_ms !== undefined
                  ? `${activeResult.delay_ms.toFixed(1)} ms`
                  : 'N/A'
                : '—'}
            </div>
          </div>
        </div>

        Metric 3: Normalized Routing Load (NRL)
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex items-center gap-4 transition-all hover:border-indigo-100">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-[#635BFF] flex items-center justify-center shrink-0">
            <Shuffle className="w-6 h-6 text-[#635BFF]" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs text-slate-500 font-medium block truncate">
              Normalized Routing Load (NRL)
            </span>
            <div className="text-xl sm:text-2xl font-extrabold text-[#13141F] tracking-tight mt-0.5">
              {activeResult
                ? activeResult.overhead_ratio !== null && activeResult.overhead_ratio !== undefined
                  ? activeResult.overhead_ratio.toFixed(2)
                  : 'N/A'
                : '—'}
            </div>
          </div>
        </div>

        Metric 4: Energy Consumption
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex items-center gap-4 transition-all hover:border-indigo-100">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-[#635BFF] flex items-center justify-center shrink-0">
            <Battery className="w-6 h-6 text-[#635BFF]" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs text-slate-500 font-medium block truncate">
              Energy Consumption
            </span>
            <div className="text-xl sm:text-2xl font-extrabold text-[#13141F] tracking-tight mt-0.5">
              {activeResult
                ? activeResult.energy_consumed_j !== null && activeResult.energy_consumed_j !== undefined
                  ? `${activeResult.energy_consumed_j.toFixed(1)} J`
                  : 'N/A'
                : '—'}
            </div>
          </div>
        </div>
      </section> */}

      {/* =========================================================================
          C. RESEARCH PROGRESS TIMELINE
         ========================================================================= */}
      <section className="py-3.5 border-b border-slate-100">
        <div className="relative">
          {/* Horizontal connecting line on desktop */}
          <div className="hidden lg:block absolute top-5 left-[12.5%] right-[12.5%] h-[2px] bg-[#E0DBFD]" />

          {/* Vertical connecting line on mobile */}
          <div className="block sm:hidden absolute top-5 bottom-5 left-5 w-[2px] bg-[#E0DBFD]" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4 relative z-10">
            {/* Step 1: Research Objectives */}
            <div className="flex lg:flex-col items-center text-left lg:text-center gap-3.5 lg:gap-2.5 group">
              <div className="w-10 h-10 rounded-full bg-purple-50 text-[#635BFF] border-2 border-white ring-4 ring-purple-100/70 flex items-center justify-center shrink-0 shadow-2xs transition-transform group-hover:scale-105">
                <Target className="w-5 h-5 text-[#635BFF]" />
              </div>
              <div className="flex-1 lg:flex-initial">
                <span className="text-xs text-slate-500 font-medium block">Research Objectives</span>
                <span className="text-sm font-bold text-[#13141F] mt-0.5 block">4 Key Goals</span>
              </div>
            </div>

            {/* Step 2: Research Stages */}
            <div className="flex lg:flex-col items-center text-left lg:text-center gap-3.5 lg:gap-2.5 group">
              <div className="w-10 h-10 rounded-full bg-purple-50 text-[#635BFF] border-2 border-white ring-4 ring-purple-100/70 flex items-center justify-center shrink-0 shadow-2xs transition-transform group-hover:scale-105">
                <Layers className="w-5 h-5 text-[#635BFF]" />
              </div>
              <div className="flex-1 lg:flex-initial">
                <span className="text-xs text-slate-500 font-medium block">Research Stages</span>
                <span className="text-sm font-bold text-[#13141F] mt-0.5 block">4 Phases</span>
              </div>
            </div>

            {/* Step 3: Routing Protocols */}
            <div className="flex lg:flex-col items-center text-left lg:text-center gap-3.5 lg:gap-2.5 group">
              <div className="w-10 h-10 rounded-full bg-purple-50 text-[#635BFF] border-2 border-white ring-4 ring-purple-100/70 flex items-center justify-center shrink-0 shadow-2xs transition-transform group-hover:scale-105">
                <Share2 className="w-5 h-5 text-[#635BFF]" />
              </div>
              <div className="flex-1 lg:flex-initial">
                <span className="text-xs text-slate-500 font-medium block">Routing Protocols</span>
                <span className="text-sm font-bold text-[#13141F] mt-0.5 block">AODV / eAODV</span>
              </div>
            </div>

            {/* Step 4: Simulation Platform */}
            <div className="flex lg:flex-col items-center text-left lg:text-center gap-3.5 lg:gap-2.5 group">
              <div className="w-10 h-10 rounded-full bg-purple-50 text-[#635BFF] border-2 border-white ring-4 ring-purple-100/70 flex items-center justify-center shrink-0 shadow-2xs transition-transform group-hover:scale-105">
                <Settings className="w-5 h-5 text-[#635BFF]" />
              </div>
              <div className="flex-1 lg:flex-initial">
                <span className="text-xs text-slate-500 font-medium block">Simulation Platform</span>
                <span className="text-sm font-bold text-[#13141F] mt-0.5 block">NS-3</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          MIDDLE ROW: D. RESEARCH FOCUS (Left) & E. PERFORMANCE SUMMARY (Right)
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* D. RESEARCH FOCUS SECTION (Left Column, ~7 cols) */}
        <section className="lg:col-span-7 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-[#635BFF]" />
            <h2 className="text-base font-bold text-[#13141F]">Research Focus</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
            {/* MANET Network Perspective Mesh Illustration (Left sub-col) */}
            <div className="sm:col-span-6 w-full h-[180px] rounded-2xl overflow-hidden relative shadow-xs border border-slate-200">
              <svg
                className="w-full h-full"
                viewBox="0 0 300 180"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="citySky" x1="0" y1="0" x2="0" y2="180" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#2563EB" />
                    <stop offset="50%" stopColor="#38BDF8" />
                    <stop offset="100%" stopColor="#1E3A8A" />
                  </linearGradient>
                  <radialGradient id="centerGlow" cx="150" cy="90" r="70" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="#38BDF8" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* Sky and City Perspective Grid Background */}
                <rect width="300" height="180" fill="url(#citySky)" />

                {/* Silhouette buildings in background */}
                <path
                  d="M 10 180 L 10 120 L 35 120 L 35 95 L 60 95 L 60 180 Z"
                  fill="#1E293B"
                  fillOpacity="0.35"
                />
                <path
                  d="M 70 180 L 70 80 L 100 80 L 100 180 Z"
                  fill="#1E293B"
                  fillOpacity="0.4"
                />
                <path
                  d="M 195 180 L 195 70 L 225 70 L 225 180 Z"
                  fill="#1E293B"
                  fillOpacity="0.35"
                />
                <path
                  d="M 235 180 L 235 105 L 260 105 L 260 90 L 285 90 L 285 180 Z"
                  fill="#1E293B"
                  fillOpacity="0.4"
                />

                {/* Perspective wireless mesh lines */}
                <line x1="40" y1="160" x2="260" y2="160" stroke="#FFFFFF" strokeOpacity="0.2" strokeWidth="1" />
                <line x1="70" y1="130" x2="230" y2="130" stroke="#FFFFFF" strokeOpacity="0.2" strokeWidth="1" />
                <line x1="100" y1="105" x2="200" y2="105" stroke="#FFFFFF" strokeOpacity="0.2" strokeWidth="1" />

                {/* Radial glow around center Wi-Fi */}
                <circle cx="150" cy="100" r="60" fill="url(#centerGlow)" />

                {/* Glowing Wireless Mesh Interconnect Lines */}
                <line x1="60" y1="55" x2="150" y2="95" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="3 3" />
                <line x1="150" y1="35" x2="150" y2="95" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="3 3" />
                <line x1="240" y1="55" x2="150" y2="95" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="3 3" />
                <line x1="50" y1="135" x2="150" y2="95" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="3 3" />
                <line x1="250" y1="135" x2="150" y2="95" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="3 3" />
                <line x1="150" y1="155" x2="150" y2="95" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="3 3" />
                <line x1="60" y1="55" x2="150" y2="35" stroke="#38BDF8" strokeWidth="1.2" strokeOpacity="0.8" />
                <line x1="150" y1="35" x2="240" y2="55" stroke="#38BDF8" strokeWidth="1.2" strokeOpacity="0.8" />
                <line x1="240" y1="55" x2="250" y2="135" stroke="#38BDF8" strokeWidth="1.2" strokeOpacity="0.8" />
                <line x1="250" y1="135" x2="150" y2="155" stroke="#38BDF8" strokeWidth="1.2" strokeOpacity="0.8" />
                <line x1="150" y1="155" x2="50" y2="135" stroke="#38BDF8" strokeWidth="1.2" strokeOpacity="0.8" />
                <line x1="50" y1="135" x2="60" y2="55" stroke="#38BDF8" strokeWidth="1.2" strokeOpacity="0.8" />

                {/* Central Wi-Fi Wave Symbol */}
                <g transform="translate(136, 88)">
                  <path d="M 4 8 C 8 4, 20 4, 24 8" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M 8 13 C 11 10, 17 10, 20 13" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
                  <circle cx="14" cy="18" r="2.2" fill="#FFFFFF" />
                </g>

                {/* Distributed Mesh Laptop Nodes */}
                {/* Node Top Left */}
                <g transform="translate(48, 43)">
                  <rect x="3" y="2" width="18" height="12" rx="1.5" fill="#1E293B" />
                  <rect x="5" y="4" width="14" height="8" rx="0.8" fill="#38BDF8" />
                  <path d="M 0 14 L 24 14 L 22 17 L 2 17 Z" fill="#CBD5E1" />
                </g>

                {/* Node Top Center */}
                <g transform="translate(138, 23)">
                  <rect x="3" y="2" width="18" height="12" rx="1.5" fill="#1E293B" />
                  <rect x="5" y="4" width="14" height="8" rx="0.8" fill="#38BDF8" />
                  <path d="M 0 14 L 24 14 L 22 17 L 2 17 Z" fill="#CBD5E1" />
                </g>

                {/* Node Top Right */}
                <g transform="translate(228, 43)">
                  <rect x="3" y="2" width="18" height="12" rx="1.5" fill="#1E293B" />
                  <rect x="5" y="4" width="14" height="8" rx="0.8" fill="#38BDF8" />
                  <path d="M 0 14 L 24 14 L 22 17 L 2 17 Z" fill="#CBD5E1" />
                </g>

                {/* Node Bottom Left */}
                <g transform="translate(38, 123)">
                  <rect x="3" y="2" width="18" height="12" rx="1.5" fill="#1E293B" />
                  <rect x="5" y="4" width="14" height="8" rx="0.8" fill="#38BDF8" />
                  <path d="M 0 14 L 24 14 L 22 17 L 2 17 Z" fill="#CBD5E1" />
                </g>

                {/* Node Bottom Right */}
                <g transform="translate(238, 123)">
                  <rect x="3" y="2" width="18" height="12" rx="1.5" fill="#1E293B" />
                  <rect x="5" y="4" width="14" height="8" rx="0.8" fill="#38BDF8" />
                  <path d="M 0 14 L 24 14 L 22 17 L 2 17 Z" fill="#CBD5E1" />
                </g>

                {/* Node Bottom Center */}
                <g transform="translate(138, 143)">
                  <rect x="3" y="2" width="18" height="12" rx="1.5" fill="#1E293B" />
                  <rect x="5" y="4" width="14" height="8" rx="0.8" fill="#38BDF8" />
                  <path d="M 0 14 L 24 14 L 22 17 L 2 17 Z" fill="#CBD5E1" />
                </g>
              </svg>
            </div>

            {/* Three Numbered Research Focus Areas (Right sub-col) */}
            <div className="sm:col-span-6 space-y-4">
              {/* Focus 1 */}
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#635BFF] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#13141F]">Routing Reliability</h3>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Maintain stable communication during topology changes.
                  </p>
                </div>
              </div>

              {/* Focus 2 */}
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#635BFF] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#13141F]">Energy Efficiency</h3>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Reduce unnecessary energy consumption.
                  </p>
                </div>
              </div>

              {/* Focus 3 */}
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#635BFF] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#13141F]">Network Performance</h3>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Improve PDR, delay and routing overhead.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* E. PERFORMANCE SUMMARY (Right Column, ~5 cols) */}
        <section className="lg:col-span-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-[#635BFF]" />
            <h2 className="text-base font-bold text-[#13141F]">Performance Summary</h2>
          </div>

          <div className="space-y-3 pt-1">
            {/* Metric Row 1: PDR */}
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5 text-xs font-medium text-slate-700">
                <BarChart3 className="w-4 h-4 text-[#635BFF]" />
                <span>Packet Delivery Ratio (PDR)</span>
              </div>
              <span className="text-sm font-extrabold text-[#13141F]">
                {activeResult ? `${activeResult.pdr.toFixed(1)}%` : '—'}
              </span>
            </div>

            {/* Metric Row 2: Delay */}
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5 text-xs font-medium text-slate-700">
                <Clock className="w-4 h-4 text-[#635BFF]" />
                <span>Average End-to-End Delay</span>
              </div>
              <span className="text-sm font-extrabold text-[#13141F]">
                {activeResult
                  ? activeResult.delay_ms !== null && activeResult.delay_ms !== undefined
                    ? `${activeResult.delay_ms.toFixed(1)} ms`
                    : 'N/A'
                  : '—'}
              </span>
            </div>

            {/* Metric Row 3: NRL */}
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5 text-xs font-medium text-slate-700">
                <Shuffle className="w-4 h-4 text-[#635BFF]" />
                <span>Routing Overhead (NRL)</span>
              </div>
              <span className="text-sm font-extrabold text-[#13141F]">
                {activeResult
                  ? activeResult.overhead_ratio !== null && activeResult.overhead_ratio !== undefined
                    ? activeResult.overhead_ratio.toFixed(2)
                    : 'N/A'
                  : '—'}
              </span>
            </div>

            {/* Metric Row 4: Energy */}
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5 text-xs font-medium text-slate-700">
                <Battery className="w-4 h-4 text-[#635BFF]" />
                <span>Energy Consumption</span>
              </div>
              <span className="text-sm font-extrabold text-[#13141F]">
                {activeResult ? `${activeResult.energy_consumed_j.toFixed(1)} J` : '—'}
              </span>
            </div>

            {/* Subtext info matching reference image */}
            {/* <div className="flex items-center gap-1.5 text-[11px] text-[#635BFF] pt-1">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>Results will appear after simulation execution.</span>
            </div> */}
          </div>
        </section>
      </div>

      {/* =========================================================================
          BOTTOM ROW: F. LATEST EXPERIMENT (Left) & G. RECENT ACTIVITY (Right)
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-2">
        {/* F. LATEST EXPERIMENT (Left Column, ~7 cols) */}
        <section className="lg:col-span-7 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-[#635BFF]" />
              <h2 className="text-base font-bold text-[#13141F]">Latest Experiment</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Today's Total Runs:</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#635BFF]/10 text-[#635BFF] border border-[#635BFF]/20">
                {isLoadingTodayRuns ? '...' : allTodayRuns.length}
              </span>
            </div>
          </div>

          <div className="border border-slate-200/90 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="max-h-[380px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200/90 shadow-sm">
                  <tr className="text-slate-600 font-semibold">
                    <th className="py-2.5 px-3.5">Run ID</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Node Count</th>
                    <th className="py-2.5 px-3">Protocol</th>
                    <th className="py-2.5 px-3">Execution Date</th>
                    <th className="py-2.5 px-3.5">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allTodayRuns.length > 0 ? (
                    allTodayRuns.map((run) => (
                      <tr key={run.run_id} className="hover:bg-slate-50/50 transition-colors">
                        <td
                          className="py-3 px-3.5 font-mono font-bold text-slate-800"
                          title={run.run_id}
                        >
                          #{run.run_id.length > 14 ? run.run_id.slice(0, 14) + '…' : run.run_id}
                        </td>
                        <td className="py-3 px-3">
                          {run.status === 'completed' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                              Completed
                            </span>
                          ) : run.status === 'failed' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200">
                              Failed
                            </span>
                          ) : run.status === 'running' ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                              Running
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200">
                              {run.status || 'In Progress'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-700">
                          {run.node_count} nodes
                        </td>
                        <td className="py-3 px-3 font-bold text-[#635BFF]">
                          {run.protocol}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {formatRunDateTime(run.created_at)}
                        </td>
                        <td className="py-3 px-3.5">
                          {run.status === 'completed' ? (
                            run.pdr != null ? (
                              <span className="font-bold text-slate-800">
                                {run.pdr.toFixed(1)}% PDR
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )
                          ) : run.status === 'failed' ? (
                            <span className="font-semibold text-rose-600">Failed</span>
                          ) : run.status === 'running' || run.status === 'queued' ? (
                            <span className="font-semibold text-blue-600 animate-pulse">Running...</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <>
                      <tr className="text-slate-400">
                        <td className="py-3 px-3.5 text-center font-bold">—</td>
                        <td className="py-3 px-3 text-center font-bold">—</td>
                        <td className="py-3 px-3 text-center font-bold">—</td>
                        <td className="py-3 px-3 text-center font-bold">—</td>
                        <td className="py-3 px-3 text-center font-bold">—</td>
                        <td className="py-3 px-3.5 text-center font-bold">—</td>
                      </tr>
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400 text-xs">
                          <div className="flex items-center justify-center gap-2 font-medium">
                            <Database className="w-4 h-4 text-purple-400" />
                            <span>
                              {isLoadingTodayRuns
                                ? 'Loading simulation records...'
                                : 'No simulation runs recorded today.'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* G. RECENT ACTIVITY (Right Column, ~5 cols) */}
        <section className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-[#635BFF]" />
              <h2 className="text-base font-bold text-[#13141F]">Recent Activity</h2>
            </div>
            <button
              onClick={() => navigate('/simulation')}
              className="text-xs font-semibold text-[#635BFF] hover:text-[#5046E5] flex items-center gap-1 transition-colors"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Minimal Vertical Timeline matching the reference image */}
          <div className="relative pl-6 space-y-6 pt-1 text-xs">
            {/* Connecting line between timeline dots */}
            <div className="absolute left-[7px] top-[10px] bottom-[10px] w-[1.5px] bg-slate-200" />

            {/* Event 1 */}
            <div className="relative">
              <div
                className="timeline-dot-anim absolute -left-[23px] top-[3px] w-2.5 h-2.5 rounded-full bg-[#635BFF] ring-4 ring-white"
                style={{ animationDelay: '0s' }}
              />
              <div>
                <h4 className="font-bold text-[#13141F]">
                  {activeResult ? `Simulation Executed (${activeResult.protocol})` : 'Project Dashboard Initialized'}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeResult
                    ? `Run ID #${activeResult.run_id.slice(0, 8)} • ${activeResult.node_count} Nodes`
                    : 'Research environment ready'}
                </p>
              </div>
            </div>

            {/* Event 2 */}
            <div className="relative">
              <div
                className="timeline-dot-anim absolute -left-[23px] top-[3px] w-2.5 h-2.5 rounded-full bg-[#635BFF] ring-4 ring-white"
                style={{ animationDelay: '0.2s' }}
              />
              <div>
                <h4 className="font-bold text-[#13141F]">
                  {activeResult ? 'Empirical Metrics Computed' : 'Awaiting Simulation'}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeResult
                    ? `PDR: ${activeResult.pdr.toFixed(1)}% • Delay: ${activeResult.delay_ms != null ? activeResult.delay_ms.toFixed(1) : 'N/A'} ms`
                    : 'Run your first experiment'}
                </p>
              </div>
            </div>

            {/* Event 3 */}
            <div className="relative">
              <div
                className="timeline-dot-anim absolute -left-[23px] top-[3px] w-2.5 h-2.5 rounded-full bg-[#635BFF] ring-4 ring-white"
                style={{ animationDelay: '0.4s' }}
              />
              <div>
                <h4 className="font-bold text-[#13141F]">
                  {activeResult ? 'FlowMonitor Traces Saved' : 'Results will appear here'}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeResult ? 'Database entry recorded' : 'After execution'}
                </p>
              </div>
            </div>

            {/* Event 4: Routing Performance Analyzed */}
            {latestSweep && latestSweep.status === 'completed' && (
              <div className="relative">
                <div
                  className="timeline-dot-anim absolute -left-[23px] top-[3px] w-2.5 h-2.5 rounded-full bg-[#635BFF] ring-4 ring-white"
                  style={{ animationDelay: '0.6s' }}
                />
                <div>
                  <h4 className="font-bold text-[#13141F]">
                    Routing Performance Analyzed
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    AODV vs eAODV performance comparison completed.
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    #{latestSweep.sweep_id.slice(0, 10)} • {latestSweep.parameter_label || 'Node Speed'} Sweep ({latestSweep.completed_runs}/{latestSweep.total_runs} runs)
                  </p>
                </div>
              </div>
            )}

            {/* Event 5: Simulation Configuration Updated */}
            {savedConfig && (
              <div className="relative">
                <div
                  className="timeline-dot-anim absolute -left-[23px] top-[3px] w-2.5 h-2.5 rounded-full bg-[#635BFF] ring-4 ring-white"
                  style={{ animationDelay: '0.8s' }}
                />
                <div>
                  <h4 className="font-bold text-[#13141F]">
                    Simulation Configuration Updated
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Node count, mobility speed and simulation parameters configured.
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {savedConfig.node_count} Nodes • {savedConfig.mobility_speed} m/s • {savedConfig.simulation_area}×{savedConfig.simulation_area}m • {savedConfig.protocol}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { HeaderBar } from './components/HeaderBar';
import { Toolbar } from './components/Toolbar';
import { HeroSection } from './components/HeroSection';
import { KpiGrid } from './components/KpiGrid';
import { SimulationStudio } from './components/SimulationStudio';
import { PerformanceCharts } from './components/PerformanceCharts';
import { TopologyVisualizer } from './components/TopologyVisualizer';
import { AlgorithmMatrix } from './components/AlgorithmMatrix';
import { HistoryModal } from './components/HistoryModal';
import { Footer } from './components/Footer';

import {
  SimulationConfig,
  SimulationResult,
  BackendHealth,
} from './types/simulation';
import { apiService } from './services/api';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [historyOpen, setHistoryOpen] = useState<boolean>(false);
  const [backendHealth, setBackendHealth] = useState<BackendHealth | null>(null);

  const [config, setConfig] = useState<SimulationConfig>({
    protocol: 'eAODV',
    node_count: 50,
    mobility_speed: 10.0,
    simulation_area: 1000,
    simulation_time: 30.0,
    rng_seed: 1,
    is_demo: false,
  });

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [latestResult, setLatestResult] = useState<SimulationResult | null>(null);

  const [logs, setLogs] = useState<string[]>([
    '[INFO] System initialized',
    '[INFO] NS-3 v3.41 C++ simulation scripts verified',
    '[INFO] eAODV and Baseline AODV targets available',
    '[READY] Click Run Simulation to execute',
  ]);

  const wsRef = useRef<WebSocket | null>(null);

  // Check Backend Health on mount and periodically
  useEffect(() => {
    const probe = async () => {
      try {
        const health = await apiService.checkHealth();
        setBackendHealth(health);
        if (health.ns3_engine.ns3_detected) {
          setLogs((prev) => [
            ...prev,
            `[BACKEND] Connected to FastAPI (${health.ns3_engine.distro} / NS-3 v3.41 detected)`,
          ]);
        }
      } catch (e) {
        setBackendHealth(null);
        setLogs((prev) => [
          ...prev,
          '[WARN] FastAPI backend not responding on http://localhost:8000. Client Demo Mode active.',
        ]);
      }
    };
    probe();
    const timer = setInterval(probe, 20000);
    return () => clearInterval(timer);
  }, []);

  // Ambient particle generator
  useEffect(() => {
    const container = document.getElementById('particles-bg');
    if (!container) return;
    const colors = ['#2864E8', '#5D8DF0', '#10B981', '#F59E0B', '#93C5FD'];
    container.innerHTML = '';
    for (let i = 0; i < 28; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const size = Math.random() * 5 + 2;
      p.style.cssText = `
        width:${size}px; height:${size}px;
        left:${Math.random() * 100}%;
        background:${colors[Math.floor(Math.random() * colors.length)]};
        animation-duration:${Math.random() * 20 + 15}s;
        animation-delay:${Math.random() * 10}s;
      `;
      container.appendChild(p);
    }
  }, []);

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev.slice(-150), msg]);
  };

  const handleConfigChange = (newConf: Partial<SimulationConfig>) => {
    setConfig((prev) => ({ ...prev, ...newConf }));
  };

  const handleToggleRun = async () => {
    if (isRunning) {
      // Stop / Cancel
      if (activeRunId && !config.is_demo && backendHealth) {
        try {
          await apiService.cancelSimulation(activeRunId);
          addLog(`[CANCEL] Requested cancellation of run ${activeRunId}`);
        } catch (e) {
          // ignore
        }
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsRunning(false);
      setActiveRunId(null);
      addLog('[STOP] Simulation stopped by user.');
      return;
    }

    // Start Simulation
    setIsRunning(true);

    if (config.is_demo || !backendHealth) {
      // Local Canvas Demo Run
      const simId = `demo_${Date.now()}`;
      setActiveRunId(simId);
      addLog(`[DEMO] Starting local animation demo (${config.protocol}, ${config.node_count} nodes)`);
      return;
    }

    // Real NS-3 Simulation via FastAPI
    try {
      addLog(`[BACKEND] Dispatching ${config.protocol} run to FastAPI backend...`);
      const resp = await apiService.startSimulation(config);
      const runId = resp.run_id;
      setActiveRunId(runId);
      addLog(`[QUEUED] Run ${runId} registered with status: ${resp.status}`);

      // Connect WebSocket for live logs
      const ws = apiService.connectWebSocket(runId, (data) => {
        if (data.type === 'log') {
          addLog(data.text);
        } else if (data.type === 'completed' && data.result) {
          setLatestResult(data.result);
          setIsRunning(false);
          setActiveRunId(null);
          addLog(`[COMPLETED] Run ${runId} completed. Results updated across dashboard.`);
          if (wsRef.current) wsRef.current.close();
        } else if (data.type === 'cancelled') {
          setIsRunning(false);
          setActiveRunId(null);
          addLog(`[CANCELLED] Run ${runId} was cancelled.`);
          if (wsRef.current) wsRef.current.close();
        }
      });
      wsRef.current = ws;

      // Also set up polling fallback in case WebSocket disconnects
      const pollTimer = setInterval(async () => {
        try {
          const st = await apiService.getSimulationStatus(runId);
          if (st.status === 'completed') {
            clearInterval(pollTimer);
            const res = await apiService.getSimulationResults(runId);
            setLatestResult(res);
            setIsRunning(false);
            setActiveRunId(null);
          } else if (st.status === 'failed' || st.status === 'cancelled') {
            clearInterval(pollTimer);
            setIsRunning(false);
            setActiveRunId(null);
          }
        } catch (e) {
          clearInterval(pollTimer);
        }
      }, 2000);
    } catch (e: any) {
      addLog(`[ERROR] Failed to start backend simulation: ${e.message}. Falling back to demo mode.`);
      setConfig((c) => ({ ...c, is_demo: true }));
    }
  };

  const handleSelectRun = async (runId: string) => {
    try {
      const res = await apiService.getSimulationResults(runId);
      setLatestResult(res);
      addLog(`[LOADED] Displaying historical metrics from run ${runId} (${res.protocol})`);
      const el = document.getElementById('kpi');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } catch (e: any) {
      addLog(`[ERROR] Failed to load run ${runId}: ${e.message}`);
    }
  };

  const handleScrollTo = (id: string) => {
    setActiveTab(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="relative min-h-screen">
      {/* Background Particles */}
      <div id="particles-bg" className="bg-particles"></div>

      {/* Main Shell Container */}
      <div className="relative z-10 w-full max-w-[1400px] mx-auto p-0 sm:p-5 lg:p-6">
        <div className="bg-white rounded-none sm:rounded-shell border-0 sm:border border-slate-200/90 shadow-none sm:shadow-shell overflow-hidden flex flex-col">
          {/* Top Navbar */}
          <Navbar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            logs={logs}
            isRunning={isRunning}
            protocol={config.protocol}
            backendHealth={backendHealth}
            onOpenHistory={() => setHistoryOpen(true)}
            onViewLogs={() => handleScrollTo('simulation')}
          />

          {/* Header Bar */}
          <HeaderBar onRunClick={handleToggleRun} isRunning={isRunning} />

          {/* Secondary Action Toolbar */}
          <Toolbar onScrollTo={handleScrollTo} />

          {/* Main Content Sections */}
          <main className="flex-1">
            <HeroSection />

            <KpiGrid latestResult={latestResult} />

            <SimulationStudio
              config={config}
              onConfigChange={handleConfigChange}
              isRunning={isRunning}
              onToggleRun={handleToggleRun}
              logs={logs}
              onAddLog={addLog}
              isBackendAvailable={Boolean(backendHealth?.ns3_engine.ns3_detected)}
            />

            <PerformanceCharts />

            <TopologyVisualizer />

            <AlgorithmMatrix />
          </main>

          {/* Footer */}
          <Footer />
        </div>
      </div>

      {/* History Modal */}
      <HistoryModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelectRun={handleSelectRun}
      />
    </div>
  );
};

export default App;

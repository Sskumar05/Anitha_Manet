import React, { useState, useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Play, Square, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { SweepParameter, SweepResult, SweepConfigMode, SimulationConfig } from '../types/simulation';
import { apiService } from '../services/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface PerformanceChartsProps {
  isBackendAvailable?: boolean;
  studioConfig?: SimulationConfig;
}

export const PerformanceCharts: React.FC<PerformanceChartsProps> = ({
  isBackendAvailable = true,
  studioConfig,
}) => {
  const [activeScenario, setActiveScenario] = useState<SweepParameter>('speed');
  const [configMode, setConfigMode] = useState<SweepConfigMode>('default');
  const [backendMeta, setBackendMeta] = useState<any>(null);
  const [sweepResults, setSweepResults] = useState<Record<SweepParameter, SweepResult | null>>({
    speed: null,
    nodes: null,
    traffic: null,
  });
  const [activeSweepId, setActiveSweepId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pollTimerRef = useRef<any>(null);

  // Fetch backend simulation configuration metadata on mount / reconnect
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const meta = await apiService.getSimulationConfig();
        setBackendMeta(meta);
      } catch {
        // Backend offline or unreachable
      }
    };
    if (isBackendAvailable) {
      fetchConfig();
    }
  }, [isBackendAvailable]);

  // Fetch latest completed sweep for the selected scenario
  const fetchLatestSweep = async (param: SweepParameter) => {
    try {
      const res = await apiService.getLatestSweep(param);
      if (res) {
        setSweepResults((prev) => ({ ...prev, [param]: res }));
      }
    } catch {
      // Backend may be offline or no sweep run yet
    }
  };

  useEffect(() => {
    fetchLatestSweep(activeScenario);
  }, [activeScenario]);

  // Clean up polling timer on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  // Poll status of actively running sweep
  useEffect(() => {
    if (!activeSweepId) return;

    const poll = async () => {
      try {
        const status = await apiService.getSweepStatus(activeSweepId);
        setSweepResults((prev) => ({ ...prev, [status.parameter]: status }));

        if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
          setActiveSweepId(null);
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
          if (status.status === 'failed' && status.error_message) {
            setErrorMsg(`Sweep error: ${status.error_message}`);
          }
        }
      } catch (err: any) {
        setActiveSweepId(null);
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        setErrorMsg(`Failed to query sweep status: ${err?.message || 'Network error'}`);
      }
    };

    poll();
    pollTimerRef.current = setInterval(poll, 1500);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [activeSweepId]);

  // Validation for Studio Configuration
  const isStudioDurationValid = !studioConfig || (studioConfig.simulation_time >= 5.0);
  const isStudioDisabled = configMode === 'studio' && !isStudioDurationValid;

  const handleStartSweep = async () => {
    if (!isBackendAvailable || isStarting || activeSweepId || isStudioDisabled) return;
    setIsStarting(true);
    setErrorMsg(null);

    try {
      const resp = await apiService.startSweep({
        parameter: activeScenario,
        config_mode: configMode,
        studio_config: configMode === 'studio' ? studioConfig : undefined,
        simulation_time: configMode === 'studio' ? studioConfig?.simulation_time : 5.0,
        rng_seed: configMode === 'studio' ? studioConfig?.rng_seed : 1,
      });

      setActiveSweepId(resp.sweep_id);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to start NS-3 sweep');
    } finally {
      setIsStarting(false);
    }
  };

  const handleCancelSweep = async () => {
    if (!activeSweepId) return;
    try {
      await apiService.cancelSweep(activeSweepId);
      setActiveSweepId(null);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to cancel sweep');
    }
  };

  const currentSweep = sweepResults[activeScenario];
  const isRunning = Boolean(activeSweepId && currentSweep && currentSweep.status === 'running');

  // Baseline configuration display helper
  const getBaselineSummary = () => {
    if (configMode === 'studio') {
      if (!studioConfig) return 'Studio configuration unavailable';
      const flows = studioConfig.traffic_flows ?? 4;
      if (activeScenario === 'speed') {
        return `Nodes: ${studioConfig.node_count} | Area: ${studioConfig.simulation_area}m | Time: ${studioConfig.simulation_time}s | Seed: ${studioConfig.rng_seed} | Flows: ${flows}`;
      } else if (activeScenario === 'nodes') {
        return `Speed: ${studioConfig.mobility_speed} m/s | Area: ${studioConfig.simulation_area}m | Time: ${studioConfig.simulation_time}s | Seed: ${studioConfig.rng_seed} | Flows: ${flows}`;
      } else {
        return `Nodes: ${studioConfig.node_count} | Speed: ${studioConfig.mobility_speed} m/s | Area: ${studioConfig.simulation_area}m | Time: ${studioConfig.simulation_time}s | Seed: ${studioConfig.rng_seed}`;
      }
    } else {
      const defaultBase = backendMeta?.sweep_metadata?.[activeScenario]?.default_base_config;
      if (defaultBase) {
        if (activeScenario === 'speed') {
          return `Nodes: ${defaultBase.node_count} | Area: ${defaultBase.simulation_area}m | Time: ${defaultBase.simulation_time}s | Seed: ${defaultBase.rng_seed} | Flows: ${defaultBase.traffic_flows}`;
        } else if (activeScenario === 'nodes') {
          return `Speed: ${defaultBase.mobility_speed} m/s | Area: ${defaultBase.simulation_area}m | Time: ${defaultBase.simulation_time}s | Seed: ${defaultBase.rng_seed} | Flows: ${defaultBase.traffic_flows}`;
        } else {
          return `Nodes: ${defaultBase.node_count} | Speed: ${defaultBase.mobility_speed} m/s | Area: ${defaultBase.simulation_area}m | Time: ${defaultBase.simulation_time}s | Seed: ${defaultBase.rng_seed}`;
        }
      }
      if (activeScenario === 'speed') return 'Nodes: 30 | Area: 1000m | Time: 5.0s | Seed: 1 | Flows: 4';
      if (activeScenario === 'nodes') return 'Speed: 10 m/s | Area: 1000m | Time: 5.0s | Seed: 1 | Flows: 4';
      return 'Nodes: 35 | Speed: 10 m/s | Area: 1000m | Time: 5.0s | Seed: 1';
    }
  };

  // Compute dynamic comparison badges from valid paired NS-3 measurements
  const calculateDeltaBadge = (metricKey: 'pdr' | 'delay_ms' | 'overhead_ratio' | 'energy_consumed_j') => {
    if (!currentSweep || !currentSweep.points || currentSweep.points.length === 0) {
      return null;
    }

    const paired = currentSweep.points.filter(
      (p) =>
        p.aodv_result &&
        p.eaodv_result &&
        p.status === 'completed' &&
        p.aodv_result[metricKey] !== null &&
        p.aodv_result[metricKey] !== undefined &&
        p.eaodv_result[metricKey] !== null &&
        p.eaodv_result[metricKey] !== undefined
    );

    if (paired.length === 0) {
      return null;
    }

    const aodvSum = paired.reduce((acc, p) => acc + (p.aodv_result![metricKey] as number), 0);
    const eaodvSum = paired.reduce((acc, p) => acc + (p.eaodv_result![metricKey] as number), 0);
    const aodvAvg = aodvSum / paired.length;
    const eaodvAvg = eaodvSum / paired.length;

    if (aodvAvg === 0) {
      return { tag: '0.0%', tagColor: 'bg-slate-100 text-slate-700 border-slate-200' };
    }

    const deltaPercent = ((eaodvAvg - aodvAvg) / aodvAvg) * 100;
    const formattedDelta = (deltaPercent > 0 ? `+${deltaPercent.toFixed(1)}` : `${deltaPercent.toFixed(1)}`) + '%';

    if (metricKey === 'pdr') {
      // Higher is better
      const isImproved = deltaPercent > 0;
      return {
        tag: `eAODV ${formattedDelta}`,
        tagColor: isImproved
          ? 'bg-blue-50 text-primary border-blue-200'
          : 'bg-rose-50 text-rose-700 border-rose-200',
      };
    } else if (metricKey === 'delay_ms') {
      // Lower is better
      const isImproved = deltaPercent < 0;
      return {
        tag: `${formattedDelta} Latency`,
        tagColor: isImproved
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-rose-50 text-rose-700 border-rose-200',
      };
    } else if (metricKey === 'overhead_ratio') {
      // NRL: Lower is better
      const isImproved = deltaPercent < 0;
      return {
        tag: `${formattedDelta} NRL`,
        tagColor: isImproved
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : 'bg-rose-50 text-rose-700 border-rose-200',
      };
    } else {
      // Energy: Lower is better
      const isImproved = deltaPercent < 0;
      return {
        tag: `${formattedDelta} Energy`,
        tagColor: isImproved
          ? 'bg-blue-50 text-blue-700 border-blue-200'
          : 'bg-rose-50 text-rose-700 border-rose-200',
      };
    }
  };

  const getChartOptions = (yTitle: string) => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600, easing: 'easeInOutQuart' as const },
    plugins: {
      legend: {
        labels: {
          boxWidth: 10,
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 16,
          font: { size: 11, family: "'Plus Jakarta Sans', sans-serif", weight: 'bold' as const },
          color: '#13141F',
        },
      },
      tooltip: {
        backgroundColor: '#13141F',
        borderColor: '#2D314D',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 12,
        titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: 'bold' as const },
        bodyFont: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
        callbacks: {
          label: (context: any) => {
            const val = context.parsed.y;
            return ` ${context.dataset.label}: ${val !== null && val !== undefined ? val : 'N/A'}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(235, 239, 249, 0.8)' },
        ticks: { color: '#64748B', font: { family: "'Plus Jakarta Sans', sans-serif", size: 10 } },
        title: {
          display: true,
          text: currentSweep?.x_title || (activeScenario === 'speed' ? 'Node Speed (m/s)' : activeScenario === 'nodes' ? 'Number of Nodes' : 'Traffic Load (flows)'),
          color: '#64748B',
          font: { family: "'Plus Jakarta Sans', sans-serif", size: 10, weight: 'bold' as const },
        },
      },
      y: {
        grid: { color: 'rgba(235, 239, 249, 0.8)' },
        ticks: { color: '#64748B', font: { family: "'Plus Jakarta Sans', sans-serif", size: 10 } },
        title: {
          display: true,
          text: yTitle,
          color: '#64748B',
          font: { family: "'Plus Jakarta Sans', sans-serif", size: 10, weight: 'bold' as const },
        },
      },
    },
  });

  const makeDataset = (label: string, data: (number | null)[], color: string) => ({
    label,
    data,
    borderColor: color,
    backgroundColor: color === '#635BFF' ? 'rgba(99, 91, 255, 0.09)' : 'rgba(148, 163, 184, 0.08)',
    pointBackgroundColor: color,
    pointBorderColor: '#FFFFFF',
    pointBorderWidth: 2,
    pointRadius: 4.5,
    borderWidth: 2.5,
    fill: true,
    tension: 0.35,
    spanGaps: false,
  });

  const labels = currentSweep?.points ? currentSweep.points.map((p) => p.parameter_label) : [];

  const extractMetricSeries = (metricKey: 'pdr' | 'delay_ms' | 'overhead_ratio' | 'energy_consumed_j') => {
    if (!currentSweep?.points) {
      return { aodv: [], eaodv: [] };
    }
    const aodv = currentSweep.points.map((p) =>
      p.aodv_result && p.aodv_result[metricKey] !== undefined && p.aodv_result[metricKey] !== null
        ? (p.aodv_result[metricKey] as number)
        : null
    );
    const eaodv = currentSweep.points.map((p) =>
      p.eaodv_result && p.eaodv_result[metricKey] !== undefined && p.eaodv_result[metricKey] !== null
        ? (p.eaodv_result[metricKey] as number)
        : null
    );
    return { aodv, eaodv };
  };

  const pdrSeries = extractMetricSeries('pdr');
  const delaySeries = extractMetricSeries('delay_ms');
  const overheadSeries = extractMetricSeries('overhead_ratio');
  const energySeries = extractMetricSeries('energy_consumed_j');

  const pdrBadge = calculateDeltaBadge('pdr');
  const delayBadge = calculateDeltaBadge('delay_ms');
  const overheadBadge = calculateDeltaBadge('overhead_ratio');
  const energyBadge = calculateDeltaBadge('energy_consumed_j');

  const hasAnyData = Boolean(
    currentSweep &&
      currentSweep.points.some((p) => p.aodv_result !== null && p.aodv_result !== undefined || p.eaodv_result !== null && p.eaodv_result !== undefined)
  );

  const chartsData = [
    {
      id: 'pdr',
      title: 'Packet Delivery Ratio (%)',
      tag: pdrBadge?.tag,
      tagColor: pdrBadge?.tagColor,
      data: {
        labels,
        datasets: [
          makeDataset('AODV (Baseline)', pdrSeries.aodv, '#94A3B8'),
          makeDataset('eAODV (Enhanced)', pdrSeries.eaodv, '#635BFF'),
        ],
      },
      yLabel: 'PDR (%)',
    },
    {
      id: 'delay',
      title: 'End-to-End Delay (ms)',
      tag: delayBadge?.tag,
      tagColor: delayBadge?.tagColor,
      data: {
        labels,
        datasets: [
          makeDataset('AODV (Baseline)', delaySeries.aodv, '#94A3B8'),
          makeDataset('eAODV (Enhanced)', delaySeries.eaodv, '#10B981'),
        ],
      },
      yLabel: 'Delay (ms)',
    },
    {
      id: 'overhead',
      title: 'Normalized Routing Load (NRL)',
      tag: overheadBadge?.tag,
      tagColor: overheadBadge?.tagColor,
      data: {
        labels,
        datasets: [
          makeDataset('AODV (Baseline)', overheadSeries.aodv, '#94A3B8'),
          makeDataset('eAODV (Enhanced)', overheadSeries.eaodv, '#F59E0B'),
        ],
      },
      yLabel: 'NRL (Ctrl pkts / Data pkt)',
    },
    {
      id: 'energy',
      title: 'Energy Consumption (J)',
      tag: energyBadge?.tag,
      tagColor: energyBadge?.tagColor,
      data: {
        labels,
        datasets: [
          makeDataset('AODV (Baseline)', energySeries.aodv, '#94A3B8'),
          makeDataset('eAODV (Enhanced)', energySeries.eaodv, '#635BFF'),
        ],
      },
      yLabel: 'Energy (J)',
    },
  ];

  return (
    <section id="analysis" className="px-6 sm:px-10 py-7 border-b border-slate-100 w-full">
      {/* Section Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5 mb-6">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#13141F] tracking-tight">
              Parametric Performance Sweeps
            </h2>
            <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              NS-3.41 Empirical Curves
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
            Empirical parametric curves measured from real NS-3.41 simulations (AODV vs eAODV). Matching seeds, mobility models, and simulation duration are enforced for scientific fairness.
          </p>
        </div>

        {/* Unified Control Toolbar Row */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Sweep Configuration Mode Selector (Default vs Studio) */}
          <div className="h-[38px] bg-slate-100 p-1 rounded-full border border-slate-200/80 inline-flex items-center gap-1 shrink-0">
            <button
              onClick={() => {
                setConfigMode('default');
                setErrorMsg(null);
              }}
              disabled={isRunning}
              title="Use reproducible baseline configuration defined by backend"
              className={`h-full px-3.5 rounded-full text-xs font-bold transition-all inline-flex items-center justify-center ${
                configMode === 'default'
                  ? 'bg-[#13141F] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              } ${isRunning ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              Default Baseline
            </button>
            <button
              onClick={() => {
                setConfigMode('studio');
                setErrorMsg(null);
              }}
              disabled={isRunning}
              title="Use current Live Studio configuration as the experimental baseline"
              className={`h-full px-3.5 rounded-full text-xs font-bold transition-all inline-flex items-center justify-center gap-1.5 ${
                configMode === 'studio'
                  ? 'bg-[#635BFF] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              } ${isRunning ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <span>Use Studio Config</span>
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase font-extrabold leading-none tracking-wide ${
                  configMode === 'studio' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                Studio
              </span>
            </button>
          </div>

          <div className="h-5 w-px bg-slate-200 hidden sm:block shrink-0"></div>

          {/* Sweep Parameter Selector */}
          <div className="h-[38px] bg-slate-100 p-1 rounded-full border border-slate-200/80 inline-flex items-center gap-1 shrink-0">
            {(['speed', 'nodes', 'traffic'] as const).map((scen) => (
              <button
                key={scen}
                onClick={() => {
                  setActiveScenario(scen);
                  setErrorMsg(null);
                }}
                disabled={isRunning}
                className={`h-full px-3.5 rounded-full text-xs font-bold transition-all inline-flex items-center justify-center ${
                  activeScenario === scen
                    ? 'bg-[#635BFF] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                } ${isRunning ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                vs {scen.charAt(0).toUpperCase() + scen.slice(1)}
              </button>
            ))}
          </div>

          {/* Sweep Execution Button */}
          {!isBackendAvailable ? (
            <div className="h-[38px] inline-flex items-center gap-1.5 px-4 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs shrink-0">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>Backend Offline</span>
            </div>
          ) : isRunning ? (
            <button
              onClick={handleCancelSweep}
              className="h-[38px] px-4 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-md shadow-rose-500/20 transition-all shrink-0"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Cancel Sweep</span>
            </button>
          ) : (
            <button
              onClick={handleStartSweep}
              disabled={isStarting || isStudioDisabled}
              title={
                isStudioDisabled
                  ? 'Studio duration must be at least 5.0s to run sweeps'
                  : `Launch NS-3 parameter sweep vs ${activeScenario}`
              }
              className={`h-[38px] px-5 rounded-full font-bold text-xs inline-flex items-center justify-center gap-2 shadow-md transition-all shrink-0 ${
                isStudioDisabled
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-[#635BFF] hover:bg-[#5349EE] text-white shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {isStarting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Initializing...</span>
                </>
              ) : (
                <span>
                  {hasAnyData
                    ? `Re-run Sweep (vs ${activeScenario.charAt(0).toUpperCase() + activeScenario.slice(1)})`
                    : `Run Real Sweep (vs ${activeScenario.charAt(0).toUpperCase() + activeScenario.slice(1)})`}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Baseline Configuration Summary Bar */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-3 px-5 py-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-bold text-slate-800 flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                configMode === 'studio' ? 'bg-[#635BFF] animate-pulse' : 'bg-slate-700'
              }`}
            ></span>
            {configMode === 'studio' ? 'Studio Baseline Settings:' : 'Default Baseline Settings:'}
          </span>
          <span className="text-slate-700 font-mono text-[11px] bg-white px-2.5 py-0.5 rounded-md border border-slate-200 shadow-2xs font-semibold">
            {getBaselineSummary()}
          </span>
          {configMode === 'studio' ? (
            <span className="text-[10px] bg-indigo-50 text-[#635BFF] border border-indigo-100 px-2.5 py-0.5 rounded-full font-bold">
              Live Studio Linked
            </span>
          ) : (
            <span className="text-[10px] bg-slate-200 text-slate-700 border border-slate-300 px-2.5 py-0.5 rounded-full font-bold">
              Standard Benchmark
            </span>
          )}
        </div>
        <div className="text-[11px] text-slate-500 font-medium">
          Swept parameter varies across 4 points • Paired AODV/eAODV execution
        </div>
      </div>

      {/* Studio Configuration Duration Validation Warning */}
      {configMode === 'studio' && !isStudioDurationValid && (
        <div className="mb-5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2.5 shadow-sm">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <div>
            <span className="font-bold">Studio Duration Too Short:</span> Live Studio duration is set to{' '}
            <code className="bg-amber-100 font-mono px-1 rounded font-bold">
              {studioConfig?.simulation_time ?? 0}s
            </code>
            . NS-3 sweeps require at least{' '}
            <code className="bg-amber-100 font-mono px-1 rounded font-bold">5.0s</code> per run for AODV route
            discovery and steady-state packet delivery. Please adjust simulation time in Live Studio or switch to{' '}
            <strong>Default Baseline</strong>.
          </div>
        </div>
      )}

      {/* Backend Disconnected Alert */}
      {!isBackendAvailable && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">FastAPI Backend Unavailable</div>
            <div className="text-rose-600 text-xs mt-0.5">
              Parametric sweep simulations require an active connection to the FastAPI backend with NS-3.41 engine support. Connect the backend to execute real NS-3 experiments.
            </div>
          </div>
        </div>
      )}

      {/* Sweep Execution Progress Banner */}
      {isRunning && currentSweep && (
        <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-200 shadow-sm animate-pulse">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-primary animate-spin" />
              <span className="text-xs sm:text-sm font-bold text-navy-900">
                {currentSweep.current_step || 'Simulating matched experiments in NS-3...'}
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-primary">
              {currentSweep.completed_runs}/{currentSweep.total_runs} runs ({currentSweep.progress_percent}%)
            </span>
          </div>

          <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-500"
              style={{ width: `${currentSweep.progress_percent}%` }}
            ></div>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-navy-500">
            <span>
              Sweep ID: <code className="font-mono text-navy-700">{currentSweep.sweep_id}</code>
            </span>
            <span>
              Mode:{' '}
              <strong className="capitalize text-navy-800">
                {currentSweep.base_config?.config_mode || 'default'}
              </strong>{' '}
              | Seed: {currentSweep.base_config?.rng_seed ?? 1} | Time:{' '}
              {currentSweep.base_config?.simulation_time ?? 5}s per run
            </span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMsg && (
        <div className="mb-6 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-amber-900 font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Four Charts Grid or Empty State */}
      {!hasAnyData && !isRunning ? (
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-8 sm:p-12 text-center">
          <div className="max-w-md mx-auto flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-primary flex items-center justify-center mb-4">
              <Play className="w-6 h-6 fill-current translate-x-0.5" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-navy-900 mb-1">
              No Real Simulation Data for vs {activeScenario.charAt(0).toUpperCase() + activeScenario.slice(1)}
            </h3>
            <p className="text-xs sm:text-sm text-navy-500 mb-5">
              Static reference curves have been removed to uphold scientific integrity. Run an actual NS-3.41 simulation sweep to generate empirical performance curves for AODV vs eAODV.
            </p>
            {isBackendAvailable ? (
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={handleStartSweep}
                  disabled={isStarting || isStudioDisabled}
                  className={`px-5 py-2.5 rounded-full font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 ${
                    isStudioDisabled
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-primary hover:bg-blue-600 text-white hover:shadow-lg'
                  }`}
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>
                    Run Real NS-3 Sweep (vs {activeScenario.charAt(0).toUpperCase() + activeScenario.slice(1)})
                  </span>
                </button>
                {isStudioDisabled && (
                  <span className="text-[11px] text-amber-700 font-semibold">
                    Studio duration ({studioConfig?.simulation_time ?? 0}s) must be ≥ 5.0s, or switch to Default Baseline.
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-rose-600 font-medium">
                Connect FastAPI backend at http://127.0.0.1:8000 to execute sweeps.
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {chartsData.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-[28px] p-6 border border-slate-200/90 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-[#13141F]">{item.title}</span>
                {item.tag && (
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${item.tagColor}`}>
                    {item.tag}
                  </span>
                )}
              </div>
              <div className="h-[220px] w-full">
                <Line data={item.data} options={getChartOptions(item.yLabel)} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sweep Metadata & Scientific Audit Trace Drawer - FINNOVA Signature Dark Container */}
      {currentSweep && currentSweep.points && currentSweep.points.length > 0 && (
        <div className="mt-8 bg-[#13141F] border border-slate-800 rounded-[28px] p-6 text-xs text-slate-200 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-bold text-white text-sm">
                NS-3 Execution Trace Audit: {currentSweep.parameter_label} Sweep ({currentSweep.completed_runs}/{currentSweep.total_runs} runs completed)
              </span>
              <span className="text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700">
                ID: {currentSweep.sweep_id}
              </span>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-[#635BFF]/20 text-[#7B61FF] border border-[#635BFF]/30">
                Mode: {currentSweep.base_config?.config_mode === 'studio' ? 'Studio Baseline' : 'Default Baseline'}
              </span>
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-slate-800/80 overflow-x-auto">
              <div className="mb-4 px-4 py-3 rounded-2xl bg-[#1E2033] border border-slate-800 text-[11px] text-slate-300 flex flex-wrap items-center gap-5">
                <span>
                  <strong className="text-slate-400">Configuration Mode:</strong>{' '}
                  <span className="font-mono capitalize text-[#635BFF] font-bold">
                    {currentSweep.base_config?.config_mode || 'default'}
                  </span>
                </span>
                <span>
                  <strong className="text-slate-400">Grid Area:</strong>{' '}
                  <span className="font-mono text-white">{currentSweep.base_config?.simulation_area ?? 1000}m</span>
                </span>
                <span>
                  <strong className="text-slate-400">Per-run Duration:</strong>{' '}
                  <span className="font-mono text-white">{currentSweep.base_config?.simulation_time ?? 5}s</span>
                </span>
                <span>
                  <strong className="text-slate-400">RNG Seed:</strong>{' '}
                  <span className="font-mono text-white">{currentSweep.base_config?.rng_seed ?? 1}</span>
                </span>
                {currentSweep.base_config?.traffic_flows !== undefined && (
                  <span>
                    <strong className="text-slate-400">Flows:</strong>{' '}
                    <span className="font-mono text-white">{currentSweep.base_config?.traffic_flows}</span>
                  </span>
                )}
              </div>

              <table className="w-full text-left font-mono text-[11px]">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800">
                    <th className="pb-2.5 font-bold">{currentSweep.parameter_label}</th>
                    <th className="pb-2.5 font-bold">AODV Run ID</th>
                    <th className="pb-2.5 font-bold">AODV PDR (%)</th>
                    <th className="pb-2.5 font-bold">AODV Delay (ms)</th>
                    <th className="pb-2.5 font-bold">AODV NRL</th>
                    <th className="pb-2.5 font-bold text-[#7B61FF]">eAODV Run ID</th>
                    <th className="pb-2.5 font-bold text-[#7B61FF]">eAODV PDR (%)</th>
                    <th className="pb-2.5 font-bold text-[#7B61FF]">eAODV Delay (ms)</th>
                    <th className="pb-2.5 font-bold text-[#7B61FF]">eAODV NRL</th>
                    <th className="pb-2.5 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {currentSweep.points.map((pt, idx) => (
                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                      <td className="py-2.5 font-bold text-white">{pt.parameter_label}</td>
                      <td className="py-2.5 text-slate-400">{pt.aodv_run_id || '—'}</td>
                      <td className="py-2.5">{pt.aodv_result ? (pt.aodv_result.pdr !== undefined && pt.aodv_result.pdr !== null ? `${pt.aodv_result.pdr}%` : '—') : '—'}</td>
                      <td className="py-2.5">{pt.aodv_result ? (pt.aodv_result.delay_ms != null ? `${pt.aodv_result.delay_ms}ms` : 'N/A') : '—'}</td>
                      <td className="py-2.5 text-slate-400">{pt.aodv_result?.overhead_ratio !== undefined && pt.aodv_result?.overhead_ratio !== null ? pt.aodv_result.overhead_ratio : '—'}</td>
                      <td className="py-2.5 text-[#7B61FF]">{pt.eaodv_run_id || '—'}</td>
                      <td className="py-2.5 text-[#7B61FF] font-bold">{pt.eaodv_result ? (pt.eaodv_result.pdr !== undefined && pt.eaodv_result.pdr !== null ? `${pt.eaodv_result.pdr}%` : '—') : '—'}</td>
                      <td className="py-2.5 text-emerald-400 font-bold">{pt.eaodv_result ? (pt.eaodv_result.delay_ms != null ? `${pt.eaodv_result.delay_ms}ms` : 'N/A') : '—'}</td>
                      <td className="py-2.5 text-amber-400 font-bold">{pt.eaodv_result?.overhead_ratio !== undefined && pt.eaodv_result?.overhead_ratio !== null ? pt.eaodv_result.overhead_ratio : '—'}</td>
                      <td className="py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            pt.status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : pt.status === 'running'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 animate-pulse'
                              : pt.status === 'failed'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {pt.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 text-[10px] text-slate-400 space-y-1">
                <div>
                  <strong>Scientific Metrics (v2):</strong> PDR = (Received CBR Packets / Transmitted CBR Packets) × 100% (pure user-data, port 654 excluded).
                </div>
                <div>
                  NRL = (Total Routing Control Packets / Received CBR Packets). If delivered data pkts = 0, NRL is undefined (null). Delta % = ((mean(eAODV) − mean(AODV)) / mean(AODV)) × 100.
                </div>
              </div>
            </div>
        </div>
      )}
    </section>
  );
};

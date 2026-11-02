import React, { useRef, useEffect } from 'react';
import { Play, Square, Cpu, Server, RefreshCw, Terminal, Layers, Sliders, Zap } from 'lucide-react';
import { SimCanvas } from './SimCanvas';
import { ProtocolType, SimulationConfig, SimulationResult } from '../types/simulation';

interface SimulationStudioProps {
  config: SimulationConfig;
  onConfigChange: (newConfig: Partial<SimulationConfig>) => void;
  isRunning: boolean;
  isStarting?: boolean;
  activeRunId?: string | null;
  onToggleRun: () => void;
  logs: string[];
  onAddLog: (msg: string) => void;
  isBackendAvailable: boolean;
  latestResult?: SimulationResult | null;
}

export const SimulationStudio: React.FC<SimulationStudioProps> = ({
  config,
  onConfigChange,
  isRunning,
  isStarting = false,
  activeRunId = null,
  onToggleRun,
  logs,
  isBackendAvailable,
  latestResult,
}) => {
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <section id="simulation" className="px-6 sm:px-10 py-8 border-b border-slate-100">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#13141F] tracking-tight">
              Simulation Studio
            </h2>
            <span className="text-[11px] font-bold px-3 py-0.5 rounded-full bg-indigo-50 text-[#635BFF] border border-indigo-100">
              Live NS-3.41 C++
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Configure mobile ad-hoc parameters and monitor real-time packet forwarding and node mobility
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Engine Connectivity Status Pill */}
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold ${
              isBackendAvailable
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                : 'bg-rose-50 text-rose-700 border-rose-200/80'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isBackendAvailable ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span>{isBackendAvailable ? 'NS-3 C++ Engine Active' : 'Backend Disconnected'}</span>
          </div>

          {/* FINNOVA Signature Purple Run Button */}
          <button
            onClick={onToggleRun}
            disabled={isStarting || (!isBackendAvailable && !isRunning)}
            title={
              isStarting
                ? 'Connecting to FastAPI backend and validating NS-3...'
                : !isBackendAvailable
                ? 'Backend Disconnected: start FastAPI on http://localhost:8000 to execute simulation'
                : isRunning
                ? 'Stop active simulation run'
                : 'Execute genuine NS-3 simulation'
            }
            className={`px-6 py-2.5 rounded-full text-xs font-bold tracking-tight shadow-lg flex items-center gap-2 transition-all transform ${
              isStarting
                ? 'bg-[#635BFF]/80 text-white cursor-wait shadow-indigo-500/20'
                : isRunning
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/25 animate-pulse hover:scale-[1.02]'
                : !isBackendAvailable
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                : 'bg-[#635BFF] hover:bg-[#5349EE] text-white shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            {isStarting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Initializing...</span>
              </>
            ) : isRunning ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop Simulation</span>
              </>
            ) : !isBackendAvailable ? (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Backend Offline</span>
              </>
            ) : (
              <span>Run Simulation</span>
            )}
          </button>
        </div>
      </div>

      {/* Backend Offline Warning Banner */}
      {!isBackendAvailable && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-50/80 border border-rose-200 text-rose-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-base">⚠️</span>
            <div>
              <span className="font-bold">FastAPI Backend Disconnected:</span> NS-3 simulation execution is disabled. Please start the backend server on <code className="bg-rose-100 px-1.5 py-0.5 rounded font-mono">http://127.0.0.1:8000</code>.
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-700 font-bold">Offline</span>
        </div>
      )}

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {/* Controls Column */}
        <div className="lg:col-span-5 bg-white rounded-[28px] p-6 border border-slate-200/90 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#635BFF]" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Simulation Parameters
              </span>
            </div>
            {/* <span className="text-[11px] font-mono text-slate-400">802.11b PHY</span> */}
          </div>

          {/* Protocol Toggle - FINNOVA Dark Capsule */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5">
              Target Routing Protocol
            </label>
            <div className="p-1 rounded-full bg-[#13141F] flex items-center gap-1">
              {(['AODV', 'eAODV'] as ProtocolType[]).map((p) => {
                const isActive = config.protocol === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onConfigChange({ protocol: p })}
                    className={`flex-1 py-2 px-3 rounded-full text-xs font-bold transition-all flex items-center justify-center ${
                      isActive
                        ? 'bg-[#635BFF] text-white shadow-md shadow-indigo-900/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>{p === 'eAODV' ? 'eAODV (Energy-Aware)' : 'Standard AODV'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Node Count Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700">Ad-Hoc Node Count</label>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-[#635BFF] border border-indigo-100 font-mono">
                {config.node_count} nodes
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={config.node_count}
              onChange={(e) => onConfigChange({ node_count: parseInt(e.target.value) })}
              className="w-full h-2 bg-slate-100 rounded-lg cursor-pointer accent-[#635BFF]"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
              <span>10 nodes</span>
              <span>50 nodes</span>
              <span>100 nodes</span>
            </div>
          </div>

          {/* Max Speed Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700">Mobility Speed (m/s)</label>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-[#635BFF] border border-indigo-100 font-mono">
                {config.mobility_speed} m/s
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="25"
              step="1"
              value={config.mobility_speed}
              onChange={(e) => onConfigChange({ mobility_speed: parseFloat(e.target.value) })}
              className="w-full h-2 bg-slate-100 rounded-lg cursor-pointer accent-[#635BFF]"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
              <span>1 m/s (Walk)</span>
              <span>12 m/s (Run)</span>
              <span>25 m/s (Vehicle)</span>
            </div>
          </div>

          {/* Simulation Area Radios */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5">
              Simulation Boundary (2D Square)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[500, 1000, 2000].map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => onConfigChange({ simulation_area: area })}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center ${
                    config.simulation_area === area
                      ? 'bg-indigo-50/80 text-[#635BFF] border-[#635BFF] shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {area}×{area}m
                </button>
              ))}
            </div>
          </div>

          {/* Simulation Console Log - FINNOVA Dark Container */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-slate-400" />
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Simulation Console Log
                </label>
              </div>
              <span className="text-[10px] font-mono text-slate-400">NS-3 v3.41</span>
            </div>
            <div
              id="simulation-log"
              ref={logContainerRef}
              className="h-[145px] overflow-y-auto bg-[#13141F] text-slate-300 font-mono text-[11px] p-3.5 rounded-2xl border border-slate-800 space-y-1.5 leading-relaxed shadow-inner"
            >
              {logs.map((log, idx) => {
                let color = 'text-slate-300';
                if (log.includes('WARN') || log.includes('STOP')) color = 'text-amber-400';
                else if (log.includes('SUCCESS') || log.includes('DATA') || log.includes('FlowMonitor'))
                  color = 'text-emerald-400 font-semibold';
                else if (log.includes('eAODV')) color = 'text-[#7B61FF]';
                else if (log.includes('RREQ') || log.includes('RREP')) color = 'text-indigo-300';

                return (
                  <div key={idx} className={color}>
                    {log}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Canvas Column */}
        <div className="lg:col-span-7 flex flex-col items-center bg-white rounded-[28px] p-6 border border-slate-200/90 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
          <SimCanvas
            isRunning={isRunning}
            activeRunId={activeRunId}
            nodeCount={config.node_count}
            speed={config.mobility_speed}
            protocol={config.protocol}
            latestResult={latestResult}
          />
        </div>
      </div>
    </section>
  );
};

import React, { useRef, useEffect } from 'react';
import { Play, Square, Cpu, Server, Laptop } from 'lucide-react';
import { SimCanvas } from './SimCanvas';
import { ProtocolType, SimulationConfig } from '../types/simulation';

interface SimulationStudioProps {
  config: SimulationConfig;
  onConfigChange: (newConfig: Partial<SimulationConfig>) => void;
  isRunning: boolean;
  onToggleRun: () => void;
  logs: string[];
  onAddLog: (msg: string) => void;
  isBackendAvailable: boolean;
}

export const SimulationStudio: React.FC<SimulationStudioProps> = ({
  config,
  onConfigChange,
  isRunning,
  onToggleRun,
  logs,
  onAddLog,
  isBackendAvailable,
}) => {
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <section id="simulation" className="px-6 sm:px-9 py-8 border-b border-slate-100">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-navy-900 tracking-tight flex items-center gap-2">
            <span>🔬 Live Network Simulation Studio</span>
          </h2>
          <p className="text-xs sm:text-sm text-navy-500 mt-0.5">
            Configure dynamic ad-hoc parameters and monitor packet forwarding across mobile topology
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Execution Mode Selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => onConfigChange({ is_demo: false })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                !config.is_demo
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-navy-500 hover:text-navy-900'
              }`}
              title={
                isBackendAvailable
                  ? 'Execute genuine NS-3 C++ engine via WSL2'
                  : 'Backend currently offline - will use calibrated fallback'
              }
            >
              <Server className="w-3.5 h-3.5" />
              <span>Real NS-3 Run</span>
            </button>

            <button
              type="button"
              onClick={() => onConfigChange({ is_demo: true })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                config.is_demo
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-navy-500 hover:text-navy-900'
              }`}
              title="Fast in-browser canvas heuristics"
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>Demo Mode</span>
            </button>
          </div>

          {/* Primary Run Button */}
          <button
            onClick={onToggleRun}
            className={`px-5 py-2.5 rounded-full text-xs font-bold tracking-tight shadow-md flex items-center gap-2 transition-all transform hover:scale-[1.02] ${
              isRunning
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/25 animate-pulse'
                : 'bg-primary hover:bg-primary-hover text-white shadow-blue-500/25'
            }`}
          >
            {isRunning ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop Simulation</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Simulation</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Controls Column */}
        <div className="lg:col-span-5 bg-white rounded-card p-6 border border-slate-200/80 shadow-sm flex flex-col gap-5">
          {/* Protocol Toggle */}
          <div>
            <label className="block text-xs font-bold text-navy-700 uppercase tracking-wider mb-2">
              Routing Protocol
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['AODV', 'eAODV', 'BOTH'] as ProtocolType[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onConfigChange({ protocol: p })}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                    config.protocol === p
                      ? 'bg-primary text-white border-primary shadow-md shadow-blue-500/20'
                      : 'bg-slate-50 text-navy-500 border-slate-200 hover:bg-slate-100 hover:text-navy-900'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Node Count Slider */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-navy-700">Node Count</label>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-50 text-primary border border-blue-200/60 font-mono">
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
              className="w-full accent-primary h-2 bg-slate-100 rounded-lg cursor-pointer"
            />
          </div>

          {/* Max Speed Slider */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-navy-700">Mobility Speed (m/s)</label>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-50 text-primary border border-blue-200/60 font-mono">
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
              className="w-full accent-primary h-2 bg-slate-100 rounded-lg cursor-pointer"
            />
          </div>

          {/* Simulation Area Radios */}
          <div>
            <label className="block text-xs font-bold text-navy-700 uppercase tracking-wider mb-2">
              Simulation Area
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[500, 1000, 2000].map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => onConfigChange({ simulation_area: area })}
                  className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                    config.simulation_area === area
                      ? 'bg-blue-50 text-primary border-primary font-bold shadow-sm'
                      : 'bg-white text-navy-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {area}×{area}m
                </button>
              ))}
            </div>
          </div>

          {/* Simulation Console Log */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-navy-700 uppercase tracking-wider">
                Simulation Console Log
              </label>
              <span className="text-[10px] font-mono text-slate-400">NS-3 v3.41</span>
            </div>
            <div
              id="simulation-log"
              ref={logContainerRef}
              className="h-[140px] overflow-y-auto bg-slate-900 text-slate-300 font-mono text-[11px] p-3 rounded-xl border border-slate-800 space-y-1.5 leading-relaxed"
            >
              {logs.map((log, idx) => {
                let color = 'text-slate-300';
                if (log.includes('WARN') || log.includes('STOP')) color = 'text-amber-400';
                else if (log.includes('SUCCESS') || log.includes('DATA') || log.includes('FlowMonitor'))
                  color = 'text-emerald-400 font-semibold';
                else if (log.includes('eAODV')) color = 'text-blue-300';
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
        <div className="lg:col-span-7 flex flex-col items-center bg-white rounded-card p-6 border border-slate-200/80 shadow-sm">
          <SimCanvas
            isRunning={isRunning}
            nodeCount={config.node_count}
            speed={config.mobility_speed}
            protocol={config.protocol}
            onLogGenerated={onAddLog}
          />
        </div>
      </div>
    </section>
  );
};

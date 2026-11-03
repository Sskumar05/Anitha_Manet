import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { HeaderBar } from './components/HeaderBar';
import { HistoryModal } from './components/HistoryModal';
import { Footer } from './components/Footer';

// Dedicated Page Components
import { OverviewPage } from './pages/OverviewPage';
import { SimulationPage } from './pages/SimulationPage';
import { AnalysisPage } from './pages/AnalysisPage';
import { TopologyPage } from './pages/TopologyPage';
import { AlgorithmPage } from './pages/AlgorithmPage';

import {
  SimulationConfig,
  SimulationResult,
  BackendHealth,
} from './types/simulation';
import { apiService } from './services/api';

export const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [historyOpen, setHistoryOpen] = useState<boolean>(false);
  const [backendHealth, setBackendHealth] = useState<BackendHealth | null>(null);

  const [config, setConfig] = useState<SimulationConfig>({
    protocol: 'eAODV',
    node_count: 50,
    mobility_speed: 10.0,
    simulation_area: 1000,
    simulation_time: 30.0,
    rng_seed: 1,
  });

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [latestResult, setLatestResult] = useState<SimulationResult | null>(null);

  const [logs, setLogs] = useState<string[]>([
    '[INFO] MANET Research Dashboard initialized.',
    '[INFO] Checking FastAPI backend connectivity at http://127.0.0.1:8000...',
  ]);

  const wsRef = useRef<WebSocket | null>(null);
  const prevHealthRef = useRef<boolean | null>(null);

  // Check Backend Health on mount and periodically (every 3s for fast recovery)
  useEffect(() => {
    const probe = async () => {
      try {
        const health = await apiService.checkHealth();
        setBackendHealth(health);
        if (prevHealthRef.current !== true) {
          prevHealthRef.current = true;
          if (health.ns3_engine.ns3_detected) {
            setLogs((prev) => [
              ...prev,
              `[BACKEND CONNECTED] FastAPI backend online (${health.ns3_engine.distro} / NS-3 v3.41 detected). Real simulation ready.`,
              '[READY] Select routing protocol (AODV/eAODV) and click Run Simulation.',
            ]);
          } else {
            setLogs((prev) => [
              ...prev,
              `[BACKEND CONNECTED] FastAPI active but NS-3 engine path not found in ${health.ns3_engine.distro}.`,
            ]);
          }
        }
      } catch (e: any) {
        setBackendHealth(null);
        if (prevHealthRef.current !== false) {
          prevHealthRef.current = false;
          setLogs((prev) => [
            ...prev,
            '[BACKEND DISCONNECTED] FastAPI backend unreachable at http://127.0.0.1:8000. Simulations disabled until backend is online.',
          ]);
        }
        if (isRunning || isStarting) {
          setIsRunning(false);
          setIsStarting(false);
          setActiveRunId(null);
          if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
          }
          addLog('[BACKEND DISCONNECTED] Active simulation aborted: backend connection lost.');
        }
      }
    };
    probe();
    const timer = setInterval(probe, 3000);
    return () => clearInterval(timer);
  }, [isRunning, isStarting]);

  // Ambient particle generator with soft violet, indigo, and cyan particles
  useEffect(() => {
    const container = document.getElementById('particles-bg');
    if (!container) return;
    const colors = ['#635BFF', '#7B61FF', '#10B981', '#F59E0B', '#3B82F6'];
    container.innerHTML = '';
    for (let i = 0; i < 24; i++) {
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
      if (activeRunId && backendHealth) {
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
      setIsStarting(false);
      setActiveRunId(null);
      addLog('[STOP] Simulation stopped by user.');
      return;
    }

    if (isStarting) {
      return;
    }

    setIsStarting(true);
    if (location.pathname !== '/simulation') {
      navigate('/simulation');
    }

    try {
      let liveHealth: BackendHealth;
      try {
        liveHealth = await apiService.checkHealth();
        setBackendHealth(liveHealth);
      } catch (err: any) {
        setBackendHealth(null);
        setIsStarting(false);
        setIsRunning(false);
        setActiveRunId(null);
        addLog(`[ERROR] Backend Disconnected: FastAPI backend is offline at http://127.0.0.1:8000 (${err?.message || 'Connection refused'}). Cannot start simulation.`);
        return;
      }

      if (!liveHealth?.ns3_engine?.ns3_detected) {
        setIsStarting(false);
        setIsRunning(false);
        setActiveRunId(null);
        addLog(`[ERROR] Backend Error: NS-3 engine not detected on backend (${liveHealth?.ns3_engine?.distro || 'WSL2'}). Cannot start simulation.`);
        return;
      }

      addLog(`[BACKEND] Dispatching ${config.protocol} run to FastAPI backend...`);
      const resp = await apiService.startSimulation(config);

      if (!resp || typeof resp.run_id !== 'string' || !resp.run_id.trim()) {
        throw new Error('Backend accepted request but returned an invalid or missing simulation run_id.');
      }

      const runId = resp.run_id.trim();
      setActiveRunId(runId);
      setIsRunning(true);
      setIsStarting(false);
      addLog(`[ACCEPTED] Run ${runId} accepted by backend with status: ${resp.status}`);

      const ws = apiService.connectWebSocket(
        runId,
        (data) => {
          if (data.type === 'log') {
            addLog(data.text);
          } else if (data.type === 'completed' && data.result) {
            setLatestResult(data.result);
            setIsRunning(false);
            setActiveRunId(null);
            addLog(`[COMPLETED] Run ${runId} completed. Results updated across dashboard.`);
            if (wsRef.current) wsRef.current.close();
          } else if (data.type === 'failed') {
            setIsRunning(false);
            setActiveRunId(null);
            addLog(`[FAILED] Run ${runId} execution failed: ${data.message || 'Check terminal log'}`);
            if (wsRef.current) wsRef.current.close();
          } else if (data.type === 'cancelled') {
            setIsRunning(false);
            setActiveRunId(null);
            addLog(`[CANCELLED] Run ${runId} was cancelled.`);
            if (wsRef.current) wsRef.current.close();
          }
        },
        () => {
          addLog(`[WS STATUS] WebSocket connection closed. Polling backend status fallback active.`);
        }
      );
      wsRef.current = ws;

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
            addLog(`[STATUS] Simulation ended with state: ${st.status}`);
          }
        } catch (e: any) {
          clearInterval(pollTimer);
          setIsRunning(false);
          setActiveRunId(null);
          setBackendHealth(null);
          addLog(`[BACKEND DISCONNECTED] Simulation aborted: Lost connection to FastAPI backend (${e.message || 'Network error'}).`);
        }
      }, 2000);
    } catch (e: any) {
      setIsStarting(false);
      setIsRunning(false);
      setActiveRunId(null);
      addLog(`[ERROR] Failed to start backend simulation: ${e.message}`);
    }
  };

  const handleSelectRun = async (runId: string) => {
    try {
      const res = await apiService.getSimulationResults(runId);
      setLatestResult(res);
      addLog(`[LOADED] Displaying historical metrics from run ${runId} (${res.protocol})`);
      navigate('/topology');
    } catch (e: any) {
      addLog(`[ERROR] Failed to load run ${runId}: ${e.message}`);
    }
  };

  return (
    <div className="relative min-h-screen bg-white text-slate-900 w-full flex flex-col overflow-x-hidden">
      {/* Subtle Ambient Background Particles */}
      <div id="particles-bg" className="bg-particles"></div>

      {/* Main Full-Width Application Container */}
      <div className="relative z-10 w-full flex-1 flex flex-col">
        {/* Top Navbar with Dark Pill Navigation */}
        <Navbar
            logs={logs}
            isRunning={isRunning}
            protocol={config.protocol}
            backendHealth={backendHealth}
            onOpenHistory={() => setHistoryOpen(true)}
            onViewLogs={() => navigate('/simulation')}
          />

          {/* Backend Disconnected Global Alert Banner */}
          {!backendHealth && (
            <div className="bg-rose-600 text-white px-6 py-2.5 text-xs sm:text-sm font-semibold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-inner border-b border-rose-700">
              <div className="flex items-center gap-2">
                <span className="bg-rose-800 text-rose-100 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded tracking-wide">
                  Backend Disconnected
                </span>
                <span>
                  FastAPI backend is offline at <code className="bg-rose-700 px-1.5 py-0.5 rounded font-mono text-xs">http://127.0.0.1:8000</code>. Real NS-3 simulations and history are disabled until the backend service is started.
                </span>
              </div>
              <div className="flex items-center gap-2 text-rose-200 text-xs font-mono">
                <span className="w-2 h-2 rounded-full bg-rose-300 animate-ping"></span>
                <span>Auto-reconnecting...</span>
              </div>
            </div>
          )}

          {/* Consistent Header Bar across all pages */}
          <HeaderBar />

          {/* Dynamic Page Router Content */}
          <main className="flex-1 flex flex-col bg-white">
            <Routes>
              <Route path="/" element={<Navigate to="/overview" replace />} />
              <Route
                path="/overview"
                element={
                  <OverviewPage
                    latestResult={latestResult}
                    isRunning={isRunning}
                    isStarting={isStarting}
                    activeRunId={activeRunId}
                    backendHealth={backendHealth}
                    config={config}
                  />
                }
              />
              <Route
                path="/simulation"
                element={
                  <SimulationPage
                    config={config}
                    onConfigChange={handleConfigChange}
                    isRunning={isRunning}
                    isStarting={isStarting}
                    activeRunId={activeRunId}
                    onToggleRun={handleToggleRun}
                    logs={logs}
                    onAddLog={addLog}
                    isBackendAvailable={Boolean(backendHealth?.ns3_engine.ns3_detected)}
                    latestResult={latestResult}
                  />
                }
              />
              <Route
                path="/analysis"
                element={
                  <AnalysisPage
                    isBackendAvailable={Boolean(backendHealth?.ns3_engine.ns3_detected)}
                    studioConfig={config}
                  />
                }
              />
              <Route
                path="/topology"
                element={
                  <TopologyPage
                    latestResult={latestResult}
                    isBackendAvailable={Boolean(backendHealth?.ns3_engine.ns3_detected)}
                    onSelectRun={handleSelectRun}
                  />
                }
              />
              <Route path="/algorithm" element={<AlgorithmPage />} />
              <Route path="*" element={<Navigate to="/overview" replace />} />
            </Routes>
          </main>

          {/* Footer */}
          {/* <Footer /> */}
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

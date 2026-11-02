import {
  SimulationConfig,
  SimulationResult,
  SimulationRunStatus,
  SimulationHistoryItem,
  SimulationMobilityTrace,
  SimulationLinkTrace,
  SimulationRoutingTrace,
  BackendHealth,
  SweepResult,
  SweepStartRequest,
} from '../types/simulation';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || API_BASE_URL.replace(/^http/, 'ws');

export const apiService = {
  getBaseUrl(): string {
    return API_BASE_URL;
  },

  async checkHealth(): Promise<BackendHealth> {
    const res = await fetch(`${API_BASE_URL}/api/health`);
    if (!res.ok) throw new Error(`Health check failed with status: ${res.status}`);
    return res.json();
  },

  async getSimulationConfig(): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/api/simulation/config`);
    if (!res.ok) throw new Error(`Failed to fetch simulation config: ${res.status}`);
    return res.json();
  },

  async startSimulation(config: SimulationConfig): Promise<{ run_id: string; status: string; message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/simulation/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Failed to start simulation');
    }
    return res.json();
  },

  async getSimulationStatus(runId: string): Promise<SimulationRunStatus> {
    const res = await fetch(`${API_BASE_URL}/api/simulation/${runId}/status`);
    if (!res.ok) throw new Error(`Failed to fetch status for run: ${runId}`);
    return res.json();
  },

  async getSimulationResults(runId: string): Promise<SimulationResult> {
    const res = await fetch(`${API_BASE_URL}/api/simulation/${runId}/results`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Results not yet available');
    }
    return res.json();
  },

  async getSimulationMobility(runId: string): Promise<SimulationMobilityTrace> {
    const res = await fetch(`${API_BASE_URL}/api/simulation/${runId}/mobility`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `Failed to fetch mobility trace for run: ${runId}`);
    }
    return res.json();
  },

  async getSimulationWirelessLinks(runId: string): Promise<SimulationLinkTrace> {
    const res = await fetch(`${API_BASE_URL}/api/simulation/${runId}/wireless-links`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `Failed to fetch wireless link trace for run: ${runId}`);
    }
    return res.json();
  },

  async getSimulationRoutingTrace(runId: string): Promise<SimulationRoutingTrace> {
    const res = await fetch(`${API_BASE_URL}/api/simulation/${runId}/routing-trace`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `Failed to fetch routing and data-flow trace for run: ${runId}`);
    }
    return res.json();
  },

  async cancelSimulation(runId: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/simulation/${runId}/cancel`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to cancel simulation: ${runId}`);
    return res.json();
  },

  async getSimulationHistory(limit: number = 30): Promise<SimulationHistoryItem[]> {
    const res = await fetch(`${API_BASE_URL}/api/simulation/history?limit=${limit}`);
    if (!res.ok) throw new Error(`Failed to fetch simulation history: ${res.status}`);
    return res.json();
  },

  async startSweep(request: SweepStartRequest): Promise<{ sweep_id: string; status: string; message: string; parameter: string }> {
    const res = await fetch(`${API_BASE_URL}/api/simulation/sweep/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Failed to start simulation sweep');
    }
    return res.json();
  },

  async getSweepStatus(sweepId: string): Promise<SweepResult> {
    const res = await fetch(`${API_BASE_URL}/api/simulation/sweep/${sweepId}/status`);
    if (!res.ok) throw new Error(`Failed to fetch sweep status: ${res.status}`);
    return res.json();
  },

  async getLatestSweep(parameter: string): Promise<SweepResult | null> {
    const res = await fetch(`${API_BASE_URL}/api/simulation/sweep/latest?parameter=${parameter}`);
    if (!res.ok) throw new Error(`Failed to fetch latest sweep: ${res.status}`);
    return res.json();
  },

  async cancelSweep(sweepId: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/simulation/sweep/${sweepId}/cancel`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to cancel sweep: ${sweepId}`);
    return res.json();
  },

  connectWebSocket(runId: string, onMessage: (data: any) => void, onError?: (err: any) => void): WebSocket {
    const ws = new WebSocket(`${WS_BASE_URL}/ws/simulation/${runId}`);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (e) {
        onMessage({ type: 'raw', text: event.data });
      }
    };
    if (onError) {
      ws.onerror = onError;
      ws.onclose = () => onError(new Error('WebSocket connection closed'));
    }
    return ws;
  },
};

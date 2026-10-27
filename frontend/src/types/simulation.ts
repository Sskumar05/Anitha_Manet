export type ProtocolType = 'AODV' | 'eAODV' | 'BOTH';

export type SimulationStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface SimulationConfig {
  protocol: ProtocolType;
  node_count: number;
  mobility_speed: number;
  simulation_area: number;
  simulation_time: number;
  rng_seed: number;
  is_demo: boolean;
}

export interface SimulationResult {
  run_id: string;
  protocol: string;
  status: SimulationStatus;
  node_count: number;
  mobility_speed: number;
  simulation_area: number;
  simulation_time: number;
  pdr: number;
  delay_ms: number;
  overhead_ratio: number;
  energy_consumed_j: number;
  remaining_energy_percent: number;
  tx_packets: number;
  rx_packets: number;
  dropped_packets: number;
  execution_duration_s: number;
  is_demo: boolean;
  output_xml_path?: string;
  output_energy_path?: string;
  created_at: string;
}

export interface SimulationRunStatus {
  run_id: string;
  status: SimulationStatus;
  protocol: string;
  progress_percent: number;
  current_step: string;
  logs: string[];
  created_at: string;
  updated_at: string;
}

export interface SimulationHistoryItem {
  run_id: string;
  protocol: string;
  node_count: number;
  mobility_speed: number;
  simulation_area: number;
  status: SimulationStatus;
  pdr?: number;
  delay_ms?: number;
  overhead_ratio?: number;
  energy_consumed_j?: number;
  is_demo: boolean;
  created_at: string;
}

export interface BackendHealth {
  status: string;
  service: string;
  version: string;
  ns3_engine: {
    wsl_available: boolean;
    ns3_detected: boolean;
    distro: string;
    ns3_dir: string;
    details: string;
  };
}

export interface ScenarioDataset {
  labels: string[];
  pdr: { aodv: number[]; eaodv: number[] };
  delay: { aodv: number[]; eaodv: number[] };
  overhead: { aodv: number[]; eaodv: number[] };
  energy: { aodv: number[]; eaodv: number[] };
  xTitle?: string;
}

export interface ScenariosMap {
  speed: ScenarioDataset;
  nodes: ScenarioDataset;
  traffic: ScenarioDataset;
}

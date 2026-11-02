export type ProtocolType = 'AODV' | 'eAODV' | 'BOTH';

export type SimulationStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface SimulationConfig {
  protocol: ProtocolType;
  node_count: number;
  mobility_speed: number;
  simulation_area: number;
  simulation_time: number;
  rng_seed: number;
  traffic_flows?: number;
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
  delay_ms: number | null;
  overhead_ratio: number | null;
  routing_packets?: number | null;
  metric_version?: number;
  energy_consumed_j: number;
  remaining_energy_percent: number;
  tx_packets: number;
  rx_packets: number;
  dropped_packets: number;
  execution_duration_s: number;
  is_demo?: boolean;
  output_xml_path?: string;
  output_energy_path?: string;
  output_routing_path?: string;
  output_mobility_path?: string;
  output_link_path?: string;
  output_routing_trace_path?: string;
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
  delay_ms?: number | null;
  overhead_ratio?: number | null;
  routing_packets?: number | null;
  metric_version?: number;
  energy_consumed_j?: number;
  is_demo?: boolean;
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
  pdr: { aodv: (number | null)[]; eaodv: (number | null)[] };
  delay: { aodv: (number | null)[]; eaodv: (number | null)[] };
  overhead: { aodv: (number | null)[]; eaodv: (number | null)[] };
  energy: { aodv: (number | null)[]; eaodv: (number | null)[] };
  xTitle?: string;
}

export interface ScenariosMap {
  speed?: ScenarioDataset;
  nodes?: ScenarioDataset;
  traffic?: ScenarioDataset;
}

export type SweepParameter = 'speed' | 'nodes' | 'traffic';
export type SweepStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface SweepRunPoint {
  parameter_value: number;
  parameter_label: string;
  aodv_run_id?: string;
  eaodv_run_id?: string;
  aodv_result?: SimulationResult;
  eaodv_result?: SimulationResult;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface SweepResult {
  sweep_id: string;
  parameter: SweepParameter;
  parameter_label: string;
  unit: string;
  x_title: string;
  status: SweepStatus;
  points: SweepRunPoint[];
  total_runs: number;
  completed_runs: number;
  progress_percent: number;
  current_step: string;
  created_at: string;
  completed_at?: string;
  error_message?: string;
  base_config: Record<string, any>;
}

export type SweepConfigMode = 'default' | 'studio';

export interface SweepStartRequest {
  parameter: SweepParameter;
  config_mode?: SweepConfigMode;
  studio_config?: SimulationConfig;
  points?: number[];
  simulation_time?: number;
  rng_seed?: number;
}

export interface NodePosition {
  time: number;
  x: number;
  y: number;
  z: number;
}

export interface NodeMobility {
  node_id: number;
  positions: NodePosition[];
}

export interface SimulationMobilityTrace {
  run_id: string;
  protocol: string;
  simulation_duration: number;
  sim_area?: number;
  node_count: number;
  total_position_records: number;
  trace_type: string;
  metric_version: number;
  nodes: NodeMobility[];
}

export interface WirelessLinkEvent {
  time: number;
  event_type: 'tx' | 'rx_ok' | 'rx_drop' | 'transmission_attempt' | 'successful_reception' | 'failed_reception' | string;
  packet_uid: number;
  source_node_id: number;
  destination_node_id: number;
  packet_size_bytes: number;
  frame_type: string;
  is_broadcast: boolean;
  snr_db?: number | null;
}

export interface SimulationLinkTrace {
  run_id: string;
  protocol: string;
  simulation_duration: number;
  sim_area: number;
  node_count: number;
  total_events: number;
  total_tx_attempts: number;
  total_rx_success: number;
  total_rx_drop: number;
  trace_type: string;
  metric_version: number;
  events: WirelessLinkEvent[];
}

export interface RoutingHopEvent {
  time: number;
  event_type: 'data_send' | 'data_forward' | 'data_reinject' | 'data_delivered' | 'data_drop' | 'rreq_tx' | 'rreq_rx' | 'rrep_tx' | 'rrep_rx' | 'rerr_tx' | 'rerr_rx' | string;
  node_id: number;
  prev_hop?: number | null;
  next_hop?: number | null;
  packet_uid: number;
  packet_size: number;
  source_ip: string;
  dest_ip: string;
  ttl: number;
  hop_count: number;
  seq_no: number;
  details: string;
}

export interface SimulationRoutingTrace {
  run_id: string;
  protocol: string;
  simulation_duration: number;
  sim_area?: number;
  node_count: number;
  total_events: number;
  total_data_events: number;
  total_routing_events: number;
  trace_type: string;
  metric_version: number;
  events: RoutingHopEvent[];
}

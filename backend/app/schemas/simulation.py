from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class ProtocolType(str, Enum):
    AODV = "AODV"
    eAODV = "eAODV"
    BOTH = "BOTH"

class SimulationStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class SimulationConfig(BaseModel):
    protocol: ProtocolType = Field(default=ProtocolType.eAODV, description="Routing protocol to evaluate")
    node_count: int = Field(default=50, ge=4, le=150, description="Number of mobile wireless nodes")
    mobility_speed: float = Field(default=10.0, ge=0.5, le=35.0, description="Max node speed in m/s")
    simulation_area: int = Field(default=1000, description="Simulation grid square area in meters (500, 1000, 2000)")
    simulation_time: float = Field(default=30.0, ge=5.0, le=120.0, description="Simulation duration in seconds")
    rng_seed: int = Field(default=1, ge=1, le=999999, description="Random number generator seed")
    is_demo: bool = Field(default=False, description="Flag indicating fallback client demo simulation")
    traffic_flows: Optional[int] = Field(default=None, ge=1, le=50, description="Number of CBR traffic flows")

class MetricComparison(BaseModel):
    metric_name: str
    baseline_value: float
    enhanced_value: float
    unit: str
    delta_percent: float
    improvement_direction: str

class SimulationResult(BaseModel):
    run_id: str
    protocol: str
    status: SimulationStatus
    node_count: int
    mobility_speed: float
    simulation_area: int
    simulation_time: float
    pdr: float = Field(description="Packet Delivery Ratio percentage (0 - 100%)")
    delay_ms: Optional[float] = Field(default=None, description="Average end-to-end packet delay in milliseconds")
    overhead_ratio: Optional[float] = Field(default=None, description="Routing control packets per delivered data packet (Normalized Routing Load)")
    energy_consumed_j: float = Field(description="Average energy consumed per node in Joules")
    remaining_energy_percent: float = Field(description="Average residual battery percentage")
    tx_packets: int
    rx_packets: int
    dropped_packets: int
    routing_packets: Optional[int] = Field(default=None, description="Directly measured routing control packet transmissions")
    metric_version: int = Field(default=2, description="Metric version: 1 = legacy aggregate/heuristic, 2 = pure CBR PDR/delay and measured NRL")
    execution_duration_s: float
    is_demo: bool
    output_xml_path: Optional[str] = None
    output_energy_path: Optional[str] = None
    output_routing_path: Optional[str] = None
    output_mobility_path: Optional[str] = None
    output_link_path: Optional[str] = None
    output_routing_trace_path: Optional[str] = None
    created_at: str

class SimulationRunStatus(BaseModel):
    run_id: str
    status: SimulationStatus
    protocol: str
    progress_percent: int
    current_step: str
    logs: List[str] = []
    created_at: str
    updated_at: str

class SimulationHistoryItem(BaseModel):
    run_id: str
    protocol: str
    node_count: int
    mobility_speed: float
    simulation_area: int
    status: SimulationStatus
    pdr: Optional[float] = None
    delay_ms: Optional[float] = None
    overhead_ratio: Optional[float] = None
    energy_consumed_j: Optional[float] = None
    routing_packets: Optional[int] = None
    metric_version: int = Field(default=1)
    is_demo: bool
    created_at: str

class SweepParameter(str, Enum):
    SPEED = "speed"
    NODES = "nodes"
    TRAFFIC = "traffic"

class SweepStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class SweepConfigMode(str, Enum):
    DEFAULT = "default"
    STUDIO = "studio"

class SweepRunPoint(BaseModel):
    parameter_value: float
    parameter_label: str
    aodv_run_id: Optional[str] = None
    eaodv_run_id: Optional[str] = None
    aodv_result: Optional[SimulationResult] = None
    eaodv_result: Optional[SimulationResult] = None
    status: str = "pending"  # pending | running | completed | failed

class SweepResult(BaseModel):
    sweep_id: str
    parameter: SweepParameter
    parameter_label: str
    unit: str
    x_title: str
    status: SweepStatus
    points: List[SweepRunPoint]
    total_runs: int
    completed_runs: int
    progress_percent: int = 0
    current_step: str = ""
    created_at: str
    completed_at: Optional[str] = None
    error_message: Optional[str] = None
    base_config: Dict[str, Any] = {}

class SweepStartRequest(BaseModel):
    parameter: SweepParameter = Field(..., description="Parameter to sweep: 'speed', 'nodes', or 'traffic'")
    config_mode: SweepConfigMode = Field(default=SweepConfigMode.DEFAULT, description="Configuration mode: 'default' or 'studio'")
    studio_config: Optional[SimulationConfig] = Field(default=None, description="Studio configuration when config_mode=='studio'")
    points: Optional[List[float]] = Field(default=None, description="Optional custom parameter points")
    simulation_time: float = Field(default=5.0, ge=5.0, le=120.0, description="Per-point simulation duration in seconds")
    rng_seed: int = Field(default=1, ge=1, le=999999, description="Random number generator seed for scientific reproducibility")

class NodePosition(BaseModel):
    time: float = Field(description="Simulation timestamp in seconds")
    x: float = Field(description="X coordinate in meters")
    y: float = Field(description="Y coordinate in meters")
    z: float = Field(default=0.0, description="Z coordinate in meters")

class NodeMobility(BaseModel):
    node_id: int = Field(description="Unique NS-3 Node ID")
    positions: List[NodePosition] = Field(description="Timestamped trajectory points for this node")

class SimulationMobilityTrace(BaseModel):
    run_id: str = Field(description="Unique simulation run identifier")
    protocol: str = Field(description="Routing protocol evaluated (AODV / eAODV)")
    simulation_duration: float = Field(description="Total simulation duration in seconds")
    sim_area: Optional[float] = Field(default=None, description="Simulation grid area size in meters")
    node_count: int = Field(description="Total number of mobile nodes")
    total_position_records: int = Field(description="Total recorded position events across all nodes")
    trace_type: str = Field(default="ns3_node_mobility", description="Trace format identifier")
    metric_version: int = Field(default=1, description="Mobility trace schema version")
    nodes: List[NodeMobility] = Field(description="List of node trajectory records")

class WirelessLinkEvent(BaseModel):
    time: float = Field(description="Simulation timestamp in seconds")
    event_type: str = Field(description="Type of wireless event: 'tx', 'rx_ok', 'rx_drop'")
    packet_uid: int = Field(default=0, description="NS-3 globally unique packet UID")
    source_node_id: int = Field(description="Transmitting node ID (-1 if broadcast or unresolvable)")
    destination_node_id: int = Field(description="Receiving / intended node ID (-1 if broadcast or unresolvable)")
    packet_size_bytes: int = Field(default=0, description="Size of packet in bytes")
    frame_type: str = Field(default="DATA", description="Wi-Fi frame type string")
    is_broadcast: bool = Field(default=False, description="Whether the transmission was broadcast")
    snr_db: Optional[float] = Field(default=None, description="Signal-to-noise ratio in dB for reception events")

    # Compatibility aliases
    @property
    def packet_id(self) -> int:
        return self.packet_uid

    @property
    def packet_size(self) -> int:
        return self.packet_size_bytes

class SimulationLinkTrace(BaseModel):
    run_id: str = Field(description="Unique simulation run identifier")
    protocol: str = Field(description="Routing protocol evaluated (AODV / eAODV)")
    simulation_duration: float = Field(description="Total simulation duration in seconds")
    sim_area: Optional[float] = Field(default=None, description="Simulation grid area size in meters")
    node_count: int = Field(description="Total number of mobile nodes")
    total_events: int = Field(description="Total wireless communication events recorded")
    total_tx_attempts: int = Field(default=0, description="Total transmission attempts")
    total_rx_success: int = Field(default=0, description="Total successful packet receptions")
    total_rx_drop: int = Field(default=0, description="Total dropped/failed receptions")
    trace_type: str = Field(default="ns3_wireless_link_trace", description="Trace format identifier")
    metric_version: int = Field(default=1, description="Trace schema version")
    events: List[WirelessLinkEvent] = Field(description="List of chronological wireless transmission and reception events")

class RoutingHopEvent(BaseModel):
    time: float = Field(description="Simulation timestamp in seconds")
    event_type: str = Field(description="Event type: 'data_send', 'data_forward', 'data_reinject', 'data_delivered', 'data_drop', 'rreq_tx', 'rreq_rx', 'rrep_tx', 'rrep_rx', 'rerr_tx', 'rerr_rx'")
    node_id: int = Field(description="Node recording or performing this routing/forwarding action")
    prev_hop: Optional[int] = Field(default=None, description="Immediate previous hop node ID, if known")
    next_hop: Optional[int] = Field(default=None, description="Immediate next hop node ID, if known")
    packet_uid: int = Field(default=0, description="NS-3 globally unique packet UID")
    packet_size: int = Field(default=0, description="Packet size in bytes")
    source_ip: str = Field(default="", description="Source IP address")
    dest_ip: str = Field(default="", description="Destination IP address")
    ttl: int = Field(default=0, description="Time to live / hop limit")
    hop_count: int = Field(default=0, description="Routing protocol hop count")
    seq_no: int = Field(default=0, description="Sequence number")
    details: str = Field(default="", description="Diagnostic details or drop reason")

class SimulationRoutingTrace(BaseModel):
    run_id: str = Field(description="Unique simulation run identifier")
    protocol: str = Field(description="Routing protocol evaluated (AODV / eAODV)")
    simulation_duration: float = Field(description="Total simulation duration in seconds")
    sim_area: Optional[float] = Field(default=None, description="Simulation grid area size in meters")
    node_count: int = Field(description="Total number of mobile nodes")
    total_events: int = Field(description="Total routing and data-forwarding events recorded")
    total_data_events: int = Field(default=0, description="Total CBR data transmission, forwarding, delivery, and drop events")
    total_routing_events: int = Field(default=0, description="Total AODV routing control events (RREQ, RREP, RERR)")
    trace_type: str = Field(default="ns3_routing_and_forwarding_events", description="Trace format identifier")
    metric_version: int = Field(default=1, description="Trace schema version")
    events: List[RoutingHopEvent] = Field(description="List of chronological routing and forwarding hop events")

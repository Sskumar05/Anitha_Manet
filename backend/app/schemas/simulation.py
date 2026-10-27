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
    delay_ms: float = Field(description="Average end-to-end packet delay in milliseconds")
    overhead_ratio: float = Field(description="Routing control packets per delivered data packet")
    energy_consumed_j: float = Field(description="Average energy consumed per node in Joules")
    remaining_energy_percent: float = Field(description="Average residual battery percentage")
    tx_packets: int
    rx_packets: int
    dropped_packets: int
    execution_duration_s: float
    is_demo: bool
    output_xml_path: Optional[str] = None
    output_energy_path: Optional[str] = None
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
    is_demo: bool
    created_at: str

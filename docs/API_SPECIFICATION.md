# MANET Research Dashboard — REST & WebSocket API Specification

**Base URL:** `http://localhost:8000`  
**WebSocket URL:** `ws://localhost:8000`  
**Interactive Docs:** `http://localhost:8000/docs` (Swagger UI) / `http://localhost:8000/redoc`

---

## 1. Health & Configuration Endpoints

### `GET /api/health`
Checks backend service availability and probes the NS-3 engine installation in WSL2.

**Response `200 OK`:**
```json
{
  "status": "healthy",
  "service": "MANET Routing Research Backend",
  "version": "2.0.0",
  "ns3_engine": {
    "wsl_available": true,
    "ns3_detected": true,
    "distro": "Ubuntu",
    "ns3_dir": "/home/kumar/MANET/ns-3/ns-allinone-3.41/ns-3.41",
    "details": "NS-3 detected in WSL2 (Ubuntu) at /home/kumar/MANET/ns-3/ns-allinone-3.41/ns-3.41"
  }
}
```

---

### `GET /api/simulation/config`
Retrieves allowable configuration ranges, supported protocols, area presets, and baseline comparison datasets.

**Response `200 OK`:**
```json
{
  "protocols": ["AODV", "eAODV", "BOTH"],
  "node_count": { "min": 10, "max": 100, "default": 50, "step": 5 },
  "mobility_speed": { "min": 1.0, "max": 25.0, "default": 10.0, "unit": "m/s", "step": 1.0 },
  "simulation_area": [
    { "value": 500, "label": "500×500m (Dense)" },
    { "value": 1000, "label": "1000×1000m (Standard)", "default": true },
    { "value": 2000, "label": "2000×2000m (Sparse)" }
  ],
  "default_scenarios": { ... }
}
```

---

## 2. Simulation Lifecycle Endpoints

### `POST /api/simulation/start`
Queues a new simulation run.

**Request Body (`application/json`):**
```json
{
  "protocol": "eAODV",
  "node_count": 50,
  "mobility_speed": 10.0,
  "simulation_area": 1000,
  "simulation_time": 30.0,
  "rng_seed": 1,
  "is_demo": false
}
```

**Response `202 Accepted`:**
```json
{
  "run_id": "sim_1793121209_947024",
  "status": "queued",
  "message": "Simulation sim_1793121209_947024 has been queued successfully.",
  "protocol": "eAODV",
  "is_demo": false
}
```

---

### `GET /api/simulation/{run_id}/status`
Polls active execution status, progress percentage, and latest stdout logs.

**Response `200 OK`:**
```json
{
  "run_id": "sim_1793121209_947024",
  "status": "running",
  "protocol": "eAODV",
  "progress_percent": 45,
  "current_step": "Routing discovery & packet transmission",
  "logs": [
    "[INIT] Energy-Aware AODV (eAODV) Simulation: Nodes=50...",
    "[SIM] Running eAODV enhanced simulation for 30s..."
  ],
  "created_at": "2026-10-27T17:10:00.000Z",
  "updated_at": "2026-10-27T17:10:15.000Z"
}
```

---

### `GET /api/simulation/{run_id}/results`
Fetches final parsed metrics for a completed simulation.

**Response `200 OK`:**
```json
{
  "run_id": "sim_1793121209_947024",
  "protocol": "eAODV",
  "status": "completed",
  "node_count": 50,
  "mobility_speed": 10.0,
  "simulation_area": 1000,
  "simulation_time": 30.0,
  "pdr": 91.4,
  "delay_ms": 42.0,
  "overhead_ratio": 0.31,
  "energy_consumed_j": 1.24,
  "remaining_energy_percent": 87.6,
  "tx_packets": 1000,
  "rx_packets": 914,
  "dropped_packets": 86,
  "execution_duration_s": 14.85,
  "is_demo": false,
  "output_xml_path": "results/sim_1793121209_947024/flowmon_results.xml",
  "output_energy_path": "results/sim_1793121209_947024/energy_results.csv",
  "created_at": "2026-10-27T17:10:00.000Z"
}
```

**Error `409 Conflict`:**
Returned if the simulation has not yet completed execution.

---

### `POST /api/simulation/{run_id}/cancel`
Terminates a currently running simulation subprocess.

**Response `200 OK`:**
```json
{
  "message": "Simulation 'sim_1793121209_947024' was cancelled.",
  "run_id": "sim_1793121209_947024"
}
```

---

### `GET /api/simulation/history`
Returns historical runs stored in the SQLite database.

**Query Parameters:**
- `limit` (integer, default: 30, range: 1–100)

**Response `200 OK`:**
```json
[
  {
    "run_id": "sim_1793121209_947024",
    "protocol": "eAODV",
    "node_count": 50,
    "mobility_speed": 10.0,
    "simulation_area": 1000,
    "status": "completed",
    "pdr": 91.4,
    "delay_ms": 42.0,
    "overhead_ratio": 0.31,
    "energy_consumed_j": 1.24,
    "is_demo": false,
    "created_at": "2026-10-27T17:10:00.000Z"
  }
]
```

---

## 3. WebSocket Real-Time Stream

### `WS /ws/simulation/{run_id}`
Real-time bi-directional streaming endpoint.

**Server to Client Messages:**
- Log Event:
  ```json
  {
    "type": "log",
    "text": "[eAODV] Time 15.0s: Node 7 low battery -> route penalised",
    "progress": 55,
    "step": "Routing transmission"
  }
  ```
- Completion Event:
  ```json
  {
    "type": "completed",
    "result": { ... SimulationResult ... }
  }
  ```
- Cancellation Event:
  ```json
  {
    "type": "cancelled",
    "run_id": "sim_1793121209_947024"
  }
  ```

**Client to Server Messages:**
- `ping`: Heartbeat keeping connection alive.
- `cancel`: Requests abort of active simulation.

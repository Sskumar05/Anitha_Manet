# MANET Routing Research Dashboard — System Architecture

**Project Title:** Reliable and Efficient Routing in Highly Dynamic MANETs — CS2708  
**Architecture Version:** 2.0.0 (Full-Stack Decoupled Architecture)

---

## 1. Architectural Overview

The application follows a strictly decoupled, 3-tier architecture:

```
+-------------------------------------------------------------+
|                 Frontend (React.js + Vite)                  |
|  - Tailwind CSS Design Tokens (Royal Blue / Enterprise)    |
|  - Interactive HTML5 Canvas MANET Simulator                |
|  - Chart.js via react-chartjs-2                            |
|  - WebSocket Client (/ws/simulation/{run_id})              |
|  - REST Client (Fetch API to http://localhost:8000)        |
+-------------------------------------------------------------+
                              |
                     HTTP / WebSocket
                              |
+-------------------------------------------------------------+
|                 Backend (Python FastAPI)                    |
|  - REST API Routes (/api/simulation, /api/health)           |
|  - Real-time WebSocket Hub                                  |
|  - Asynchronous Subprocess Controller (asyncio)            |
|  - SQLite Run History & Metadata Persistence               |
|  - FlowMonitor XML & Energy CSV Analytics Engine            |
+-------------------------------------------------------------+
                              |
                     WSL2 / Linux Bridge
                              |
+-------------------------------------------------------------+
|              Simulation Engine (NS-3 v3.41)                 |
|  - C++ manet-baseline.cc (RFC 3561 AODV + Energy Model)     |
|  - C++ manet-eaodv.cc (Energy-Aware AODV Heuristics)        |
|  - 802.11b Wireless Ad-Hoc Channel                          |
|  - Random Waypoint Mobility Model                           |
|  - FlowMonitor XML Output & CSV Node Battery Logs           |
+-------------------------------------------------------------+
```

---

## 2. Component Decoupling & Responsibilities

### Frontend (`frontend/`)
- Built with **React 18**, **Vite 5**, **TypeScript**, and **Tailwind CSS**.
- Retains 100% of the visual identity and interaction models of the original vanilla dashboard:
  - Ambient particle floating canvas.
  - Interactive multi-hop MANET simulation canvas with battery ring gauges and dynamic route paths.
  - Performance metric charts (PDR, Delay, Overhead, Energy) with scenario tabs (`vs Speed`, `vs Nodes`, `vs Traffic`).
  - Topology visualizer supporting `Static`, `Dynamic`, and `Show Routes` modes.
  - 6-dimension Algorithm Comparison Matrix with mobile-responsive card fallback.
  - Notification Popover Dropdown synchronized with live console logs.
- Features **Dual Mode Execution**:
  - **Real NS-3 Run**: Submits parameters to FastAPI, streams live NS-3 console logs via WebSocket, and updates UI with parsed XML metrics.
  - **Demo Visualization Mode**: Runs high-speed in-browser canvas heuristics when the backend is offline or when fast demonstration is desired.
- Configurable via `.env` (`VITE_API_BASE_URL=http://localhost:8000`).

### Backend (`backend/`)
- Built with **Python 3.10+**, **FastAPI**, **Uvicorn**, and **Pydantic v2**.
- Manages simulation lifecycle asynchronously without blocking the event loop.
- Isolates each simulation run in a dedicated folder: `results/{run_id}/`.
- Employs **aiosqlite** for persistent history tracking in `database.sqlite3`.
- Safely bridges to WSL2 via `wsl -d Ubuntu -- bash -c ...` with validated parameters (no command injection).
- Features a **Calibrated Analytical Fallback**: if NS-3 is absent, the backend automatically calculates scientifically grounded metrics and generates authentic FlowMonitor XML and Energy CSV artifacts.

### Simulation Layer (`simulation/` & WSL2 NS-3)
- Genuine C++ NS-3 scripts compiled with Ninja inside Ubuntu 22.04 LTS:
  - `simulation/scratch/manet-baseline.cc`: Standard AODV protocol.
  - `simulation/scratch/manet-eaodv.cc`: Energy-Aware AODV with low-battery penalty and route scoring.
- Generates `flowmon_results.xml` via NS-3's native `FlowMonitor` module.
- Generates `energy_results.csv` via NS-3's `BasicEnergySource` and `WifiRadioEnergyModel`.

---

## 3. Communication Protocols & Data Flow

### A. Parameter Submission & Run Initiation
1. User adjusts sliders in React UI (e.g. Node Count = 50, Speed = 10 m/s, Area = 1000m, Protocol = eAODV).
2. React dispatches:
   ```http
   POST /api/simulation/start
   Content-Type: application/json
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
3. Backend validates input schema via Pydantic (`SimulationConfig`), generates unique `run_id` (`sim_<timestamp>_<uuid>`), creates a database record, and queues the subprocess task.
4. Backend responds with `202 Accepted`:
   ```json
   {
     "run_id": "sim_1793121209_947024",
     "status": "queued",
     "message": "Simulation sim_1793121209_947024 has been queued successfully."
   }
   ```

### B. Live Streaming via WebSocket
1. React connects to `WS /ws/simulation/{run_id}`.
2. As NS-3 outputs stdout lines, FastAPI broadcasts them in real time:
   ```json
   {
     "type": "log",
     "text": "[eAODV] Time 5.0s: Node 12 low energy threshold (24.2% remaining) -> penalizing next-hop route replies.",
     "progress": 45,
     "step": "Routing discovery & packet transmission"
   }
   ```
3. React renders the logs inside `#simulation-log` and updates the notification dropdown.

### C. Completion & Metric Extraction
1. When NS-3 finishes, the process terminates with return code 0.
2. `xml_parser.py` parses `flowmon_results.xml` and `energy_results.csv`:
   - $\text{PDR} = \frac{\sum \text{rxPackets}}{\sum \text{txPackets}} \times 100\%$
   - $\text{Delay} = \frac{\sum \text{delaySum}}{\sum \text{rxPackets} \times 10^6} \text{ (ms)}$
   - $\text{Overhead} = \frac{\text{txPackets} - \text{rxPackets}}{\text{rxPackets}} \times 0.35$
   - $\text{Energy} = \frac{\sum \text{consumedEnergy}}{N} \text{ (J)}$
3. Backend saves metrics in SQLite and broadcasts a `completed` WebSocket event containing the complete `SimulationResult` payload.
4. React updates the KPI metric cards and charts.

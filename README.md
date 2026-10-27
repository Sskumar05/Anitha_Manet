# MANET Routing Research Dashboard (Full-Stack Edition)
### Reliable and Efficient Routing in Highly Dynamic MANETs — CS2708

> **Energy-Aware AODV (eAODV)** vs Standard AODV — Decoupled React.js Frontend, Python FastAPI Backend, and NS-3 Simulation Engine

---

## 👥 Research Team
| Name | Role |
|---|---|
| Anitha G | Developer & Researcher |
| Elanthalir K | Developer & Researcher |
| Harini G.P | Developer & Researcher |
| **Guide: Dr. Sugumaran V.R** | Project Supervisor |

**Batch:** CS2708 | Department of Computer Science & Engineering

---

## 📌 Project Overview

This project designs, simulates, and evaluates an **Energy-Aware variant of AODV (eAODV)** routing protocol for Mobile Ad-hoc Networks (MANETs). Standard AODV breaks down under high mobility — frequent link breakages trigger heavy control packet floods and battery depletion. eAODV enhances performance by:

- Factoring **residual node energy** into route reply (RREP) weighting
- Penalizing low-battery intermediate relay nodes
- Balancing power load across the ad-hoc topology
- Validating performance via **NS-3 v3.41** simulation across mobility speeds (1–25 m/s) and node densities (10–100 nodes).

---

## 🏗️ Architecture & Decoupling

The project supports two independent execution options:

1. **Option A: Full-Stack Integrated React + FastAPI + NS-3 (Recommended)**
   - **Frontend:** React 18, Vite 5, TypeScript, Tailwind CSS, react-chartjs-2
   - **Backend:** Python 3.10+, FastAPI, Uvicorn, Pydantic, aiosqlite, WebSockets
   - **Simulation:** C++ NS-3 scripts (`manet-baseline.cc`, `manet-eaodv.cc`) executed via WSL2 Ubuntu 22.04 LTS
2. **Option B: Original Standalone HTML/CSS/JS Demo**
   - Preserved in `dashboard/index.html` (zero dependencies, runs in any browser).

---

## 🚀 Running the Full-Stack Application

### 1. Start the FastAPI Backend
In a terminal:
```bash
cd backend

# Create & activate Python virtual environment (Windows PowerShell)
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Start backend server
uvicorn app.main:app --reload --port 8000
```
- API Base URL: `http://localhost:8000`
- Interactive Swagger Docs: `http://localhost:8000/docs`
- Health Endpoint: `http://localhost:8000/api/health`

### 2. Start the React Frontend
In a separate terminal:
```bash
cd frontend

# Install Node dependencies
npm install

# Start Vite dev server
npm run dev
```
- Frontend URL: `http://localhost:5173`
- Environment Config: `frontend/.env` (`VITE_API_BASE_URL=http://localhost:8000`)

---

## 🔬 NS-3 C++ Simulation Engine Setup

The backend uses NS-3 v3.41 installed in WSL2 Ubuntu. The simulation scripts are provided in `simulation/scratch/`:

- `simulation/scratch/manet-baseline.cc`: Baseline standard AODV protocol simulation with FlowMonitor and BasicEnergySource.
- `simulation/scratch/manet-eaodv.cc`: Energy-Aware AODV protocol simulation with residual battery weighting.

### Build and Test NS-3 Manually in WSL2:
```bash
# Inside WSL Ubuntu terminal:
cd /home/kumar/MANET/ns-3/ns-allinone-3.41/ns-3.41

# Run baseline simulation:
./ns3 run "scratch/manet-baseline --nNodes=20 --simulationTime=10"

# Run enhanced eAODV simulation:
./ns3 run "scratch/manet-eaodv --nNodes=20 --simulationTime=10"
```

---

## 🧪 Automated Test Suite

Run backend unit and end-to-end integration tests:
```bash
# From workspace root:
$env:PYTHONPATH='backend'
.\.venv\Scripts\pytest.exe backend\tests -v
```
Tests cover:
- Backend health and environment verification (`test_health_check`)
- Configuration ranges and defaults (`test_simulation_config`)
- Asynchronous demo simulation lifecycle (`test_demo_simulation_lifecycle`)
- FlowMonitor XML and energy CSV parsing accuracy (`test_xml_and_energy_parser`)
- Genuine end-to-end NS-3 simulation execution via WSL2 (`test_real_ns3_simulation_execution`)

---

## 📁 Repository Directory Structure

```
MANET/
├── backend/                             # Python FastAPI Backend
│   ├── app/
│   │   ├── api/                         # REST & WebSocket endpoints
│   │   ├── core/                        # Configuration settings
│   │   ├── schemas/                     # Pydantic data schemas
│   │   ├── services/                    # Process management, DB, and XML parsing
│   │   └── main.py                      # FastAPI entrypoint
│   ├── tests/                           # Pytest automated test suite
│   ├── database.sqlite3                 # Persistent simulation history
│   └── requirements.txt                 # Backend dependencies
│
├── frontend/                            # React.js + Vite + TypeScript Frontend
│   ├── src/
│   │   ├── components/                  # Navbar, Canvas, Charts, Topology, Matrix
│   │   ├── services/                    # API & WebSocket client
│   │   ├── types/                       # TypeScript definitions
│   │   ├── App.tsx                      # Root application layout
│   │   ├── main.tsx                     # React DOM entrypoint
│   │   └── index.css                    # Tailwind CSS directives & tokens
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
│
├── simulation/                          # C++ NS-3 Simulation Workspace
│   └── scratch/
│       ├── manet-baseline.cc            # Standard AODV simulation
│       └── manet-eaodv.cc               # Energy-Aware AODV simulation
│
├── results/                             # Simulation outputs (XML, CSV)
├── docs/                                # Architecture & API Specifications
│   ├── ARCHITECTURE.md
│   └── API_SPECIFICATION.md
│
├── dashboard/                           # Original Vanilla HTML/CSS/JS Demo (Preserved)
│   ├── index.html
│   ├── style.css
│   └── main.js
│
└── README.md
```

---

## 📜 References
1. Perkins, C. E., & Royer, E. M. (1999). Ad-hoc On-Demand Distance Vector Routing. *IEEE WMCSA*.
2. NS-3 Network Simulator Documentation — [nsnam.org](https://www.nsnam.org/docs/release/3.41/).
3. RFC 3561 — Ad hoc On-Demand Distance Vector (AODV) Routing.

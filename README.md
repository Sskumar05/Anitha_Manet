# MANET Routing Research Dashboard
### Reliable and Efficient Routing in Highly Dynamic MANETs — CS2708

> **Energy-Aware AODV (eAODV)** vs Standard AODV — Live simulation dashboard with performance analytics

![Dashboard Preview](dashboard/preview.png)

---

## 👥 Team
| Name | Role |
|---|---|
| Anitha G | Developer & Researcher |
| Elanthalir K | Developer & Researcher |
| Harini G.P | Developer & Researcher |
| **Guide: Dr. Sugumaran V.R** | Project Supervisor |

**Batch:** CS2708

---

## 📌 Project Overview

This project designs and evaluates an **Energy-Aware variant of AODV** (eAODV) routing protocol for Mobile Ad-hoc Networks (MANETs). Standard AODV breaks down under high node mobility — links break often, causing heavy re-discovery overhead and battery drain. eAODV fixes this by:

- Scoring route replies using **remaining node energy**
- Avoiding routing through **low-battery nodes**
- Triggering **proactive local repair** before a route fails
- Balancing energy load to extend **network lifetime by ~22%**

Performance is validated via **NS-3 v3.40+** simulation across multiple scenarios.

---

## 📊 Key Results

| Metric | AODV (Baseline) | eAODV (Enhanced) | Improvement |
|---|---|---|---|
| Packet Delivery Ratio | 73.2% | 91.4% | **▲ +18.2%** |
| End-to-End Delay | 68 ms | 42 ms | **▼ −38.5%** |
| Routing Overhead | 0.44 | 0.31 | **▼ −29.1%** |
| Energy Consumed (avg/node) | 1.6 J | 1.24 J | **▼ −22.3%** |

---

## 🚀 Running the Demo Dashboard

No installation needed — just open in any browser:

```
dashboard/index.html  →  double-click to open
```

**Features:**
- 🔬 Live animated MANET simulation canvas
- 📊 Interactive Chart.js performance graphs (PDR, Delay, Overhead, Energy)
- 🗺️ Network topology visualizer (Static / Dynamic / Route modes)
- ⚙️ Algorithm comparison (AODV vs eAODV)
- 🎛️ Configurable node count, speed, and protocol

---

## 🔧 Running the NS-3 Simulation

### Prerequisites (Linux / WSL2 on Windows)

```bash
# Install WSL2 (Windows only — run in PowerShell as Admin)
wsl --install -d Ubuntu-22.04

# Inside Ubuntu — install dependencies
sudo apt update && sudo apt upgrade -y
sudo apt install -y g++ python3 python3-pip git cmake ninja-build libgtk-3-dev
pip3 install pandas matplotlib numpy
```

### Install NS-3

```bash
git clone https://gitlab.com/nsnam/ns-3-dev.git
cd ns-3-dev
./ns3 configure --enable-examples --enable-tests
./ns3 build       # takes ~15–20 minutes first time
./ns3 run "aodv"  # verify installation
```

### Run Baseline Simulation

```bash
cp ../manet-baseline.cc scratch/
./ns3 run "manet-baseline"
# Output: results/baseline_<nodes>_<speed>.xml
```

### Run Full Sweep

```bash
python3 sweep.py     # runs all node/speed combos for both protocols
python3 analyze.py   # parses XML → generates comparison graphs
# Graphs saved to: results/graphs/comparison_*.png
```

---

## 📁 Project Structure

```
manet_reliable/
├── dashboard/              # 🖥️  Web demo dashboard (open index.html)
│   ├── index.html          # Main dashboard page
│   ├── style.css           # Premium dark theme styles
│   └── main.js             # Canvas animations + Chart.js logic
├── ns-3-dev/               # NS-3 simulation engine
│   └── scratch/
│       ├── manet-baseline.cc   # Standard AODV simulation
│       └── manet-eaodv.cc      # Energy-Aware AODV simulation
├── results/                # Simulation output XML files
│   └── graphs/             # Generated comparison PNG graphs
├── MANET_Project_Roadmap.md
├── Antigravity_Prompt_Sequence.md
└── README.md
```

---

## 🛠️ Tech Stack

| Purpose | Tool |
|---|---|
| Network Simulation | NS-3 v3.40+ |
| Protocol Language | C++ |
| Analysis & Graphs | Python 3, pandas, matplotlib |
| Demo Dashboard | HTML5, CSS3, Vanilla JS, Chart.js |
| Version Control | Git / GitHub |

---

## 📚 References

1. Perkins, C. E., & Royer, E. M. (1999). Ad-hoc On-Demand Distance Vector Routing. *IEEE WMCSA*
2. NS-3 Official Tutorial — [nsnam.org/docs/tutorial](https://www.nsnam.org/docs/tutorial/html/)
3. NS-3 AODV Module — `src/aodv/model/aodv-routing-protocol.cc`

---

*Department of Computer Science & Engineering — Final Year Project 2024–25*

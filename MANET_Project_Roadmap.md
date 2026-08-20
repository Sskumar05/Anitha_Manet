# Roadmap: Reliable and Efficient Routing in Highly Dynamic MANETs
### (100% free tools — aligned to your 8-week Gantt chart)

**Batch:** CS2708 | Anitha G, Elanthalir K, Harini G.P | Guide: Dr. Sugumaran V.R

---

## 0. What you're actually building (in plain terms)

Your PPTs already define this well — here's the one-paragraph version to keep in your head:

> Standard **AODV** (Ad-hoc On-Demand Distance Vector) routing breaks down in *highly dynamic* MANETs — nodes move fast, links break often, so AODV keeps re-discovering routes, which burns bandwidth (overhead), adds delay, and drains battery (energy). Your project designs an **enhanced/adaptive version of AODV** that predicts or reacts to link breaks faster/smarter, and proves — via simulation, not real hardware — that it beats plain AODV on 4 metrics: **Packet Delivery Ratio (PDR), end-to-end delay, routing overhead, and energy consumption.**

Everything below is aimed at proving that claim with graphs, for free.

---

## 1. The entire free tool stack

| Purpose | Tool | Why | Cost |
|---|---|---|---|
| Network simulator | **NS-3** (v3.40+) | Industry-standard, has AODV built-in in C++, free & open source | Free |
| OS to run it | **Ubuntu 22.04** (via WSL2 on Windows, VirtualBox, or dual-boot) | NS-3 is painful on native Windows | Free |
| Coding | **Python 3** + **C++** | Python for analysis/automation, C++ to modify NS-3's AODV module | Free |
| Editor | **VS Code** | Free, great C++/Python support | Free |
| Data analysis | **Python: pandas, matplotlib, numpy** | Turn NS-3 output into your graphs | Free |
| Version control | **GitHub** (free tier) | Track your code, share between teammates | Free |
| Report/paper writing | **Overleaf (free tier)** or MS Word | LaTeX if your college wants IEEE format | Free |
| Optional — light ML | **scikit-learn** | If you add an ML-based route/mobility predictor | Free |
| Optional cloud compute | **Google Colab (free tier)** | If your laptop is slow for big simulations | Free |

No hardware purchase needed — your own PPT already says "Economic feasibility: no expensive hardware needed." A laptop with 8GB+ RAM is enough.

---

## 2. Environment setup (do this first, ~1 day)

**Option A — Windows users (recommended): WSL2**
```bash
wsl --install -d Ubuntu-22.04
```
Restart, set a username/password, then inside Ubuntu:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y g++ python3 python3-pip git cmake ninja-build \
    libgtk-3-dev qtbase5-dev qtchooser qt5-qmake qtbase5-dev-tools \
    gir1.2-goocanvas-2.0 python3-gi python3-gi-cairo gir1.2-gtk-3.0
```

**Option B — Mac/Linux users:** install Ubuntu in VirtualBox (free), or install NS-3 dependencies natively if on Linux.

**Install NS-3:**
```bash
git clone https://gitlab.com/nsnam/ns-3-dev.git
cd ns-3-dev
./ns3 configure --enable-examples --enable-tests
./ns3 build
```
Verify it worked:
```bash
./ns3 run "aodv"
```
If that runs without errors, you have a working AODV baseline already — this alone gets you a working Phase-I demo.

**Free reference:** the official [NS-3 tutorial](https://www.nsnam.org/docs/tutorial/html/) — do the first 4 chapters before writing any code. It's the single best free resource for this project.

---

## 3. Week-by-week plan (mapped to your Gantt chart)

### Week 1–2: Literature Survey + Learn the Tools (you're mostly done with the survey part)
- Finish reading your 5 references — note *specifically* what each one's proposed fix was and its reported PDR/delay numbers. You'll compare against these later.
- Do the NS-3 tutorial chapters 1–4 (First Script, Building Topologies, Tracing, Tweaking).
- Watch free YouTube playlists: search "NS-3 tutorial for beginners" and "AODV NS-3 simulation" — several full playlists exist free.
- **Deliverable:** a working NS-3 install + one successful run of the built-in `aodv` example.

### Week 3: Problem Identification + Methodology Design (baseline)
- Run NS-3's built-in AODV example (`examples/routing/aodv.cc`) with default settings — this is your **baseline**.
- Modify node count and speed (e.g., 20–100 nodes, 0–20 m/s using Random Waypoint mobility model) and re-run to see AODV degrade under high mobility — this *proves your problem statement* with real data, not just claims.
- Enable **FlowMonitor** in your script — this is NS-3's built-in module that auto-computes PDR, delay, and overhead for you. Don't hand-roll these calculations.
```cpp
#include "ns3/flow-monitor-module.h"
FlowMonitorHelper flowmon;
Ptr<FlowMonitor> monitor = flowmon.InstallAll();
// ... run simulation ...
monitor->SerializeToXmlFile("results.xml", true, true);
```
- **Deliverable:** baseline AODV performance graphs (PDR/delay/overhead vs. node speed).

### Week 4–5: Algorithm Design + Implementation (the actual "contribution")
This is the core of your project. Pick **one** realistic, buildable enhancement (don't try all of them):

**Option 1 (easiest, most doable in 8 weeks): Energy-aware AODV**
- Modify AODV's route selection so it avoids routing through low-battery nodes.
- NS-3 has an `EnergySource`/`DeviceEnergyModel` module you attach to nodes — track remaining energy, penalize low-energy nodes in the route reply decision.
- Where to edit: `src/aodv/model/aodv-routing-protocol.cc`, specifically the RREQ/RREP handling functions.

**Option 2: Mobility-aware / predictive route maintenance**
- Before a link breaks, predict it using each node's speed+direction (basic physics, not heavy ML) and pre-emptively start route discovery — reduces the delay spike when a route actually breaks.

**Option 3: Clustering-based AODV** (matches your literature survey slide)
- Group nearby nodes into clusters with a cluster-head; route between cluster-heads instead of every node — reduces control overhead. More complex to implement in NS-3 than Options 1–2; only pick this if a teammate is comfortable with C++.

**Practical tip:** you don't have to write NS-3's AODV from scratch — clone the existing `src/aodv/` module, rename it (e.g., `src/eaodv/`), and edit the C++ files inside. This is far more manageable than writing a routing protocol from zero, and it's still a legitimate, gradeable "design contribution."

- **Deliverable:** modified protocol compiles and runs a simulation successfully (even before it's optimized).

### Week 5–6: Simulation Development (breadth of testing)
- Run your enhanced protocol against baseline AODV across multiple scenarios:
  - Varying node density (20, 50, 100 nodes)
  - Varying mobility speed (2, 10, 20 m/s)
  - Varying traffic load (number of active connections)
- Automate this with a Python or bash script that loops NS-3 runs with different parameters and saves each `results.xml` — don't do this manually one run at a time.

### Week 6–7: Performance Analysis
- Parse each `results.xml` with Python (`xml.etree.ElementTree` or `pandas`) and compute:
  - **PDR** = packets received / packets sent
  - **Avg end-to-end delay**
  - **Routing overhead** = control packets / data packets delivered
  - **Energy consumption** (from your energy model logs)
- Plot comparison graphs (your protocol vs. plain AODV vs., if time allows, DSR/DSDV which NS-3 also ships) using `matplotlib`.
- **This is your headline result slide** — a set of 4 clean graphs showing your protocol wins on PDR/delay/overhead/energy.

### Week 6–8 (parallel): "AI/ML Optimization" (optional, only if time allows)
Your Phase-I slide mentions this — keep it lightweight:
- A small `scikit-learn` regression/classifier trained on synthetic mobility data to predict "will this link break in the next N seconds" — feed that prediction into your route-maintenance logic (Option 2 above).
- This can run as a **separate Python script** that NS-3 calls out to, rather than embedding ML inside C++ — much easier for an 8-week undergrad project. Be upfront in your report that this is a lightweight heuristic add-on, not a full RL system — that's a legitimate and honest framing.

### Week 8: Testing, Validation, Final Report
- Re-run your best configuration 5–10 times with different random seeds and average the results (NS-3 simulations are stochastic — single runs aren't credible).
- Write the report: Introduction → Literature Survey → Methodology → Implementation → Results → Conclusion — matches your existing slide structure closely.
- Prepare the final presentation reusing your Phase-I deck's structure with **real results replacing the placeholder architecture/flowchart images**.

---

## 4. Realistic scope check

Given 3 members and 8 weeks, this is achievable:
- ✅ Baseline AODV simulation + graphs
- ✅ One enhancement (energy-aware or mobility-predictive) implemented and compared
- ✅ 4-metric comparison across 2–3 scenarios

This is a stretch, do only if ahead of schedule:
- ⚠️ Full clustering protocol from scratch
- ⚠️ Deep learning-based routing (a simple heuristic/regression is fine and defensible; don't over-promise deep RL you won't finish)

---

## 5. Free learning resources, gathered

- **NS-3 official tutorial:** nsnam.org/docs/tutorial/html/ — start here, no shortcuts
- **NS-3 AODV source code:** already inside your NS-3 install at `src/aodv/model/` — read it before modifying it
- **GitHub search:** "ns-3 aodv energy" or "ns-3 enhanced aodv" — several free student projects show patterns (read for structure/ideas, write your own code — don't copy-paste, both for learning and for plagiarism checks)
- **Google Scholar:** free access to most MANET routing papers your college library also has — good for filling out your literature survey further
- **YouTube:** "NS-3 simulation tutorial," "AODV protocol explained," "MANET routing NS-3" all have solid free playlists

---

## 6. Suggested first concrete action this week

1. Install WSL2 + NS-3 (Section 2).
2. Get the built-in `aodv` example running.
3. Enable FlowMonitor and produce your first PDR/delay numbers — even with zero modifications, this gives your team a real baseline result to show your guide next meeting, which is usually the biggest confidence boost early on.

If you want, I can also write you the actual starter NS-3 C++ simulation script (topology + AODV + FlowMonitor) so Week 3 has working code to run on day one — just say the word.

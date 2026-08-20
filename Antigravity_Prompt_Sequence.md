# Antigravity Prompt Sequence — MANET Routing Project
Run these **in order**, one at a time. Wait for each step to finish and actually check the output before pasting the next prompt — don't queue them all at once, since each step depends on the last one working.

---

## Step 1 — Environment setup
```
Set up NS-3 (latest stable, 3.40+) on this machine for a MANET routing
simulation project. Steps:
1. Check if Ubuntu/WSL2 is available; if on Windows, tell me to install
   WSL2 first and stop.
2. Install all NS-3 build dependencies (g++, python3, cmake, ninja-build, etc.)
3. Clone ns-3-dev from https://gitlab.com/nsnam/ns-3-dev.git
4. Configure and build it with examples and tests enabled
5. Run the built-in "aodv" example to confirm it works
6. Report the exact commands used and confirm success/failure clearly
```

## Step 2 — Baseline simulation script
```
Inside the ns-3-dev project, create a new simulation script called
manet-baseline.cc based on the existing AODV example. Requirements:
- Configurable number of nodes (default 50) and simulation area (1000x1000m)
- Random Waypoint mobility model, configurable max speed (default 10 m/s)
- Standard AODV routing (unmodified)
- Attach FlowMonitor to capture PDR, delay, and routing overhead
- Output results to an XML file named results/baseline_<nodes>_<speed>.xml
- Add clear comments explaining each section
Build it and run one test simulation with default settings. Show me the
console output and confirm the XML file was created.
```

## Step 3 — Sweep script (multiple scenarios)
```
Write a bash or Python script that runs manet-baseline.cc multiple times
with varying node speed (2, 10, 20 m/s) and varying node count (20, 50, 100),
saving each result to a uniquely named XML file in results/. Run the full
sweep and confirm all output files were created successfully.
```

## Step 4 — Baseline analysis + graphs
```
Write a Python script (using pandas and matplotlib) that reads all the
FlowMonitor XML files in results/, extracts PDR, average end-to-end delay,
and routing overhead for each scenario, and produces three comparison
graphs (metric vs. node speed, one line per node count). Save the graphs
as PNG files in results/graphs/. Run it and show me the resulting images.
```

## Step 5 — Design the enhancement (energy-aware AODV)
```
I want to create an energy-aware variant of AODV inside NS-3. Copy the
existing src/aodv module to a new module src/eaodv, renaming all internal
references appropriately. Then:
1. Attach NS-3's EnergySource / BasicEnergySource model to each node
2. Modify the RREP (route reply) handling logic in eaodv so that when a
   node has multiple possible next hops, it prefers the one with higher
   remaining energy, not just the fastest reply
3. Add debug logging so I can confirm energy is actually being tracked
   and influencing route choice
Explain what you changed and why, in plain language, after you're done.
```

## Step 6 — Enhanced protocol simulation script
```
Create manet-eaodv.cc, a copy of manet-baseline.cc but using the eaodv
module instead of standard aodv, and add energy consumption tracking to
the FlowMonitor output (or a separate energy log file). Build it and run
one test simulation to confirm it compiles and produces results.
```

## Step 7 — Full comparison sweep
```
Extend the sweep script from Step 3 to also run manet-eaodv.cc across the
same node count and speed combinations. Save results separately
(results/eaodv_<nodes>_<speed>.xml) so they can be compared against the
baseline results. Run the full sweep for both protocols.
```

## Step 8 — Comparison graphs (the headline results)
```
Extend the analysis script from Step 4 to plot AODV vs eAODV side by side
on the same graphs for: PDR, average delay, routing overhead, and total
energy consumed — one graph per metric, both protocols as separate lines,
x-axis = node speed. Save these as results/graphs/comparison_*.png and
show me all four images.
```

## Step 9 — Statistical reliability (multiple runs)
```
Modify the sweep script so each scenario runs 5 times with different
random seeds, and update the analysis script to plot the average with
error bars (standard deviation) instead of single-run values. Re-run the
full sweep and regenerate the comparison graphs.
```

## Step 10 — Package results for the report
```
Create a results_summary.md file that lists, in a table, the final
averaged PDR / delay / overhead / energy numbers for AODV vs eAODV at
each tested node speed, plus a 3-sentence plain-language interpretation
of what improved and by how much. Also copy all final graph PNGs into a
single results/final/ folder.
```

## Step 11 (optional) — README for handover
```
Write a README.md for this whole project covering: what the project does,
how to install NS-3 from scratch on a new machine, how to run the baseline
and eaodv simulations, how to run the analysis script, and where to find
the final graphs and results table. Assume the reader has never used NS-3
before.
```

---

### Notes
- If any step's build/run fails, paste Antigravity's exact error back to it before moving to the next step — don't skip ahead on a broken build.
- Step 5 is the one true "design" step — if you want a different enhancement (mobility-prediction instead of energy-aware), just edit Step 5's prompt before running it; everything downstream stays the same.
- This whole sequence maps directly onto Weeks 3–8 of the roadmap doc from earlier.

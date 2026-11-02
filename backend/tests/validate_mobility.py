import asyncio
import json
from pathlib import Path
from app.services.simulation_service import simulation_service
from app.schemas.simulation import SimulationConfig, ProtocolType

async def run_protocol_test(proto: ProtocolType):
    conf = SimulationConfig(
        protocol=proto,
        node_count=10,
        mobility_speed=12.0,
        simulation_area=800,
        simulation_time=6.0,
        rng_seed=42,
        traffic_flows=2,
        is_demo=False
    )
    run_id = await simulation_service.start_simulation(conf)
    print(f"Started {proto.value} run: {run_id}")
    res = await simulation_service._await_run_completion(run_id, timeout_sec=90)
    assert res is not None, f"Run {run_id} failed to complete"
    print(f"Finished {proto.value}: PDR={res.pdr}%, Delay={res.delay_ms}ms, NRL={res.overhead_ratio}, RoutingPackets={res.routing_packets}")
    print(f"output_mobility_path: {res.output_mobility_path}")
    
    mob_path = Path(res.output_mobility_path) if res.output_mobility_path else None
    assert mob_path and mob_path.exists(), f"Mobility trace missing for {run_id} at {res.output_mobility_path}"
    
    with open(mob_path, "r", encoding="utf-8") as f:
        mob_data = json.load(f)
    
    print(f"Trace metadata: trace_type={mob_data.get('trace_type')}, duration={mob_data.get('simulation_duration')}, nodes={mob_data.get('node_count')}, total_records={mob_data.get('total_position_records')}")
    assert mob_data.get("metric_version") == 1
    assert mob_data.get("trace_type") == "ns3_node_mobility"
    assert mob_data.get("node_count") == 10
    assert len(mob_data["nodes"]) == 10
    
    for idx, node in enumerate(mob_data["nodes"]):
        assert node["node_id"] == idx, f"Node id mismatch: expected {idx}, got {node['node_id']}"
        positions = node["positions"]
        assert len(positions) >= 2, f"Expected at least 2 position records, got {len(positions)}"
        assert positions[0]["time"] == 0.0, f"Expected initial time 0.0, got {positions[0]['time']}"
        assert positions[-1]["time"] <= 6.0, f"Expected final time <= 6.0, got {positions[-1]['time']}"
        
        # Verify valid coordinates within sim area
        for p in positions:
            assert 0.0 <= p["x"] <= 800.0, f"X coordinate out of bounds: {p['x']}"
            assert 0.0 <= p["y"] <= 800.0, f"Y coordinate out of bounds: {p['y']}"
            assert p["z"] == 0.0, f"Z coordinate non-zero: {p['z']}"

    n0 = mob_data["nodes"][0]
    print(f"Node 0 has {len(n0['positions'])} positions. Initial: {n0['positions'][0]}, Final: {n0['positions'][-1]}")
    return run_id, mob_data

async def main():
    print("=== TESTING REAL AODV SIMULATION WITH MOBILITY ===")
    aodv_run_id, aodv_mob = await run_protocol_test(ProtocolType.AODV)
    
    print("\n=== TESTING REAL eAODV SIMULATION WITH MOBILITY ===")
    eaodv_run_id, eaodv_mob = await run_protocol_test(ProtocolType.eAODV)
    
    # Verify both matched runs have matching initial positions for matched seed=42
    print("\n=== VERIFYING SCIENTIFIC REPRODUCIBILITY (AODV vs eAODV matching initial placements) ===")
    for i in range(10):
        pos_aodv_init = aodv_mob["nodes"][i]["positions"][0]
        pos_eaodv_init = eaodv_mob["nodes"][i]["positions"][0]
        assert pos_aodv_init["x"] == pos_eaodv_init["x"] and pos_aodv_init["y"] == pos_eaodv_init["y"], \
            f"Node {i} initial position mismatch between AODV and eAODV!"
    print("All 10 nodes have identical initial placements in AODV and eAODV for seed=42!")
    print("\nALL VALIDATION CHECKS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(main())


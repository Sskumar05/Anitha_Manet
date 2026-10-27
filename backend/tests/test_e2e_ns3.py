import pytest
import asyncio
from app.schemas.simulation import SimulationConfig, ProtocolType
from app.services.simulation_service import simulation_service
from app.services.db_service import db_service

@pytest.mark.asyncio
async def test_real_ns3_simulation_execution():
    await db_service.init_db()

    config = SimulationConfig(
        protocol=ProtocolType.eAODV,
        node_count=10,
        mobility_speed=5.0,
        simulation_area=500,
        simulation_time=5.0,
        rng_seed=123,
        is_demo=False
    )

    run_id = await simulation_service.start_simulation(config)
    assert run_id.startswith("sim_")

    # Poll until completed (real NS-3 run takes ~4-8s for 5s sim)
    completed = False
    for _ in range(30):
        await asyncio.sleep(1.0)
        status = await simulation_service.get_status(run_id)
        if status and status.status.value == "completed":
            completed = True
            break
        elif status and status.status.value == "failed":
            break

    assert completed, f"Simulation did not complete in time. Last status: {status}"

    # Verify results
    result = await simulation_service.get_results(run_id)
    assert result is not None
    assert result.run_id == run_id
    assert result.status.value == "completed"
    assert result.pdr >= 0.0
    assert result.node_count == 10
    print(f"\n[E2E NS-3 TEST SUCCESS] Run={run_id}, PDR={result.pdr}%, Delay={result.delay_ms}ms, Energy={result.energy_consumed_j}J, IsDemo={result.is_demo}")

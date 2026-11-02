import pytest
import asyncio
from pathlib import Path
from app.schemas.simulation import SweepStartRequest, SweepParameter, SweepStatus
from app.services.simulation_service import simulation_service
from app.services.db_service import db_service

@pytest.mark.asyncio
async def test_real_ns3_sweep_execution():
    """
    Executes a real NS-3.41 simulation sweep with matched AODV and eAODV runs.
    Verifies that the points are genuinely measured from FlowMonitor XML and Energy CSV.
    """
    await db_service.init_db()

    # Request a fast 2-point speed sweep (simulation_time=5.0s)
    req = SweepStartRequest(
        parameter=SweepParameter.SPEED,
        points=[5.0, 15.0],
        simulation_time=5.0,
        rng_seed=42,
    )

    sweep_id = await simulation_service.start_sweep(req)
    assert sweep_id.startswith("sweep_")

    # Poll until completed or timeout after 90s
    completed = False
    sweep_result = None
    for _ in range(90):
        await asyncio.sleep(1.0)
        st = await simulation_service.get_sweep_status(sweep_id)
        if st and st.status == SweepStatus.COMPLETED:
            completed = True
            sweep_result = st
            break
        elif st and st.status in (SweepStatus.FAILED, SweepStatus.CANCELLED):
            sweep_result = st
            break

    assert completed, f"Sweep did not complete. Last status: {sweep_result}"
    assert sweep_result is not None
    assert sweep_result.completed_runs == 4  # 2 points * 2 protocols = 4 runs
    assert sweep_result.progress_percent == 100
    assert len(sweep_result.points) == 2

    # Verify both points have real NS-3 results
    for pt in sweep_result.points:
        assert pt.status == "completed"
        assert pt.aodv_run_id is not None
        assert pt.eaodv_run_id is not None
        assert pt.aodv_result is not None
        assert pt.eaodv_result is not None

        # Verify real NS-3 metrics are genuine numbers
        assert pt.aodv_result.pdr >= 0.0
        assert pt.aodv_result.delay_ms >= 0.0
        assert pt.aodv_result.energy_consumed_j >= 0.0
        assert pt.eaodv_result.pdr >= 0.0
        assert pt.eaodv_result.delay_ms >= 0.0
        assert pt.eaodv_result.energy_consumed_j >= 0.0

        # Verify matching config between AODV and eAODV
        assert pt.aodv_result.mobility_speed == pt.parameter_value
        assert pt.eaodv_result.mobility_speed == pt.parameter_value
        assert pt.aodv_result.node_count == pt.eaodv_result.node_count
        assert pt.aodv_result.simulation_time == pt.eaodv_result.simulation_time

        # Verify trace files exist on disk
        assert Path(pt.aodv_result.output_xml_path).exists()
        assert Path(pt.aodv_result.output_energy_path).exists()
        assert Path(pt.eaodv_result.output_xml_path).exists()
        assert Path(pt.eaodv_result.output_energy_path).exists()

        print(
            f"\n[SWEEP POINT AUDIT] Speed={pt.parameter_label}: "
            f"AODV(PDR={pt.aodv_result.pdr}%, Delay={pt.aodv_result.delay_ms}ms, Energy={pt.aodv_result.energy_consumed_j}J) vs "
            f"eAODV(PDR={pt.eaodv_result.pdr}%, Delay={pt.eaodv_result.delay_ms}ms, Energy={pt.eaodv_result.energy_consumed_j}J)"
        )

    # Verify database persistence
    persisted = await db_service.get_sweep(sweep_id)
    assert persisted is not None
    assert persisted.status == SweepStatus.COMPLETED
    assert persisted.sweep_id == sweep_id

    # Verify latest query returns this sweep
    latest = await db_service.get_latest_sweep("speed")
    assert latest is not None
    assert latest.sweep_id == sweep_id

import pytest
import json
import uuid
from pathlib import Path
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.config import settings
from app.services.db_service import db_service
from app.schemas.simulation import SimulationResult, SimulationStatus

@pytest.fixture(scope="session", autouse=True)
def init_database():
    import asyncio
    asyncio.run(db_service.init_db())

@pytest.mark.asyncio
async def test_get_mobility_trace_real_runs():
    """
    Tests GET /api/simulation/{run_id}/mobility using the actual real simulation runs
    generated during Phase 1 validation (AODV and eAODV).
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Test AODV real run
        aodv_run_id = "sim_1793344375_8cc74e"
        res_aodv = await client.get(f"/api/simulation/{aodv_run_id}/mobility")
        assert res_aodv.status_code == 200, f"Failed to get AODV mobility trace: {res_aodv.text}"
        data_aodv = res_aodv.json()
        assert data_aodv["run_id"] == aodv_run_id
        assert data_aodv["protocol"] == "AODV"
        assert data_aodv["trace_type"] == "ns3_node_mobility"
        assert data_aodv["node_count"] == 10
        assert data_aodv["total_position_records"] == 130
        assert len(data_aodv["nodes"]) == 10
        assert data_aodv["nodes"][0]["positions"][0]["time"] == 0.0

        # 2. Test eAODV real run
        eaodv_run_id = "sim_1793344393_fb9b6f"
        res_eaodv = await client.get(f"/api/simulation/{eaodv_run_id}/mobility")
        assert res_eaodv.status_code == 200, f"Failed to get eAODV mobility trace: {res_eaodv.text}"
        data_eaodv = res_eaodv.json()
        assert data_eaodv["run_id"] == eaodv_run_id
        assert data_eaodv["protocol"] == "eAODV"
        assert data_eaodv["trace_type"] == "ns3_node_mobility"
        assert data_eaodv["node_count"] == 10
        assert data_eaodv["total_position_records"] == 130
        assert len(data_eaodv["nodes"]) == 10

@pytest.mark.asyncio
async def test_get_mobility_trace_unknown_run():
    """
    Tests that requesting mobility for an unknown run_id returns HTTP 404.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/simulation/sim_non_existent_999/mobility")
        assert res.status_code == 404
        assert "not found" in res.json()["detail"].lower()

@pytest.mark.asyncio
async def test_get_mobility_trace_historical_run_missing_file():
    """
    Tests that a historical run with no mobility trace file returns HTTP 404
    with a clear explanatory message.
    """
    run_id = f"sim_test_hist_{uuid.uuid4().hex[:8]}"
    # Create a dummy historical run in DB without mobility file
    await db_service.create_run(
        run_id=run_id,
        protocol="AODV",
        node_count=20,
        mobility_speed=10.0,
        simulation_area=1000,
        simulation_time=30.0,
        is_demo=False
    )
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get(f"/api/simulation/{run_id}/mobility")
        assert res.status_code == 404
        assert "mobility trace file not found" in res.json()["detail"].lower()

@pytest.mark.asyncio
async def test_get_mobility_trace_corrupted_json():
    """
    Tests that a corrupted/malformed mobility JSON file returns HTTP 500 with logging.
    """
    run_id = f"sim_test_corrupt_{uuid.uuid4().hex[:8]}"
    run_dir = settings.RESULTS_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    corrupted_file = run_dir / "mobility_trace.json"
    corrupted_file.write_text("{ this is not valid json! ", encoding="utf-8")

    await db_service.create_run(
        run_id=run_id,
        protocol="eAODV",
        node_count=10,
        mobility_speed=5.0,
        simulation_area=500,
        simulation_time=10.0,
        is_demo=False
    )
    res_obj = SimulationResult(
        run_id=run_id,
        protocol="eAODV",
        status=SimulationStatus.COMPLETED,
        node_count=10,
        mobility_speed=5.0,
        simulation_area=500,
        simulation_time=10.0,
        pdr=50.0,
        delay_ms=10.0,
        energy_consumed_j=1.0,
        remaining_energy_percent=99.0,
        tx_packets=10,
        rx_packets=5,
        dropped_packets=5,
        execution_duration_s=1.0,
        is_demo=False,
        output_mobility_path=str(corrupted_file),
        created_at="2026-10-30T00:00:00Z"
    )
    await db_service.save_result(res_obj, [])

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.get(f"/api/simulation/{run_id}/mobility")
            assert res.status_code == 500
            assert "corrupted" in res.json()["detail"].lower()
    finally:
        # Cleanup test files
        if corrupted_file.exists():
            corrupted_file.unlink()
        if run_dir.exists():
            run_dir.rmdir()

@pytest.mark.asyncio
async def test_get_mobility_trace_invalid_schema():
    """
    Tests that a mobility trace file with invalid schema (missing 'nodes') returns HTTP 500.
    """
    run_id = f"sim_test_schema_{uuid.uuid4().hex[:8]}"
    run_dir = settings.RESULTS_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    schema_file = run_dir / "mobility_trace.json"
    schema_file.write_text(json.dumps({"trace_type": "wrong", "nodes": "not_a_list"}), encoding="utf-8")

    await db_service.create_run(
        run_id=run_id,
        protocol="AODV",
        node_count=10,
        mobility_speed=5.0,
        simulation_area=500,
        simulation_time=10.0,
        is_demo=False
    )
    res_obj = SimulationResult(
        run_id=run_id,
        protocol="AODV",
        status=SimulationStatus.COMPLETED,
        node_count=10,
        mobility_speed=5.0,
        simulation_area=500,
        simulation_time=10.0,
        pdr=50.0,
        delay_ms=10.0,
        energy_consumed_j=1.0,
        remaining_energy_percent=99.0,
        tx_packets=10,
        rx_packets=5,
        dropped_packets=5,
        execution_duration_s=1.0,
        is_demo=False,
        output_mobility_path=str(schema_file),
        created_at="2026-10-30T00:00:00Z"
    )
    await db_service.save_result(res_obj, [])

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.get(f"/api/simulation/{run_id}/mobility")
            assert res.status_code == 500
            assert "structure" in res.json()["detail"].lower()
    finally:
        # Cleanup test files
        if schema_file.exists():
            schema_file.unlink()
        if run_dir.exists():
            run_dir.rmdir()

@pytest.mark.asyncio
async def test_path_traversal_protection():
    """
    Tests that path traversal attempts in run_id are blocked with HTTP 400 or 404.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Invalid characters or directory traversal dots
        res = await client.get("/api/simulation/..%2F..%2Fetc/mobility")
        assert res.status_code in (400, 404)

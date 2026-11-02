import pytest
import json
import uuid
from pathlib import Path
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.config import settings
from app.services.db_service import db_service
from app.schemas.simulation import SimulationResult, SimulationStatus

@pytest.mark.asyncio
async def test_get_wireless_links_unknown_run():
    """
    Tests that requesting wireless links for an unknown run_id returns HTTP 404.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/simulation/sim_non_existent_links_999/wireless-links")
        assert res.status_code == 404
        assert "not found" in res.json()["detail"].lower()

@pytest.mark.asyncio
async def test_get_wireless_links_invalid_run_id_characters():
    """
    Tests that requesting wireless links with path-traversal or special characters returns HTTP 400.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/simulation/sim_.._escape/wireless-links")
        assert res.status_code == 400
        assert "invalid run_id format" in res.json()["detail"].lower()

@pytest.mark.asyncio
async def test_get_wireless_links_historical_run_missing_file():
    """
    Tests that a historical run without a wireless link trace returns HTTP 404
    with an explanatory message.
    """
    run_id = f"sim_test_hist_{uuid.uuid4().hex[:8]}"
    await db_service.create_run(
        run_id=run_id,
        protocol="AODV",
        node_count=10,
        mobility_speed=10.0,
        simulation_area=800,
        simulation_time=5.0,
        is_demo=False
    )
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get(f"/api/simulation/{run_id}/wireless-links")
        assert res.status_code == 404
        assert "wireless link trace file not found" in res.json()["detail"].lower()

@pytest.mark.asyncio
async def test_get_wireless_links_corrupted_json():
    """
    Tests that a corrupted/malformed wireless link JSON file returns HTTP 500.
    """
    run_id = f"sim_test_corrupt_link_{uuid.uuid4().hex[:8]}"
    run_dir = settings.RESULTS_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    corrupted_file = run_dir / "wireless_link_trace.json"
    corrupted_file.write_text("{ unclosed json string...", encoding="utf-8")

    await db_service.create_run(
        run_id=run_id,
        protocol="eAODV",
        node_count=10,
        mobility_speed=5.0,
        simulation_area=800,
        simulation_time=5.0,
        is_demo=False
    )
    res_obj = SimulationResult(
        run_id=run_id,
        protocol="eAODV",
        status=SimulationStatus.COMPLETED,
        node_count=10,
        mobility_speed=5.0,
        simulation_area=800,
        simulation_time=5.0,
        pdr=95.0,
        delay_ms=12.0,
        overhead_ratio=0.5,
        energy_consumed_j=1.2,
        remaining_energy_percent=98.8,
        tx_packets=100,
        rx_packets=95,
        dropped_packets=5,
        execution_duration_s=2.0,
        is_demo=False,
        output_link_path=str(corrupted_file),
        created_at="2026-10-30T10:00:00Z"
    )
    await db_service.save_result(res_obj, [])

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get(f"/api/simulation/{run_id}/wireless-links")
        assert res.status_code == 500
        assert "corrupted wireless link trace" in res.json()["detail"].lower()

@pytest.mark.asyncio
async def test_get_wireless_links_valid_trace():
    """
    Tests that a valid NS-3 wireless link trace is correctly parsed, verified, and served.
    """
    run_id = f"sim_test_valid_link_{uuid.uuid4().hex[:8]}"
    run_dir = settings.RESULTS_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    valid_file = run_dir / "wireless_link_trace.json"

    dummy_trace = {
        "trace_type": "ns3_wireless_link_trace",
        "metric_version": 1,
        "node_count": 10,
        "simulation_duration": 6.0,
        "sim_area": 800.0,
        "total_events": 3,
        "total_tx_attempts": 1,
        "total_rx_success": 1,
        "total_rx_drop": 1,
        "events": [
            {
                "time": 1.05,
                "event_type": "tx",
                "packet_uid": 42,
                "source_node_id": 0,
                "destination_node_id": 1,
                "packet_size_bytes": 64,
                "frame_type": "Data",
                "is_broadcast": False,
                "snr_db": None
            },
            {
                "time": 1.05001,
                "event_type": "rx_ok",
                "packet_uid": 42,
                "source_node_id": 0,
                "destination_node_id": 1,
                "packet_size_bytes": 64,
                "frame_type": "Data",
                "is_broadcast": False,
                "snr_db": 22.45
            },
            {
                "time": 1.50,
                "event_type": "rx_drop",
                "packet_uid": 43,
                "source_node_id": 2,
                "destination_node_id": 3,
                "packet_size_bytes": 64,
                "frame_type": "Data",
                "is_broadcast": False,
                "snr_db": 2.1
            }
        ]
    }
    valid_file.write_text(json.dumps(dummy_trace), encoding="utf-8")

    await db_service.create_run(
        run_id=run_id,
        protocol="eAODV",
        node_count=10,
        mobility_speed=5.0,
        simulation_area=800,
        simulation_time=6.0,
        is_demo=False
    )
    res_obj = SimulationResult(
        run_id=run_id,
        protocol="eAODV",
        status=SimulationStatus.COMPLETED,
        node_count=10,
        mobility_speed=5.0,
        simulation_area=800,
        simulation_time=6.0,
        pdr=95.0,
        delay_ms=12.0,
        overhead_ratio=0.5,
        energy_consumed_j=1.2,
        remaining_energy_percent=98.8,
        tx_packets=100,
        rx_packets=95,
        dropped_packets=5,
        execution_duration_s=2.0,
        is_demo=False,
        output_link_path=str(valid_file),
        created_at="2026-10-30T10:00:00Z"
    )
    await db_service.save_result(res_obj, [])

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get(f"/api/simulation/{run_id}/wireless-links")
        assert res.status_code == 200
        data = res.json()
        assert data["run_id"] == run_id
        assert data["protocol"] == "eAODV"
        assert data["total_events"] == 3
        assert data["total_tx_attempts"] == 1
        assert data["total_rx_success"] == 1
        assert data["total_rx_drop"] == 1
        assert len(data["events"]) == 3

        # Check fields of rx_ok event
        rx_ev = data["events"][1]
        assert rx_ev["event_type"] == "rx_ok"
        assert rx_ev["packet_uid"] == 42
        assert rx_ev["source_node_id"] == 0
        assert rx_ev["destination_node_id"] == 1
        assert rx_ev["snr_db"] == 22.45

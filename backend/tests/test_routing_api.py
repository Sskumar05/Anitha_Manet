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
async def test_get_routing_trace_unknown_run():
    """
    Tests that requesting routing trace for an unknown run_id returns HTTP 404.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/simulation/sim_non_existent_route_999/routing-trace")
        assert res.status_code == 404
        assert "not found" in res.json()["detail"].lower()

@pytest.mark.asyncio
async def test_get_routing_trace_invalid_run_id_characters():
    """
    Tests that requesting routing trace with path-traversal or special characters returns HTTP 400.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/simulation/sim_.._escape/routing-trace")
        assert res.status_code == 400
        assert "invalid run_id format" in res.json()["detail"].lower()

@pytest.mark.asyncio
async def test_get_routing_trace_historical_run_missing_file():
    """
    Tests that a historical run without a routing trace returns HTTP 404
    with an explanatory message.
    """
    run_id = f"sim_test_hist_route_{uuid.uuid4().hex[:8]}"
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
        res = await client.get(f"/api/simulation/{run_id}/routing-trace")
        assert res.status_code == 404
        assert "routing trace file not found" in res.json()["detail"].lower()

@pytest.mark.asyncio
async def test_get_routing_trace_corrupted_json():
    """
    Tests that a corrupted/malformed routing trace JSON file returns HTTP 500.
    """
    run_id = f"sim_test_corrupt_route_{uuid.uuid4().hex[:8]}"
    run_dir = settings.RESULTS_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    corrupted_file = run_dir / "routing_trace.json"
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
        output_routing_trace_path=str(corrupted_file),
        created_at="2026-10-30T10:00:00Z"
    )
    await db_service.save_result(res_obj, [])

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get(f"/api/simulation/{run_id}/routing-trace")
        assert res.status_code == 500
        assert "corrupted routing trace" in res.json()["detail"].lower()

@pytest.mark.asyncio
async def test_get_routing_trace_valid():
    """
    Tests that a valid NS-3 routing and forwarding trace is correctly parsed, verified, and served.
    """
    run_id = f"sim_test_valid_route_{uuid.uuid4().hex[:8]}"
    run_dir = settings.RESULTS_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    valid_file = run_dir / "routing_trace.json"

    dummy_trace = {
        "trace_type": "ns3_routing_and_forwarding_events",
        "metric_version": 1,
        "node_count": 10,
        "simulation_duration": 6.0,
        "sim_area": 800.0,
        "total_events": 4,
        "total_data_events": 3,
        "total_routing_events": 1,
        "events": [
            {
                "time": 2.01,
                "event_type": "rreq_tx",
                "node_id": 0,
                "prev_hop": None,
                "next_hop": None,
                "packet_uid": 101,
                "packet_size": 48,
                "source_ip": "10.1.1.1",
                "dest_ip": "10.1.1.10",
                "ttl": 30,
                "hop_count": 0,
                "seq_no": 1,
                "details": "RREQ ID=1"
            },
            {
                "time": 2.05,
                "event_type": "data_send",
                "node_id": 0,
                "prev_hop": None,
                "next_hop": None,
                "packet_uid": 102,
                "packet_size": 64,
                "source_ip": "10.1.1.1",
                "dest_ip": "10.1.1.10",
                "ttl": 64,
                "hop_count": 0,
                "seq_no": 0,
                "details": "cbr_originated"
            },
            {
                "time": 2.08,
                "event_type": "data_forward",
                "node_id": 3,
                "prev_hop": 0,
                "next_hop": None,
                "packet_uid": 102,
                "packet_size": 64,
                "source_ip": "10.1.1.1",
                "dest_ip": "10.1.1.10",
                "ttl": 63,
                "hop_count": 0,
                "seq_no": 0,
                "details": "cbr_forwarded"
            },
            {
                "time": 2.11,
                "event_type": "data_delivered",
                "node_id": 9,
                "prev_hop": 3,
                "next_hop": None,
                "packet_uid": 102,
                "packet_size": 64,
                "source_ip": "10.1.1.1",
                "dest_ip": "10.1.1.10",
                "ttl": 62,
                "hop_count": 0,
                "seq_no": 0,
                "details": "cbr_delivered"
            }
        ]
    }
    valid_file.write_text(json.dumps(dummy_trace), encoding="utf-8")

    await db_service.create_run(
        run_id=run_id,
        protocol="AODV",
        node_count=10,
        mobility_speed=10.0,
        simulation_area=800,
        simulation_time=6.0,
        is_demo=False
    )
    res_obj = SimulationResult(
        run_id=run_id,
        protocol="AODV",
        status=SimulationStatus.COMPLETED,
        node_count=10,
        mobility_speed=10.0,
        simulation_area=800,
        simulation_time=6.0,
        pdr=92.0,
        delay_ms=15.0,
        overhead_ratio=0.8,
        energy_consumed_j=2.1,
        remaining_energy_percent=97.9,
        tx_packets=100,
        rx_packets=92,
        dropped_packets=8,
        execution_duration_s=2.5,
        is_demo=False,
        output_routing_trace_path=str(valid_file),
        created_at="2026-10-30T10:00:00Z"
    )
    await db_service.save_result(res_obj, [])

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get(f"/api/simulation/{run_id}/routing-trace")
        assert res.status_code == 200
        body = res.json()
        assert body["run_id"] == run_id
        assert body["total_events"] == 4
        assert body["total_data_events"] == 3
        assert body["total_routing_events"] == 1
        assert len(body["events"]) == 4
        assert body["events"][0]["event_type"] == "rreq_tx"
        assert body["events"][1]["event_type"] == "data_send"
        assert body["events"][2]["event_type"] == "data_forward"
        assert body["events"][2]["prev_hop"] == 0
        assert body["events"][3]["event_type"] == "data_delivered"
        assert body["events"][3]["prev_hop"] == 3

import pytest
import asyncio
from pathlib import Path
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.xml_parser import parse_flowmon_xml, parse_energy_csv
from app.schemas.simulation import ProtocolType

@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "ns3_engine" in data

@pytest.mark.asyncio
async def test_simulation_config():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/simulation/config")
        assert response.status_code == 200
        data = response.json()
        assert "protocols" in data
        assert "default_scenarios" in data

@pytest.mark.asyncio
async def test_demo_simulation_lifecycle():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Start demo run
        payload = {
            "protocol": "eAODV",
            "node_count": 25,
            "mobility_speed": 10.0,
            "simulation_area": 1000,
            "simulation_time": 10.0,
            "rng_seed": 42,
            "is_demo": True
        }
        res = await client.post("/api/simulation/start", json=payload)
        assert res.status_code == 202
        body = res.json()
        assert "run_id" in body
        run_id = body["run_id"]
        assert body["status"] == "queued"

        # Check status immediately
        stat_res = await client.get(f"/api/simulation/{run_id}/status")
        assert stat_res.status_code == 200
        assert stat_res.json()["run_id"] == run_id

        # Wait for demo run to complete (approx 2.5s)
        await asyncio.sleep(2.8)

        # Verify results
        result_res = await client.get(f"/api/simulation/{run_id}/results")
        assert result_res.status_code == 200
        result_data = result_res.json()
        assert result_data["run_id"] == run_id
        assert result_data["status"] == "completed"
        assert result_data["pdr"] > 0
        assert result_data["delay_ms"] > 0
        assert result_data["energy_consumed_j"] > 0
        assert result_data["is_demo"] is True

        # Check history includes this run
        hist_res = await client.get("/api/simulation/history")
        assert hist_res.status_code == 200
        history = hist_res.json()
        assert any(item["run_id"] == run_id for item in history)

def test_xml_and_energy_parser(tmp_path: Path):
    # Test valid FlowMonitor XML parsing
    xml_path = tmp_path / "test_flowmon.xml"
    xml_content = """<?xml version="1.0" ?>
<FlowMonitor>
  <FlowStats>
    <Flow flowId="1" timeFirstTxPacket="+0.0ns" timeFirstRxPacket="+1000000.0ns"
          delaySum="200000000ns" txPackets="100" rxPackets="90" lostPackets="10"
          txBytes="6400" rxBytes="5760">
    </Flow>
    <Flow flowId="2" timeFirstTxPacket="+0.0ns" timeFirstRxPacket="+1000000.0ns"
          delaySum="160000000ns" txPackets="100" rxPackets="80" lostPackets="20"
          txBytes="6400" rxBytes="5120">
    </Flow>
  </FlowStats>
</FlowMonitor>"""
    xml_path.write_text(xml_content, encoding="utf-8")

    metrics = parse_flowmon_xml(xml_path)
    assert metrics["tx_packets"] == 200
    assert metrics["rx_packets"] == 170
    assert metrics["lost_packets"] == 30
    assert metrics["pdr"] == 85.0
    # delaySum = 360,000,000 ns / 170 / 1e6 = ~2.12 ms
    assert metrics["delay_ms"] == 2.12

    # Test Energy CSV parsing
    csv_path = tmp_path / "test_energy.csv"
    csv_content = """node_id,initial_energy,remaining_energy,consumed_energy,residual_percentage
0,100.0,98.5,1.5,98.5
1,100.0,97.5,2.5,97.5
"""
    csv_path.write_text(csv_content, encoding="utf-8")

    energy_metrics = parse_energy_csv(csv_path)
    assert energy_metrics["avg_consumed_energy_j"] == 2.0
    assert energy_metrics["avg_residual_percent"] == 98.0
    assert energy_metrics["nodes_reported"] == 2

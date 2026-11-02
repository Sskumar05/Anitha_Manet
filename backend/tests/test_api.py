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
        assert data["protocols"] == ["AODV", "eAODV"]
        assert "sweep_metadata" in data
        assert "speed" in data["sweep_metadata"]
        assert "nodes" in data["sweep_metadata"]
        assert "traffic" in data["sweep_metadata"]

@pytest.mark.asyncio
async def test_sweep_endpoints():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Check latest query
        latest_res = await client.get("/api/simulation/sweep/latest?parameter=speed")
        assert latest_res.status_code == 200

        # Start sweep request
        res = await client.post("/api/simulation/sweep/start", json={
            "parameter": "speed",
            "points": [5.0, 10.0],
            "simulation_time": 5.0,
            "rng_seed": 123
        })
        assert res.status_code == 202
        body = res.json()
        assert "sweep_id" in body
        sweep_id = body["sweep_id"]

        # Check status
        st_res = await client.get(f"/api/simulation/sweep/{sweep_id}/status")
        assert st_res.status_code == 200
        st = st_res.json()
        assert st["sweep_id"] == sweep_id
        assert len(st["points"]) == 2
        assert st["parameter"] == "speed"

        # Cancel sweep
        cancel_res = await client.post(f"/api/simulation/sweep/{sweep_id}/cancel")
        assert cancel_res.status_code == 200

@pytest.mark.asyncio
async def test_demo_mode_rejection():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
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

        # Wait briefly for execution task to reject demo mode
        await asyncio.sleep(0.5)

        # Check status shows failed because demo mode is removed
        stat_res = await client.get(f"/api/simulation/{run_id}/status")
        assert stat_res.status_code == 200
        stat_data = stat_res.json()
        assert stat_data["status"] == "failed"
        assert any("Demo mode has been permanently removed" in log for log in stat_data["logs"])

@pytest.mark.asyncio
async def test_both_protocol_handling():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "protocol": "BOTH",
            "node_count": 25,
            "mobility_speed": 10.0,
            "simulation_area": 1000,
            "simulation_time": 10.0,
            "rng_seed": 42,
            "is_demo": False
        }
        res = await client.post("/api/simulation/start", json=payload)
        assert res.status_code == 202
        run_id = res.json()["run_id"]

        await asyncio.sleep(0.5)
        stat_res = await client.get(f"/api/simulation/{run_id}/status")
        assert stat_res.status_code == 200
        stat_data = stat_res.json()
        assert stat_data["status"] == "failed"
        assert any("cannot be executed as a single run" in log for log in stat_data["logs"])

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
  <Ipv4FlowClassifier>
    <Flow flowId="1" sourceAddress="10.1.1.1" destinationAddress="10.1.1.2" protocol="17" sourcePort="49153" destinationPort="9" />
    <Flow flowId="2" sourceAddress="10.1.1.3" destinationAddress="10.1.1.4" protocol="17" sourcePort="49154" destinationPort="10" />
  </Ipv4FlowClassifier>
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

    # Test missing file raises FileNotFoundError
    non_existent = tmp_path / "does_not_exist.csv"
    with pytest.raises(FileNotFoundError):
        parse_energy_csv(non_existent)

    # Test empty CSV raises ValueError
    empty_csv = tmp_path / "empty.csv"
    empty_csv.write_text("node_id,initial_energy,remaining_energy,consumed_energy,residual_percentage\n", encoding="utf-8")
    with pytest.raises(ValueError):
        parse_energy_csv(empty_csv)

@pytest.mark.asyncio
async def test_sweep_studio_config_valid():
    """
    Test Option C: Mode B (Studio Configuration) validation and persistence.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "parameter": "speed",
            "config_mode": "studio",
            "studio_config": {
                "protocol": "eAODV",
                "node_count": 42,
                "mobility_speed": 15.0,
                "simulation_area": 850,
                "simulation_time": 8.0,
                "rng_seed": 99,
                "traffic_flows": 7
            },
            "points": [5.0, 10.0]
        }
        res = await client.post("/api/simulation/sweep/start", json=payload)
        assert res.status_code == 202
        data = res.json()
        assert "sweep_id" in data
        sweep_id = data["sweep_id"]

        # Check status and base_config
        st_res = await client.get(f"/api/simulation/sweep/{sweep_id}/status")
        assert st_res.status_code == 200
        st = st_res.json()
        base = st["base_config"]
        assert base["config_mode"] == "studio"
        assert base["node_count"] == 42
        assert base["simulation_area"] == 850
        assert base["simulation_time"] == 8.0
        assert base["rng_seed"] == 99
        assert base["traffic_flows"] == 7

        # Clean up
        await client.post(f"/api/simulation/sweep/{sweep_id}/cancel")

@pytest.mark.asyncio
async def test_sweep_studio_config_invalid_duration():
    """
    Test validation failure when studio simulation_time is below 5.0 seconds.
    Pydantic schema validation rejects values < 5.0s with HTTP 422.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "parameter": "speed",
            "config_mode": "studio",
            "studio_config": {
                "protocol": "eAODV",
                "node_count": 30,
                "mobility_speed": 10.0,
                "simulation_area": 1000,
                "simulation_time": 3.0,
                "rng_seed": 1,
                "traffic_flows": 4
            }
        }
        res = await client.post("/api/simulation/sweep/start", json=payload)
        assert res.status_code in (400, 422)
        body = res.json()
        assert "simulation_time" in str(body) or "duration" in str(body)

@pytest.mark.asyncio
async def test_sweep_studio_config_missing():
    """
    Test validation failure when config_mode='studio' but studio_config is omitted.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "parameter": "speed",
            "config_mode": "studio"
        }
        res = await client.post("/api/simulation/sweep/start", json=payload)
        assert res.status_code == 400
        assert "Studio configuration must be provided" in res.json()["detail"]

def test_build_point_config_isolation():
    """
    Verify parameter isolation: the swept parameter must always take the point value,
    while non-swept parameters are inherited from the base Studio configuration.
    """
    from app.services.simulation_service import simulation_service
    from app.schemas.simulation import SweepParameter, ProtocolType

    base = {
        "node_count": 45,
        "mobility_speed": 12.0,
        "simulation_area": 800,
        "simulation_time": 10.0,
        "rng_seed": 5,
        "traffic_flows": 7,
    }

    # When sweeping SPEED: mobility_speed must equal point value, others from base
    cfg_speed = simulation_service._build_point_config(SweepParameter.SPEED, 25.0, ProtocolType.AODV, base)
    assert cfg_speed.mobility_speed == 25.0
    assert cfg_speed.node_count == 45
    assert cfg_speed.simulation_area == 800
    assert cfg_speed.simulation_time == 10.0
    assert cfg_speed.rng_seed == 5
    assert cfg_speed.traffic_flows == 7

    # When sweeping NODES: node_count must equal point value, others from base
    cfg_nodes = simulation_service._build_point_config(SweepParameter.NODES, 75.0, ProtocolType.eAODV, base)
    assert cfg_nodes.node_count == 75
    assert cfg_nodes.mobility_speed == 12.0
    assert cfg_nodes.simulation_area == 800
    assert cfg_nodes.traffic_flows == 7

    # When sweeping TRAFFIC: traffic_flows must equal point value, others from base
    cfg_traffic = simulation_service._build_point_config(SweepParameter.TRAFFIC, 16.0, ProtocolType.eAODV, base)
    assert cfg_traffic.traffic_flows == 16
    assert cfg_traffic.node_count == 45
    assert cfg_traffic.mobility_speed == 12.0

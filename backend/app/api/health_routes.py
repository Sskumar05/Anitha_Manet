import shutil
import subprocess
from fastapi import APIRouter
from app.core.config import settings

_cached_ns3: dict = {"detected": None, "details": ""}
router = APIRouter(tags=["Health & Info"])

@router.get("/health")
async def health_check():
    """
    Returns system status, backend health, and NS-3 environment availability.
    """
    wsl_available = shutil.which("wsl") is not None
    ns3_detected = False
    details = ""

    if _cached_ns3["detected"] is True:
        ns3_detected = True
        details = _cached_ns3["details"]
    elif wsl_available and settings.USE_WSL:
        try:
            # Probe NS-3 directory in WSL (15s timeout for cold start)
            res = subprocess.run(
                ["wsl", "-d", settings.WSL_DISTRO, "--", "bash", "-c", f"test -d '{settings.NS3_DIR}' && echo 'OK'"],
                capture_output=True,
                text=True,
                timeout=15
            )
            if "OK" in res.stdout:
                ns3_detected = True
                details = f"NS-3 detected in WSL2 ({settings.WSL_DISTRO}) at {settings.NS3_DIR}"
                _cached_ns3["detected"] = True
                _cached_ns3["details"] = details
            else:
                details = f"NS-3 directory not found at {settings.NS3_DIR}"
        except Exception as e:
            details = f"Error querying WSL: {str(e)}"
    else:
        details = "Running in native host mode (WSL not configured or disabled)"

    return {
        "status": "healthy",
        "service": "MANET Routing Research Backend",
        "version": "2.0.0",
        "ns3_engine": {
            "wsl_available": wsl_available,
            "ns3_detected": ns3_detected,
            "distro": settings.WSL_DISTRO,
            "ns3_dir": settings.NS3_DIR,
            "details": details
        }
    }

@router.get("/simulation/config")
async def get_simulation_default_config():
    """
    Returns allowable simulation parameter ranges and real sweep parameter metadata.
    Static benchmark datasets have been completely removed.
    """
    return {
        "protocols": ["AODV", "eAODV"],
        "node_count": {"min": 10, "max": 100, "default": 50, "step": 5},
        "mobility_speed": {"min": 1.0, "max": 25.0, "default": 10.0, "unit": "m/s", "step": 1.0},
        "traffic_flows": {"min": 1, "max": 30, "default": 4, "step": 1},
        "simulation_area": [
            {"value": 500, "label": "500×500m (Dense)"},
            {"value": 1000, "label": "1000×1000m (Standard)", "default": True},
            {"value": 2000, "label": "2000×2000m (Sparse)"}
        ],
        "sweep_metadata": {
            "speed": {
                "parameter": "speed",
                "label": "Node Speed",
                "unit": "m/s",
                "x_title": "Node Speed (m/s)",
                "default_points": [5.0, 10.0, 15.0, 20.0],
                "default_base_config": {
                    "node_count": 30,
                    "simulation_area": 1000,
                    "simulation_time": 5.0,
                    "rng_seed": 1,
                    "traffic_flows": 4
                }
            },
            "nodes": {
                "parameter": "nodes",
                "label": "Number of Nodes",
                "unit": "nodes",
                "x_title": "Number of Nodes",
                "default_points": [20.0, 30.0, 50.0, 70.0],
                "default_base_config": {
                    "mobility_speed": 10.0,
                    "simulation_area": 1000,
                    "simulation_time": 5.0,
                    "rng_seed": 1,
                    "traffic_flows": 4
                }
            },
            "traffic": {
                "parameter": "traffic",
                "label": "Traffic Load",
                "unit": "flows",
                "x_title": "Traffic Load (flows)",
                "default_points": [2.0, 4.0, 8.0, 12.0],
                "default_base_config": {
                    "node_count": 35,
                    "mobility_speed": 10.0,
                    "simulation_area": 1000,
                    "simulation_time": 5.0,
                    "rng_seed": 1
                }
            }
        }
    }

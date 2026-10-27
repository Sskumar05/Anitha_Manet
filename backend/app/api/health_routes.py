import shutil
import subprocess
from fastapi import APIRouter
from app.core.config import settings

router = APIRouter(tags=["Health & Info"])

@router.get("/health")
async def health_check():
    """
    Returns system status, backend health, and NS-3 environment availability.
    """
    wsl_available = shutil.which("wsl") is not None
    ns3_detected = False
    details = ""

    if wsl_available and settings.USE_WSL:
        try:
            # Probe NS-3 directory in WSL
            res = subprocess.run(
                ["wsl", "-d", settings.WSL_DISTRO, "--", "bash", "-c", f"test -d '{settings.NS3_DIR}' && echo 'OK'"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if "OK" in res.stdout:
                ns3_detected = True
                details = f"NS-3 detected in WSL2 ({settings.WSL_DISTRO}) at {settings.NS3_DIR}"
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
    Returns allowable simulation parameter ranges and default configurations.
    """
    return {
        "protocols": ["AODV", "eAODV", "BOTH"],
        "node_count": {"min": 10, "max": 100, "default": 50, "step": 5},
        "mobility_speed": {"min": 1.0, "max": 25.0, "default": 10.0, "unit": "m/s", "step": 1.0},
        "simulation_area": [
            {"value": 500, "label": "500×500m (Dense)"},
            {"value": 1000, "label": "1000×1000m (Standard)", "default": True},
            {"value": 2000, "label": "2000×2000m (Sparse)"}
        ],
        "default_scenarios": {
            "speed": {
                "labels": ["2 m/s", "5 m/s", "10 m/s", "15 m/s", "20 m/s", "25 m/s"],
                "pdr": {"aodv": [87, 84, 78, 70, 62, 53], "eaodv": [94, 92, 91, 88, 84, 79]},
                "delay": {"aodv": [28, 36, 54, 72, 91, 118], "eaodv": [18, 24, 42, 56, 68, 84]},
                "overhead": {"aodv": [0.22, 0.30, 0.44, 0.58, 0.72, 0.88], "eaodv": [0.16, 0.22, 0.31, 0.40, 0.51, 0.63]},
                "energy": {"aodv": [1.2, 1.5, 1.8, 2.2, 2.6, 3.1], "eaodv": [0.9, 1.1, 1.24, 1.5, 1.8, 2.2]}
            },
            "nodes": {
                "labels": ["20", "30", "50", "70", "100"],
                "pdr": {"aodv": [82, 79, 73, 68, 61], "eaodv": [91, 89, 86, 83, 79]},
                "delay": {"aodv": [32, 45, 58, 75, 98], "eaodv": [22, 31, 42, 54, 70]},
                "overhead": {"aodv": [0.19, 0.28, 0.44, 0.60, 0.78], "eaodv": [0.14, 0.21, 0.31, 0.43, 0.58]},
                "energy": {"aodv": [0.9, 1.2, 1.6, 2.1, 2.8], "eaodv": [0.7, 0.9, 1.2, 1.5, 2.0]}
            },
            "traffic": {
                "labels": ["5 flows", "10 flows", "20 flows", "30 flows", "50 flows"],
                "pdr": {"aodv": [88, 82, 74, 64, 54], "eaodv": [95, 91, 87, 80, 72]},
                "delay": {"aodv": [25, 40, 62, 88, 122], "eaodv": [18, 30, 46, 65, 90]},
                "overhead": {"aodv": [0.18, 0.30, 0.50, 0.72, 0.95], "eaodv": [0.14, 0.23, 0.37, 0.54, 0.72]},
                "energy": {"aodv": [0.8, 1.2, 1.7, 2.3, 3.0], "eaodv": [0.6, 0.9, 1.3, 1.7, 2.3]}
            }
        }
    }

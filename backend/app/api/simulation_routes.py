from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from app.schemas.simulation import (
    SimulationConfig,
    SimulationResult,
    SimulationRunStatus,
    SimulationHistoryItem,
    SimulationMobilityTrace,
    SimulationLinkTrace,
    SimulationRoutingTrace,
    SweepResult,
    SweepStartRequest,
    SweepParameter,
)
from app.services.simulation_service import simulation_service
from app.services.db_service import db_service

router = APIRouter(prefix="/simulation", tags=["Simulation Control"])

@router.post("/start", status_code=status.HTTP_202_ACCEPTED)
async def start_simulation(config: SimulationConfig):
    """
    Submits a new simulation request (AODV or eAODV) to be run via NS-3 or analytical fallback.
    Returns the unique run_id.
    """
    try:
        run_id = await simulation_service.start_simulation(config)
        return {
            "run_id": run_id,
            "status": "queued",
            "message": f"Simulation {run_id} has been queued successfully.",
            "protocol": config.protocol.value,
            "is_demo": config.is_demo,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initialize simulation: {str(e)}",
        )

@router.get("/{run_id}/status", response_model=SimulationRunStatus)
async def get_simulation_status(run_id: str):
    """
    Retrieves current execution status, progress percentage, and latest log messages.
    """
    status_obj = await simulation_service.get_status(run_id)
    if not status_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Simulation run '{run_id}' not found.",
        )
    return status_obj

@router.get("/{run_id}/results", response_model=SimulationResult)
async def get_simulation_results(run_id: str):
    """
    Retrieves the final parsed metrics (PDR, Delay, Overhead, Energy) for a completed run.
    """
    result = await simulation_service.get_results(run_id)
    if not result:
        # Check if run exists but isn't completed
        status_obj = await simulation_service.get_status(run_id)
        if status_obj:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Simulation '{run_id}' is currently in state '{status_obj.status.value}'. Results not yet available.",
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Simulation run '{run_id}' not found.",
        )
    return result

@router.get("/{run_id}/mobility", response_model=SimulationMobilityTrace)
async def get_simulation_mobility(run_id: str):
    """
    Retrieves the genuine NS-3 timestamped node mobility trace for a specific simulation run.
    Contains actual X, Y, Z coordinates and simulation timestamps recorded by NS-3.41.
    """
    return await simulation_service.get_mobility_trace(run_id)

@router.get("/{run_id}/wireless-links", response_model=SimulationLinkTrace)
async def get_simulation_wireless_links(run_id: str):
    """
    Retrieves genuine NS-3 wireless link communication evidence for a specific simulation run.
    Contains actual transmission attempts, successful receptions (with SNR), and frame drops.
    """
    return await simulation_service.get_wireless_link_trace(run_id)

@router.get("/{run_id}/routing-trace", response_model=SimulationRoutingTrace)
async def get_simulation_routing_trace(run_id: str):
    """
    Retrieves genuine NS-3 multi-hop routing protocol (RREQ/RREP/RERR) and data packet
    forwarding hop events for a specific simulation run.
    """
    return await simulation_service.get_routing_trace(run_id)

@router.post("/{run_id}/cancel")
async def cancel_simulation(run_id: str):
    """
    Cancels an actively executing or queued simulation run.
    """
    success = await simulation_service.cancel_simulation(run_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Simulation run '{run_id}' is not active or could not be cancelled.",
        )
    return {"message": f"Simulation '{run_id}' was cancelled.", "run_id": run_id}

@router.get("/history", response_model=List[SimulationHistoryItem])
async def get_simulation_history(limit: int = Query(default=30, ge=1, le=100)):
    """
    Fetches past simulation executions and summary metrics from SQLite.
    """
    return await db_service.get_history(limit=limit)

@router.post("/sweep/start", status_code=status.HTTP_202_ACCEPTED)
async def start_sweep(request: SweepStartRequest):
    """
    Starts a real backend-managed NS-3 simulation sweep across a chosen parameter (speed, nodes, traffic).
    """
    try:
        sweep_id = await simulation_service.start_sweep(request)
        return {
            "sweep_id": sweep_id,
            "status": "queued",
            "message": f"Sweep {sweep_id} vs {request.parameter.value} has been queued successfully.",
            "parameter": request.parameter.value,
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start simulation sweep: {str(e)}",
        )

@router.get("/sweep/latest", response_model=Optional[SweepResult])
async def get_latest_sweep(parameter: SweepParameter = Query(..., description="Parameter: speed, nodes, or traffic")):
    """
    Returns the latest completed real NS-3 sweep for the specified parameter.
    """
    return await simulation_service.get_latest_sweep(parameter.value)

@router.get("/sweep/{sweep_id}/status", response_model=SweepResult)
async def get_sweep_status(sweep_id: str):
    """
    Retrieves current status, progress, and per-point results for a sweep run.
    """
    res = await simulation_service.get_sweep_status(sweep_id)
    if not res:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sweep '{sweep_id}' not found.",
        )
    return res

@router.post("/sweep/{sweep_id}/cancel")
async def cancel_sweep(sweep_id: str):
    """
    Cancels an active simulation sweep and its child NS-3 runs.
    """
    success = await simulation_service.cancel_sweep(sweep_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sweep '{sweep_id}' is not active or could not be cancelled.",
        )
    return {"message": f"Sweep '{sweep_id}' was cancelled.", "sweep_id": sweep_id}

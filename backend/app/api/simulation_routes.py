from typing import List
from fastapi import APIRouter, HTTPException, Query, status
from app.schemas.simulation import (
    SimulationConfig,
    SimulationResult,
    SimulationRunStatus,
    SimulationHistoryItem,
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

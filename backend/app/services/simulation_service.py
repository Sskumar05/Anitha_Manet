import asyncio
import os
import re
import time
import uuid
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional, Set, Callable, List

from fastapi import HTTPException, status

from app.core.config import settings
from app.schemas.simulation import (
    SimulationConfig,
    SimulationResult,
    SimulationStatus,
    SimulationRunStatus,
    ProtocolType,
    SweepParameter,
    SweepStatus,
    SweepConfigMode,
    SweepRunPoint,
    SweepResult,
    SweepStartRequest,
    NodePosition,
    NodeMobility,
    SimulationMobilityTrace,
    WirelessLinkEvent,
    SimulationLinkTrace,
    RoutingHopEvent,
    SimulationRoutingTrace,
)
from app.services.db_service import db_service
from app.services.xml_parser import (
    parse_flowmon_xml,
    parse_energy_csv,
    parse_routing_json,
    parse_routing_from_logs,
)

logger = logging.getLogger("simulation_service")

class SimulationService:
    def __init__(self):
        self.active_processes: Dict[str, Any] = {}
        self.run_statuses: Dict[str, SimulationRunStatus] = {}
        self.run_results: Dict[str, SimulationResult] = {}
        self.ws_subscribers: Dict[str, Set[Any]] = {}
        self.execution_lock = asyncio.Lock()
        self.active_sweeps: Dict[str, SweepResult] = {}
        self.sweep_tasks: Dict[str, asyncio.Task] = {}

    def register_ws(self, run_id: str, websocket):
        if run_id not in self.ws_subscribers:
            self.ws_subscribers[run_id] = set()
        self.ws_subscribers[run_id].add(websocket)

    def unregister_ws(self, run_id: str, websocket):
        if run_id in self.ws_subscribers:
            self.ws_subscribers[run_id].discard(websocket)
            if not self.ws_subscribers[run_id]:
                del self.ws_subscribers[run_id]

    async def broadcast_ws(self, run_id: str, message: Dict[str, Any]):
        if run_id in self.ws_subscribers:
            payload = json.dumps(message)
            dead = []
            for ws in list(self.ws_subscribers[run_id]):
                try:
                    await ws.send_text(payload)
                except Exception:
                    dead.append(ws)
            for d in dead:
                self.ws_subscribers[run_id].discard(d)

    async def start_simulation(self, config: SimulationConfig) -> str:
        run_id = f"sim_{int(time.time())}_{uuid.uuid4().hex[:6]}"
        now = datetime.now(timezone.utc).isoformat()
        
        status_obj = SimulationRunStatus(
            run_id=run_id,
            status=SimulationStatus.QUEUED,
            protocol=config.protocol.value,
            progress_percent=0,
            current_step="Queued for execution",
            logs=[f"[INIT] Simulation run {run_id} created."],
            created_at=now,
            updated_at=now,
        )
        self.run_statuses[run_id] = status_obj

        # Record in DB
        await db_service.create_run(
            run_id=run_id,
            protocol=config.protocol.value,
            node_count=config.node_count,
            mobility_speed=config.mobility_speed,
            simulation_area=config.simulation_area,
            simulation_time=config.simulation_time,
            is_demo=config.is_demo,
        )

        # Launch async task
        asyncio.create_task(self._execute_run(run_id, config))
        return run_id

    async def _execute_run(self, run_id: str, config: SimulationConfig):
        run_dir = settings.RESULTS_DIR / run_id
        run_dir.mkdir(parents=True, exist_ok=True)
        xml_file = run_dir / "flowmon_results.xml"
        energy_file = run_dir / "energy_results.csv"
        routing_file = run_dir / "routing_results.json"
        mobility_file = run_dir / "mobility_trace.json"

        status_obj = self.run_statuses[run_id]
        status_obj.status = SimulationStatus.RUNNING
        status_obj.progress_percent = 5
        status_obj.current_step = "Starting simulation engine"
        await db_service.update_status(run_id, SimulationStatus.RUNNING, status_obj.logs)

        start_time = time.time()

        if config.is_demo:
            status_obj.status = SimulationStatus.FAILED
            status_obj.current_step = "Demo mode disabled"
            status_obj.logs.append("[ERROR] Demo mode has been permanently removed. Only real NS-3 simulations are supported.")
            await db_service.update_status(run_id, SimulationStatus.FAILED, status_obj.logs)
            await self.broadcast_ws(run_id, {"type": "failed", "message": "Demo mode is permanently disabled."})
            return

        # Attempt to run real NS-3 via WSL2
        try:
            # Convert Windows path to WSL path
            # Example: C:\Users\divya\... -> /mnt/c/Users/divya/...
            win_path_str = str(run_dir.resolve()).replace("\\", "/")
            if len(win_path_str) > 1 and win_path_str[1] == ":":
                drive = win_path_str[0].lower()
                wsl_run_dir = f"/mnt/{drive}{win_path_str[2:]}"
            else:
                wsl_run_dir = win_path_str

            # Use space-free /tmp in WSL for direct NS-3 argument parsing, then copy to destination
            tmp_run_dir = f"/tmp/{run_id}"
            tmp_xml = f"{tmp_run_dir}/flowmon_results.xml"
            tmp_energy = f"{tmp_run_dir}/energy_results.csv"
            tmp_routing = f"{tmp_run_dir}/routing_results.json"
            tmp_mobility = f"{tmp_run_dir}/mobility_trace.json"
            tmp_link = f"{tmp_run_dir}/wireless_link_trace.json"
            tmp_route = f"{tmp_run_dir}/routing_trace.json"

            # Check target C++ binary or script
            if config.protocol == ProtocolType.eAODV:
                target_prog = "scratch/manet-eaodv"
            elif config.protocol == ProtocolType.AODV:
                target_prog = "scratch/manet-baseline"
            else:
                status_obj.status = SimulationStatus.FAILED
                status_obj.current_step = "Unsupported protocol"
                status_obj.logs.append("[ERROR] Protocol 'BOTH' cannot be executed as a single run. Please run AODV and eAODV individually.")
                await db_service.update_status(run_id, SimulationStatus.FAILED, status_obj.logs)
                await self.broadcast_ws(run_id, {
                    "type": "failed",
                    "message": "Protocol 'BOTH' must be evaluated as individual AODV and eAODV simulation runs."
                })
                return

            flows_arg = f" --nFlows={config.traffic_flows}" if config.traffic_flows is not None else ""
            bash_script = (
                f"set -e && "
                f"mkdir -p '{tmp_run_dir}' && "
                f"cd '{settings.NS3_DIR}' && "
                f"./ns3 run '{target_prog} "
                f"--nNodes={config.node_count} --simulationTime={config.simulation_time} "
                f"--simArea={config.simulation_area} --maxSpeed={config.mobility_speed} "
                f"--outputFile={tmp_xml} --energyFile={tmp_energy} --routingFile={tmp_routing} --mobilityFile={tmp_mobility} --linkFile={tmp_link} --routeTraceFile={tmp_route} --RngSeed={config.rng_seed}{flows_arg}' && "
                f"cp -f '{tmp_xml}' '{wsl_run_dir}/flowmon_results.xml' && "
                f"cp -f '{tmp_energy}' '{wsl_run_dir}/energy_results.csv' && "
                f"cp -f '{tmp_routing}' '{wsl_run_dir}/routing_results.json' || true && "
                f"cp -f '{tmp_mobility}' '{wsl_run_dir}/mobility_trace.json' || true && "
                f"cp -f '{tmp_link}' '{wsl_run_dir}/wireless_link_trace.json' || true && "
                f"cp -f '{tmp_route}' '{wsl_run_dir}/routing_trace.json' || true && "
                f"rm -rf '{tmp_run_dir}'"
            )

            cmd_args = ["wsl", "-d", settings.WSL_DISTRO, "--", "bash", "-c", bash_script]
            status_obj.logs.append(f"[EXEC] Dispatching NS-3 via WSL2 ({config.protocol.value}): {target_prog}")
            await self.broadcast_ws(run_id, {"type": "log", "text": f"[EXEC] Launching NS-3 via WSL2 ({config.protocol.value})"})

            import subprocess

            async with self.execution_lock:
                proc = subprocess.Popen(
                    cmd_args,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                )
                self.active_processes[run_id] = proc

                # Read stdout line by line via worker thread
                while True:
                    line = await asyncio.to_thread(proc.stdout.readline)
                    if not line:
                        break
                    decoded = line.strip()
                    if decoded:
                        status_obj.logs.append(decoded)
                        if len(status_obj.logs) > 200:
                            status_obj.logs.pop(0)

                        # Update progress estimate
                        if "[TOPOLOGY]" in decoded:
                            status_obj.progress_percent = min(35, status_obj.progress_percent + 2)
                            status_obj.current_step = "Nodes initialized and positioned"
                        elif "[RREQ]" in decoded or "[RREP]" in decoded or "[LAR]" in decoded or "[TRUST]" in decoded:
                            status_obj.progress_percent = min(85, status_obj.progress_percent + 4)
                            status_obj.current_step = "Routing discovery & packet transmission"

                        await self.broadcast_ws(run_id, {
                            "type": "log",
                            "text": decoded,
                            "progress": status_obj.progress_percent,
                            "step": status_obj.current_step
                        })

                await asyncio.to_thread(proc.wait)
                self.active_processes.pop(run_id, None)

            if proc.returncode != 0:
                status_obj.logs.append(f"[WARN] NS-3 returned non-zero code: {proc.returncode}. Checking generated trace files.")

            # Parse results
            if xml_file.exists() and energy_file.exists():
                routing_counts = None
                if routing_file.exists():
                    routing_counts = parse_routing_json(routing_file)
                if not routing_counts:
                    routing_counts = parse_routing_from_logs(status_obj.logs)

                routing_control_packets = (
                    routing_counts.get("total_routing_packets") if routing_counts else None
                )

                xml_metrics = parse_flowmon_xml(xml_file, routing_control_packets=routing_control_packets)
                energy_metrics = parse_energy_csv(energy_file)

                duration = round(time.time() - start_time, 2)
                res = SimulationResult(
                    run_id=run_id,
                    protocol=config.protocol.value,
                    status=SimulationStatus.COMPLETED,
                    node_count=config.node_count,
                    mobility_speed=config.mobility_speed,
                    simulation_area=config.simulation_area,
                    simulation_time=config.simulation_time,
                    pdr=xml_metrics["pdr"],
                    delay_ms=xml_metrics["delay_ms"],
                    overhead_ratio=xml_metrics["overhead_ratio"],
                    routing_packets=routing_control_packets,
                    metric_version=2,
                    energy_consumed_j=energy_metrics["avg_consumed_energy_j"],
                    remaining_energy_percent=energy_metrics["avg_residual_percent"],
                    tx_packets=xml_metrics["tx_packets"],
                    rx_packets=xml_metrics["rx_packets"],
                    dropped_packets=xml_metrics["lost_packets"],
                    execution_duration_s=duration,
                    is_demo=False,
                    output_xml_path=str(xml_file),
                    output_energy_path=str(energy_file),
                    output_routing_path=str(routing_file) if routing_file.exists() else None,
                    output_mobility_path=str(mobility_file) if mobility_file.exists() else None,
                    output_link_path=str(run_dir / "wireless_link_trace.json") if (run_dir / "wireless_link_trace.json").exists() else None,
                    output_routing_trace_path=str(run_dir / "routing_trace.json") if (run_dir / "routing_trace.json").exists() else None,
                    created_at=datetime.now(timezone.utc).isoformat(),
                )

                self.run_results[run_id] = res
                nrl_str = f"{res.overhead_ratio}" if res.overhead_ratio is not None else "undefined (0 RX)"
                delay_str = f"{res.delay_ms}ms" if res.delay_ms is not None else "undefined (0 RX)"
                status_obj.logs.append(
                    f"[SUCCESS] Real NS-3 results parsed: PDR={res.pdr}%, Delay={delay_str}, "
                    f"Energy={res.energy_consumed_j}J, NRL={nrl_str} (Routing Control Packets={res.routing_packets})"
                )
                await db_service.save_result(res, status_obj.logs)

                status_obj.status = SimulationStatus.COMPLETED
                status_obj.progress_percent = 100
                status_obj.current_step = "Simulation completed successfully"
                await self.broadcast_ws(run_id, {"type": "completed", "result": res.model_dump()})
                return

            else:
                missing = []
                if not xml_file.exists():
                    missing.append(xml_file.name)
                if not energy_file.exists():
                    missing.append(energy_file.name)

                status_obj.status = SimulationStatus.FAILED
                status_obj.current_step = "Simulation failed: Output trace missing"
                status_obj.logs.append(f"[ERROR] NS-3 simulation finished without generating expected traces: {', '.join(missing)}. Process return code: {proc.returncode}.")
                await db_service.update_status(run_id, SimulationStatus.FAILED, status_obj.logs)
                await self.broadcast_ws(run_id, {
                    "type": "failed",
                    "message": f"NS-3 simulation did not produce the expected trace files: {', '.join(missing)}."
                })
                return

        except Exception as e:
            logger.exception("Error executing NS-3 process")
            status_obj.status = SimulationStatus.FAILED
            status_obj.current_step = "Subprocess execution failed"
            status_obj.logs.append(f"[ERROR] Subprocess execution failed: {str(e)}")
            await db_service.update_status(run_id, SimulationStatus.FAILED, status_obj.logs)
            await self.broadcast_ws(run_id, {
                "type": "failed",
                "message": f"Subprocess execution failed: {str(e)}"
            })
            return

    async def cancel_simulation(self, run_id: str) -> bool:
        if run_id in self.active_processes:
            proc = self.active_processes[run_id]
            try:
                proc.terminate()
            except Exception:
                pass
            self.active_processes.pop(run_id, None)

        if run_id in self.run_statuses:
            self.run_statuses[run_id].status = SimulationStatus.CANCELLED
            self.run_statuses[run_id].current_step = "Simulation cancelled by user"
            self.run_statuses[run_id].logs.append("[CANCEL] Process cancelled by user request.")
            await db_service.update_status(run_id, SimulationStatus.CANCELLED, self.run_statuses[run_id].logs)
            await self.broadcast_ws(run_id, {"type": "cancelled", "run_id": run_id})
            return True
        return False

    async def get_status(self, run_id: str) -> Optional[SimulationRunStatus]:
        if run_id in self.run_statuses:
            return self.run_statuses[run_id]
        
        # Check database
        data = await db_service.get_run(run_id)
        if data:
            return SimulationRunStatus(
                run_id=data["run_id"],
                status=SimulationStatus(data["status"]),
                protocol=data["protocol"],
                progress_percent=100 if data["status"] == "completed" else 0,
                current_step=f"Run {data['status']}",
                logs=data.get("logs", []),
                created_at=data["created_at"],
                updated_at=data.get("completed_at") or data["created_at"],
            )
        return None

    async def get_results(self, run_id: str) -> Optional[SimulationResult]:
        if run_id in self.run_results:
            return self.run_results[run_id]
        
        data = await db_service.get_run(run_id)
        if not data or data["status"] != SimulationStatus.COMPLETED.value:
            return None
        
        return SimulationResult(
            run_id=data["run_id"],
            protocol=data["protocol"],
            status=SimulationStatus(data["status"]),
            node_count=data["node_count"],
            mobility_speed=data["mobility_speed"],
            simulation_area=data["simulation_area"],
            simulation_time=data["simulation_time"],
            pdr=data["pdr"] if data["pdr"] is not None else 0.0,
            delay_ms=data["delay_ms"],
            overhead_ratio=data.get("overhead_ratio"),
            routing_packets=data.get("routing_packets"),
            metric_version=data.get("metric_version", 1),
            energy_consumed_j=data["energy_consumed_j"] if data["energy_consumed_j"] is not None else 0.0,
            remaining_energy_percent=data["remaining_energy_percent"] if data["remaining_energy_percent"] is not None else 0.0,
            tx_packets=data["tx_packets"] if data["tx_packets"] is not None else 0,
            rx_packets=data["rx_packets"] if data["rx_packets"] is not None else 0,
            dropped_packets=data["dropped_packets"] if data["dropped_packets"] is not None else 0,
            execution_duration_s=data["execution_duration_s"] if data["execution_duration_s"] is not None else 0.0,
            is_demo=bool(data["is_demo"]),
            output_xml_path=data.get("output_xml_path"),
            output_energy_path=data.get("output_energy_path"),
            output_routing_path=data.get("output_routing_path"),
            output_mobility_path=data.get("output_mobility_path"),
            output_link_path=data.get("output_link_path"),
            output_routing_trace_path=data.get("output_routing_trace_path"),
            created_at=data["created_at"],
        )

    async def get_wireless_link_trace(self, run_id: str) -> SimulationLinkTrace:
        """
        Retrieves, validates, and serves genuine NS-3 wireless link trace data for a simulation run.
        Enforces path traversal protection, JSON integrity, and schema compliance.
        """
        # 1. Format validation to block directory traversal attacks early
        if not re.match(r"^[a-zA-Z0-9_-]+$", run_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid run_id format: '{run_id}' contains invalid characters.",
            )

        # 2. Check if run exists in database or memory
        run_data = await db_service.get_run(run_id)
        if not run_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Simulation run '{run_id}' not found.",
            )

        # 3. Resolve wireless link trace path
        stored_path = run_data.get("output_link_path")
        if stored_path:
            link_path = Path(stored_path).resolve()
        else:
            link_path = (settings.RESULTS_DIR / run_id / "wireless_link_trace.json").resolve()

        # 4. Strict Path Traversal Protection: Ensure file resides inside settings.RESULTS_DIR
        results_dir = settings.RESULTS_DIR.resolve()
        try:
            link_path.relative_to(results_dir)
        except ValueError:
            logger.warning(f"Path traversal attempt detected for run_id '{run_id}': {link_path}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Security violation: Wireless link trace path escapes results directory.",
            )

        # 5. Check file existence
        if not link_path.is_file():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Wireless link trace file not found for run '{run_id}'. (Historical run or wireless link tracing not recorded).",
            )

        # 6. Read and parse JSON
        try:
            with open(link_path, mode="r", encoding="utf-8") as f:
                raw_data = json.load(f)
        except json.JSONDecodeError as e:
            logger.error(f"Corrupted wireless link JSON in {link_path}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Corrupted wireless link trace JSON file: {str(e)}",
            )
        except Exception as e:
            logger.exception(f"Error reading wireless link trace file at {link_path}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to read wireless link trace file: {str(e)}",
            )

        # 7. Validate trace structure and return schema
        if not isinstance(raw_data, dict) or "events" not in raw_data or not isinstance(raw_data["events"], list):
            logger.error(f"Invalid wireless link trace structure in {link_path}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Invalid wireless link trace structure: missing or invalid 'events' list.",
            )

        try:
            events_list = [
                WirelessLinkEvent(
                    time=float(e["time"]),
                    event_type=str(e["event_type"]),
                    packet_uid=int(e.get("packet_uid") if e.get("packet_uid") is not None else e.get("packet_id", 0)),
                    source_node_id=int(e["source_node_id"]),
                    destination_node_id=int(e["destination_node_id"]),
                    packet_size_bytes=int(e.get("packet_size_bytes") if e.get("packet_size_bytes") is not None else e.get("packet_size", 0)),
                    frame_type=str(e.get("frame_type", "DATA")),
                    is_broadcast=bool(e.get("is_broadcast", False)),
                    snr_db=float(e["snr_db"]) if e.get("snr_db") is not None else None,
                )
                for e in raw_data.get("events", [])
            ]

            trace = SimulationLinkTrace(
                run_id=run_id,
                protocol=run_data.get("protocol", "UNKNOWN"),
                simulation_duration=float(raw_data.get("simulation_duration", run_data.get("simulation_time", 0.0))),
                sim_area=float(raw_data.get("sim_area", run_data.get("simulation_area", 1000.0))),
                node_count=int(raw_data.get("node_count", run_data.get("node_count", 0))),
                total_events=int(raw_data.get("total_events", len(events_list))),
                total_tx_attempts=int(raw_data.get("total_tx_attempts", sum(1 for e in events_list if e.event_type in ("tx", "transmission_attempt")))),
                total_rx_success=int(raw_data.get("total_rx_success", sum(1 for e in events_list if e.event_type in ("rx_ok", "successful_reception")))),
                total_rx_drop=int(raw_data.get("total_rx_drop", sum(1 for e in events_list if e.event_type in ("rx_drop", "failed_reception")))),
                trace_type=raw_data.get("trace_type", "ns3_wireless_link_trace"),
                metric_version=int(raw_data.get("metric_version", 1)),
                events=events_list,
            )
            return trace
        except Exception as e:
            logger.error(f"Schema validation failed for wireless link trace {link_path}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Wireless link trace schema validation failed: {str(e)}",
            )

    async def get_routing_trace(self, run_id: str) -> SimulationRoutingTrace:
        """
        Retrieves, validates, and serves genuine NS-3 multi-hop routing and forwarding trace data for a simulation run.
        Enforces path traversal protection, JSON integrity, and schema compliance.
        """
        # 1. Format validation to block directory traversal attacks early
        if not re.match(r"^[a-zA-Z0-9_-]+$", run_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid run_id format: '{run_id}' contains invalid characters.",
            )

        # 2. Check if run exists in database or memory
        run_data = await db_service.get_run(run_id)
        if not run_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Simulation run '{run_id}' not found.",
            )

        # 3. Resolve routing trace path
        stored_path = run_data.get("output_routing_trace_path")
        if stored_path:
            route_path = Path(stored_path).resolve()
        else:
            route_path = (settings.RESULTS_DIR / run_id / "routing_trace.json").resolve()

        # 4. Strict Path Traversal Protection: Ensure file resides inside settings.RESULTS_DIR
        results_dir = settings.RESULTS_DIR.resolve()
        try:
            route_path.relative_to(results_dir)
        except ValueError:
            logger.warning(f"Path traversal attempt detected for run_id '{run_id}': {route_path}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Security violation: Routing trace path escapes results directory.",
            )

        # 5. Check file existence
        if not route_path.is_file():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Routing trace file not found for run '{run_id}'. (Historical run or routing trace not recorded).",
            )

        # 6. Read and parse JSON
        try:
            with open(route_path, mode="r", encoding="utf-8") as f:
                raw_data = json.load(f)
        except json.JSONDecodeError as e:
            logger.error(f"Corrupted routing trace JSON in {route_path}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Corrupted routing trace JSON file: {str(e)}",
            )
        except Exception as e:
            logger.exception(f"Error reading routing trace file at {route_path}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to read routing trace file: {str(e)}",
            )

        # 7. Validate trace structure and return schema
        if not isinstance(raw_data, dict) or "events" not in raw_data or not isinstance(raw_data["events"], list):
            logger.error(f"Invalid routing trace structure in {route_path}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Invalid routing trace structure: missing or invalid 'events' list.",
            )

        try:
            events_list = [
                RoutingHopEvent(
                    time=float(e["time"]),
                    event_type=str(e["event_type"]),
                    node_id=int(e["node_id"]),
                    prev_hop=int(e["prev_hop"]) if e.get("prev_hop") is not None else None,
                    next_hop=int(e["next_hop"]) if e.get("next_hop") is not None else None,
                    packet_uid=int(e["packet_uid"]) if e.get("packet_uid") is not None else 0,
                    packet_size=int(e["packet_size"]) if e.get("packet_size") is not None else 0,
                    source_ip=str(e.get("source_ip") or ""),
                    dest_ip=str(e.get("dest_ip") or ""),
                    ttl=int(e["ttl"]) if e.get("ttl") is not None else 0,
                    hop_count=int(e["hop_count"]) if e.get("hop_count") is not None else 0,
                    seq_no=int(e["seq_no"]) if e.get("seq_no") is not None else 0,
                    details=str(e.get("details") or ""),
                )
                for e in raw_data.get("events", [])
            ]

            trace = SimulationRoutingTrace(
                run_id=run_id,
                protocol=run_data.get("protocol", "UNKNOWN"),
                simulation_duration=float(raw_data.get("simulation_duration", run_data.get("simulation_time", 0.0))),
                sim_area=float(raw_data.get("sim_area", run_data.get("simulation_area", 1000.0))),
                node_count=int(raw_data.get("node_count", run_data.get("node_count", 0))),
                total_events=int(raw_data.get("total_events", len(events_list))),
                total_data_events=int(raw_data.get("total_data_events", sum(1 for e in events_list if e.event_type.startswith("data_")))),
                total_routing_events=int(raw_data.get("total_routing_events", sum(1 for e in events_list if not e.event_type.startswith("data_")))),
                trace_type=raw_data.get("trace_type", "ns3_routing_and_forwarding_events"),
                metric_version=int(raw_data.get("metric_version", 1)),
                events=events_list,
            )
            return trace
        except Exception as e:
            logger.error(f"Schema validation failed for routing trace {route_path}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Routing trace schema validation failed: {str(e)}",
            )

    async def get_mobility_trace(self, run_id: str) -> SimulationMobilityTrace:
        """
        Retrieves, validates, and serves genuine NS-3 mobility trace data for a simulation run.
        Enforces path traversal protection, JSON integrity, and schema compliance.
        """
        # 1. Format validation to block directory traversal attacks early
        if not re.match(r"^[a-zA-Z0-9_-]+$", run_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid run_id format: '{run_id}' contains invalid characters.",
            )

        # 2. Check if run exists in database or memory
        run_data = await db_service.get_run(run_id)
        if not run_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Simulation run '{run_id}' not found.",
            )

        # 3. Resolve mobility trace path
        stored_path = run_data.get("output_mobility_path")
        if stored_path:
            mob_path = Path(stored_path).resolve()
        else:
            mob_path = (settings.RESULTS_DIR / run_id / "mobility_trace.json").resolve()

        # 4. Strict Path Traversal Protection: Ensure file resides inside settings.RESULTS_DIR
        results_dir = settings.RESULTS_DIR.resolve()
        try:
            mob_path.relative_to(results_dir)
        except ValueError:
            logger.warning(f"Path traversal attempt detected for run_id '{run_id}': {mob_path}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Security violation: Mobility trace path escapes results directory.",
            )

        # 5. Check file existence
        if not mob_path.is_file():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Mobility trace file not found for run '{run_id}'. (Historical run or mobility tracing not recorded).",
            )

        # 6. Read and parse JSON
        try:
            with open(mob_path, mode="r", encoding="utf-8") as f:
                raw_data = json.load(f)
        except json.JSONDecodeError as e:
            logger.error(f"Corrupted mobility JSON in {mob_path}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Corrupted mobility trace JSON file: {str(e)}",
            )
        except Exception as e:
            logger.exception(f"Error reading mobility trace file at {mob_path}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to read mobility trace file: {str(e)}",
            )

        # 7. Validate trace structure and return schema
        if not isinstance(raw_data, dict) or "nodes" not in raw_data or not isinstance(raw_data["nodes"], list):
            logger.error(f"Invalid mobility trace structure in {mob_path}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Invalid mobility trace structure: missing or invalid 'nodes' list.",
            )

        try:
            nodes_list = []
            for n in raw_data["nodes"]:
                positions = [
                    NodePosition(
                        time=float(p["time"]),
                        x=float(p["x"]),
                        y=float(p["y"]),
                        z=float(p.get("z", 0.0)),
                    )
                    for p in n.get("positions", [])
                ]
                nodes_list.append(NodeMobility(node_id=int(n["node_id"]), positions=positions))

            trace = SimulationMobilityTrace(
                run_id=run_id,
                protocol=run_data.get("protocol", "UNKNOWN"),
                simulation_duration=float(raw_data.get("simulation_duration", run_data.get("simulation_time", 0.0))),
                sim_area=float(raw_data.get("sim_area", run_data.get("simulation_area", 1000.0))),
                node_count=int(raw_data.get("node_count", len(nodes_list))),
                total_position_records=int(raw_data.get("total_position_records", sum(len(n.positions) for n in nodes_list))),
                trace_type=raw_data.get("trace_type", "ns3_node_mobility"),
                metric_version=int(raw_data.get("metric_version", 1)),
                nodes=nodes_list,
            )
            return trace
        except Exception as e:
            logger.error(f"Schema validation failed for mobility trace {mob_path}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Mobility trace schema validation failed: {str(e)}",
            )

    def _build_point_config(
        self,
        param: SweepParameter,
        val: float,
        protocol: ProtocolType,
        base: Dict[str, Any],
    ) -> SimulationConfig:
        node_count = int(val) if param == SweepParameter.NODES else base.get("node_count", 30)
        mobility_speed = float(val) if param == SweepParameter.SPEED else base.get("mobility_speed", 10.0)
        traffic_flows = int(val) if param == SweepParameter.TRAFFIC else base.get("traffic_flows", 4)
        return SimulationConfig(
            protocol=protocol,
            node_count=node_count,
            mobility_speed=mobility_speed,
            simulation_area=base.get("simulation_area", 1000),
            simulation_time=base.get("simulation_time", 5.0),
            rng_seed=base.get("rng_seed", 1),
            is_demo=False,
            traffic_flows=traffic_flows,
        )

    async def _await_run_completion(self, run_id: str, timeout_sec: int = 120) -> Optional[SimulationResult]:
        start = time.time()
        while time.time() - start < timeout_sec:
            st = await self.get_status(run_id)
            if not st:
                await asyncio.sleep(0.5)
                continue
            if st.status == SimulationStatus.COMPLETED:
                return await self.get_results(run_id)
            elif st.status in (SimulationStatus.FAILED, SimulationStatus.CANCELLED):
                return None
            await asyncio.sleep(0.5)
        return None

    async def start_sweep(self, request: SweepStartRequest) -> str:
        sweep_id = f"sweep_{int(time.time())}_{uuid.uuid4().hex[:6]}"
        now = datetime.now(timezone.utc).isoformat()

        points_vals = request.points
        if not points_vals:
            if request.parameter == SweepParameter.SPEED:
                points_vals = [5.0, 10.0, 15.0, 20.0]
            elif request.parameter == SweepParameter.NODES:
                points_vals = [20.0, 30.0, 50.0, 70.0]
            elif request.parameter == SweepParameter.TRAFFIC:
                points_vals = [2.0, 4.0, 8.0, 12.0]

        param_meta = {
            SweepParameter.SPEED: (
                "Node Speed",
                "m/s",
                "Node Speed (m/s)",
                lambda v: f"{int(v) if v.is_integer() else v} m/s",
            ),
            SweepParameter.NODES: (
                "Number of Nodes",
                "nodes",
                "Number of Nodes",
                lambda v: f"{int(v)}",
            ),
            SweepParameter.TRAFFIC: (
                "Traffic Load",
                "flows",
                "Traffic Load (flows)",
                lambda v: f"{int(v)} flows",
            ),
        }
        lbl, unit, xtitle, fmt = param_meta[request.parameter]

        points = [
            SweepRunPoint(parameter_value=float(val), parameter_label=fmt(float(val)))
            for val in points_vals
        ]

        if request.config_mode == SweepConfigMode.STUDIO:
            if not request.studio_config:
                raise ValueError("Studio configuration must be provided when config_mode is 'studio'.")

            st_conf = request.studio_config
            if st_conf.simulation_time < 5.0:
                raise ValueError(
                    f"Studio simulation duration ({st_conf.simulation_time}s) is invalid for NS-3 sweeps. "
                    "Minimum duration is 5.0 seconds to allow route discovery and traffic stabilization."
                )

            effective_base = {
                "config_mode": "studio",
                "node_count": st_conf.node_count,
                "mobility_speed": st_conf.mobility_speed,
                "simulation_area": st_conf.simulation_area,
                "simulation_time": st_conf.simulation_time,
                "rng_seed": st_conf.rng_seed,
                "traffic_flows": st_conf.traffic_flows if st_conf.traffic_flows is not None else 4,
            }
        else:
            default_base_configs = {
                SweepParameter.SPEED: {
                    "config_mode": "default",
                    "node_count": 30,
                    "simulation_area": 1000,
                    "traffic_flows": 4,
                    "rng_seed": request.rng_seed if request.rng_seed is not None else 1,
                    "simulation_time": request.simulation_time if request.simulation_time is not None else 5.0,
                },
                SweepParameter.NODES: {
                    "config_mode": "default",
                    "mobility_speed": 10.0,
                    "simulation_area": 1000,
                    "traffic_flows": 4,
                    "rng_seed": request.rng_seed if request.rng_seed is not None else 1,
                    "simulation_time": request.simulation_time if request.simulation_time is not None else 5.0,
                },
                SweepParameter.TRAFFIC: {
                    "config_mode": "default",
                    "node_count": 35,
                    "mobility_speed": 10.0,
                    "simulation_area": 1000,
                    "rng_seed": request.rng_seed if request.rng_seed is not None else 1,
                    "simulation_time": request.simulation_time if request.simulation_time is not None else 5.0,
                },
            }
            effective_base = default_base_configs[request.parameter]

        sweep_obj = SweepResult(
            sweep_id=sweep_id,
            parameter=request.parameter,
            parameter_label=lbl,
            unit=unit,
            x_title=xtitle,
            status=SweepStatus.QUEUED,
            points=points,
            total_runs=len(points) * 2,
            completed_runs=0,
            progress_percent=0,
            current_step=f"Queued {lbl} sweep ({len(points) * 2} runs, mode: {request.config_mode.value})",
            created_at=now,
            base_config=effective_base,
        )

        self.active_sweeps[sweep_id] = sweep_obj
        await db_service.save_sweep(sweep_obj)

        task = asyncio.create_task(self._execute_sweep(sweep_id, request))
        self.sweep_tasks[sweep_id] = task
        return sweep_id

    async def _execute_sweep(self, sweep_id: str, request: SweepStartRequest):
        sweep = self.active_sweeps[sweep_id]
        sweep.status = SweepStatus.RUNNING
        sweep.current_step = f"Starting {sweep.parameter_label} sweep..."
        await db_service.save_sweep(sweep)

        try:
            for pt in sweep.points:
                pt.status = "running"

                # 1. Prepare and run AODV
                aodv_conf = self._build_point_config(
                    sweep.parameter, pt.parameter_value, ProtocolType.AODV, sweep.base_config
                )
                sweep.current_step = f"Simulating AODV @ {pt.parameter_label} ({sweep.completed_runs + 1}/{sweep.total_runs})"
                await db_service.save_sweep(sweep)

                aodv_run_id = await self.start_simulation(aodv_conf)
                pt.aodv_run_id = aodv_run_id

                aodv_res = await self._await_run_completion(aodv_run_id)
                pt.aodv_result = aodv_res
                sweep.completed_runs += 1
                sweep.progress_percent = int((sweep.completed_runs / sweep.total_runs) * 100)
                await db_service.save_sweep(sweep)

                # 2. Prepare and run eAODV
                eaodv_conf = self._build_point_config(
                    sweep.parameter, pt.parameter_value, ProtocolType.eAODV, sweep.base_config
                )
                sweep.current_step = f"Simulating eAODV @ {pt.parameter_label} ({sweep.completed_runs + 1}/{sweep.total_runs})"
                await db_service.save_sweep(sweep)

                eaodv_run_id = await self.start_simulation(eaodv_conf)
                pt.eaodv_run_id = eaodv_run_id

                eaodv_res = await self._await_run_completion(eaodv_run_id)
                pt.eaodv_result = eaodv_res
                sweep.completed_runs += 1
                sweep.progress_percent = int((sweep.completed_runs / sweep.total_runs) * 100)

                if aodv_res and eaodv_res:
                    pt.status = "completed"
                else:
                    pt.status = "failed"
                await db_service.save_sweep(sweep)

            sweep.status = SweepStatus.COMPLETED
            sweep.progress_percent = 100
            sweep.completed_at = datetime.now(timezone.utc).isoformat()
            sweep.current_step = f"Sweep vs {sweep.parameter_label} completed successfully."
            await db_service.save_sweep(sweep)

        except asyncio.CancelledError:
            sweep.status = SweepStatus.CANCELLED
            sweep.current_step = "Sweep cancelled by user"
            await db_service.save_sweep(sweep)
        except Exception as e:
            logger.exception("Error executing sweep")
            sweep.status = SweepStatus.FAILED
            sweep.error_message = str(e)
            sweep.current_step = f"Sweep failed: {str(e)}"
            await db_service.save_sweep(sweep)
        finally:
            self.sweep_tasks.pop(sweep_id, None)

    async def get_sweep_status(self, sweep_id: str) -> Optional[SweepResult]:
        if sweep_id in self.active_sweeps:
            return self.active_sweeps[sweep_id]
        return await db_service.get_sweep(sweep_id)

    async def get_latest_sweep(self, parameter: str) -> Optional[SweepResult]:
        for s in reversed(list(self.active_sweeps.values())):
            if s.parameter.value == parameter and s.status == SweepStatus.COMPLETED:
                return s
        return await db_service.get_latest_sweep(parameter)

    async def cancel_sweep(self, sweep_id: str) -> bool:
        if sweep_id in self.sweep_tasks:
            self.sweep_tasks[sweep_id].cancel()
        if sweep_id in self.active_sweeps:
            sweep = self.active_sweeps[sweep_id]
            sweep.status = SweepStatus.CANCELLED
            sweep.current_step = "Sweep cancelled by user"
            for pt in sweep.points:
                if pt.status == "running":
                    if pt.aodv_run_id and pt.aodv_run_id in self.active_processes:
                        await self.cancel_simulation(pt.aodv_run_id)
                    if pt.eaodv_run_id and pt.eaodv_run_id in self.active_processes:
                        await self.cancel_simulation(pt.eaodv_run_id)
                    pt.status = "failed"
            await db_service.save_sweep(sweep)
            return True
        return False

simulation_service = SimulationService()

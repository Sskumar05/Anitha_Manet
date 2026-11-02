import aiosqlite
import json
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from app.core.config import settings
from app.schemas.simulation import (
    SimulationResult,
    SimulationStatus,
    SimulationHistoryItem,
    SweepResult,
    SweepRunPoint,
    SweepParameter,
    SweepStatus,
)

INIT_SQL = """
CREATE TABLE IF NOT EXISTS simulation_runs (
    run_id TEXT PRIMARY KEY,
    protocol TEXT NOT NULL,
    status TEXT NOT NULL,
    node_count INTEGER NOT NULL,
    mobility_speed REAL NOT NULL,
    simulation_area INTEGER NOT NULL,
    simulation_time REAL NOT NULL,
    pdr REAL,
    delay_ms REAL,
    overhead_ratio REAL,
    energy_consumed_j REAL,
    remaining_energy_percent REAL,
    tx_packets INTEGER,
    rx_packets INTEGER,
    dropped_packets INTEGER,
    routing_packets INTEGER,
    metric_version INTEGER DEFAULT 1,
    execution_duration_s REAL,
    is_demo INTEGER NOT NULL,
    output_xml_path TEXT,
    output_energy_path TEXT,
    output_routing_path TEXT,
    output_mobility_path TEXT,
    output_link_path TEXT,
    output_routing_trace_path TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    logs TEXT
);

CREATE TABLE IF NOT EXISTS simulation_sweeps (
    sweep_id TEXT PRIMARY KEY,
    parameter TEXT NOT NULL,
    status TEXT NOT NULL,
    points_json TEXT NOT NULL,
    base_config_json TEXT NOT NULL,
    total_runs INTEGER NOT NULL,
    completed_runs INTEGER NOT NULL,
    progress_percent INTEGER NOT NULL,
    current_step TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    error_message TEXT
);
"""

class DatabaseService:
    def __init__(self, db_path=settings.DB_PATH):
        self.db_path = str(db_path)

    async def init_db(self):
        async with aiosqlite.connect(self.db_path) as db:
            await db.executescript(INIT_SQL)
            # Schema migration for existing tables
            cursor = await db.execute("PRAGMA table_info(simulation_runs)")
            cols = [row[1] for row in await cursor.fetchall()]
            if "routing_packets" not in cols:
                await db.execute("ALTER TABLE simulation_runs ADD COLUMN routing_packets INTEGER")
            if "metric_version" not in cols:
                await db.execute("ALTER TABLE simulation_runs ADD COLUMN metric_version INTEGER DEFAULT 1")
            if "output_routing_path" not in cols:
                await db.execute("ALTER TABLE simulation_runs ADD COLUMN output_routing_path TEXT")
            if "output_mobility_path" not in cols:
                await db.execute("ALTER TABLE simulation_runs ADD COLUMN output_mobility_path TEXT")
            if "output_link_path" not in cols:
                await db.execute("ALTER TABLE simulation_runs ADD COLUMN output_link_path TEXT")
            if "output_routing_trace_path" not in cols:
                await db.execute("ALTER TABLE simulation_runs ADD COLUMN output_routing_trace_path TEXT")
            await db.commit()

    async def create_run(
        self,
        run_id: str,
        protocol: str,
        node_count: int,
        mobility_speed: float,
        simulation_area: int,
        simulation_time: float,
        is_demo: bool,
    ):
        await self.init_db()
        now = datetime.now(timezone.utc).isoformat()
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                INSERT INTO simulation_runs (
                    run_id, protocol, status, node_count, mobility_speed,
                    simulation_area, simulation_time, is_demo, created_at, logs
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id, protocol, SimulationStatus.QUEUED.value,
                    node_count, mobility_speed, simulation_area,
                    simulation_time, 1 if is_demo else 0, now, "[]"
                ),
            )
            await db.commit()

    async def update_status(self, run_id: str, status: SimulationStatus, logs: Optional[List[str]] = None):
        async with aiosqlite.connect(self.db_path) as db:
            if logs is not None:
                logs_json = json.dumps(logs)
                await db.execute(
                    "UPDATE simulation_runs SET status = ?, logs = ? WHERE run_id = ?",
                    (status.value, logs_json, run_id)
                )
            else:
                await db.execute(
                    "UPDATE simulation_runs SET status = ? WHERE run_id = ?",
                    (status.value, run_id)
                )
            await db.commit()

    async def save_result(self, result: SimulationResult, logs: List[str]):
        await self.init_db()
        now = datetime.now(timezone.utc).isoformat()
        logs_json = json.dumps(logs)
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                UPDATE simulation_runs SET
                    status = ?,
                    pdr = ?,
                    delay_ms = ?,
                    overhead_ratio = ?,
                    energy_consumed_j = ?,
                    remaining_energy_percent = ?,
                    tx_packets = ?,
                    rx_packets = ?,
                    dropped_packets = ?,
                    routing_packets = ?,
                    metric_version = ?,
                    execution_duration_s = ?,
                    output_xml_path = ?,
                    output_energy_path = ?,
                    output_routing_path = ?,
                    output_mobility_path = ?,
                    output_link_path = ?,
                    output_routing_trace_path = ?,
                    completed_at = ?,
                    logs = ?
                WHERE run_id = ?
                """,
                (
                    result.status.value,
                    result.pdr,
                    result.delay_ms,
                    result.overhead_ratio,
                    result.energy_consumed_j,
                    result.remaining_energy_percent,
                    result.tx_packets,
                    result.rx_packets,
                    result.dropped_packets,
                    result.routing_packets,
                    result.metric_version,
                    result.execution_duration_s,
                    result.output_xml_path,
                    result.output_energy_path,
                    result.output_routing_path,
                    result.output_mobility_path,
                    getattr(result, "output_link_path", None),
                    getattr(result, "output_routing_trace_path", None),
                    now,
                    logs_json,
                    result.run_id,
                ),
            )
            await db.commit()

    async def get_run(self, run_id: str) -> Optional[Dict[str, Any]]:
        await self.init_db()
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT * FROM simulation_runs WHERE run_id = ?", (run_id,)
            )
            row = await cursor.fetchone()
            if not row:
                return None
            data = dict(row)
            data["is_demo"] = bool(data["is_demo"])
            data["logs"] = json.loads(data["logs"]) if data["logs"] else []
            return data

    async def get_history(self, limit: int = 50) -> List[SimulationHistoryItem]:
        await self.init_db()
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                """
                SELECT run_id, protocol, node_count, mobility_speed, simulation_area,
                       status, pdr, delay_ms, overhead_ratio, energy_consumed_j,
                       routing_packets, metric_version,
                       is_demo, created_at
                FROM simulation_runs
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (limit,)
            )
            rows = await cursor.fetchall()
            items = []
            for r in rows:
                d = dict(r)
                items.append(
                    SimulationHistoryItem(
                        run_id=d["run_id"],
                        protocol=d["protocol"],
                        node_count=d["node_count"],
                        mobility_speed=d["mobility_speed"],
                        simulation_area=d["simulation_area"],
                        status=SimulationStatus(d["status"]),
                        pdr=d["pdr"],
                        delay_ms=d["delay_ms"],
                        overhead_ratio=d["overhead_ratio"],
                        energy_consumed_j=d["energy_consumed_j"],
                        routing_packets=d.get("routing_packets"),
                        metric_version=d.get("metric_version", 1),
                        is_demo=bool(d["is_demo"]),
                        created_at=d["created_at"],
                    )
                )
            return items

    async def save_sweep(self, sweep: SweepResult):
        await self.init_db()
        points_json = json.dumps([p.model_dump() for p in sweep.points])
        base_config_json = json.dumps(sweep.base_config)
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                INSERT INTO simulation_sweeps (
                    sweep_id, parameter, status, points_json, base_config_json,
                    total_runs, completed_runs, progress_percent, current_step,
                    created_at, completed_at, error_message
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(sweep_id) DO UPDATE SET
                    status = excluded.status,
                    points_json = excluded.points_json,
                    base_config_json = excluded.base_config_json,
                    total_runs = excluded.total_runs,
                    completed_runs = excluded.completed_runs,
                    progress_percent = excluded.progress_percent,
                    current_step = excluded.current_step,
                    completed_at = excluded.completed_at,
                    error_message = excluded.error_message
                """,
                (
                    sweep.sweep_id,
                    sweep.parameter.value,
                    sweep.status.value,
                    points_json,
                    base_config_json,
                    sweep.total_runs,
                    sweep.completed_runs,
                    sweep.progress_percent,
                    sweep.current_step,
                    sweep.created_at,
                    sweep.completed_at,
                    sweep.error_message,
                ),
            )
            await db.commit()

    async def get_sweep(self, sweep_id: str) -> Optional[SweepResult]:
        await self.init_db()
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT * FROM simulation_sweeps WHERE sweep_id = ?", (sweep_id,)
            )
            row = await cursor.fetchone()
            if not row:
                return None
            return self._row_to_sweep(dict(row))

    async def get_latest_sweep(self, parameter: str) -> Optional[SweepResult]:
        await self.init_db()
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                """
                SELECT * FROM simulation_sweeps
                WHERE parameter = ? AND status = 'completed'
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (parameter,),
            )
            row = await cursor.fetchone()
            if not row:
                return None
            return self._row_to_sweep(dict(row))

    def _row_to_sweep(self, d: Dict[str, Any]) -> SweepResult:
        param = SweepParameter(d["parameter"])
        param_labels = {
            SweepParameter.SPEED: ("Node Speed", "m/s", "Node Speed (m/s)"),
            SweepParameter.NODES: ("Number of Nodes", "nodes", "Number of Nodes"),
            SweepParameter.TRAFFIC: ("Traffic Load", "flows", "Traffic Load (flows)"),
        }
        lbl, unit, xtitle = param_labels.get(param, (param.value.capitalize(), "", param.value.capitalize()))
        points_raw = json.loads(d["points_json"]) if d.get("points_json") else []
        points = [SweepRunPoint(**p) for p in points_raw]
        base_cfg = json.loads(d["base_config_json"]) if d.get("base_config_json") else {}

        return SweepResult(
            sweep_id=d["sweep_id"],
            parameter=param,
            parameter_label=lbl,
            unit=unit,
            x_title=xtitle,
            status=SweepStatus(d["status"]),
            points=points,
            total_runs=d["total_runs"],
            completed_runs=d["completed_runs"],
            progress_percent=d.get("progress_percent", 0),
            current_step=d.get("current_step", ""),
            created_at=d["created_at"],
            completed_at=d.get("completed_at"),
            error_message=d.get("error_message"),
            base_config=base_cfg,
        )

db_service = DatabaseService()

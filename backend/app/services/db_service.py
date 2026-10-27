import aiosqlite
import json
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from app.core.config import settings
from app.schemas.simulation import SimulationResult, SimulationStatus, SimulationHistoryItem

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
    execution_duration_s REAL,
    is_demo INTEGER NOT NULL,
    output_xml_path TEXT,
    output_energy_path TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    logs TEXT
);
"""

class DatabaseService:
    def __init__(self, db_path=settings.DB_PATH):
        self.db_path = str(db_path)

    async def init_db(self):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(INIT_SQL)
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
                    execution_duration_s = ?,
                    output_xml_path = ?,
                    output_energy_path = ?,
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
                    result.execution_duration_s,
                    result.output_xml_path,
                    result.output_energy_path,
                    now,
                    logs_json,
                    result.run_id,
                ),
            )
            await db.commit()

    async def get_run(self, run_id: str) -> Optional[Dict[str, Any]]:
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
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                """
                SELECT run_id, protocol, node_count, mobility_speed, simulation_area,
                       status, pdr, delay_ms, overhead_ratio, energy_consumed_j,
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
                        is_demo=bool(d["is_demo"]),
                        created_at=d["created_at"],
                    )
                )
            return items

db_service = DatabaseService()

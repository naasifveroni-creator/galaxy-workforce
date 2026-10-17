"""
SQLite task + audit store. Every task and every state change is written here, so a restart
doesn't lose history and ReportBot can rebuild today's outputs.
Tiny writes, so we call it synchronously under a lock.
"""
import json
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

from .status import TERMINAL

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "galaxy.db"
_lock = threading.Lock()
_conn: sqlite3.Connection | None = None

SCHEMA = """
CREATE TABLE IF NOT EXISTS tasks (
    task_id TEXT PRIMARY KEY, bot_id TEXT NOT NULL, status TEXT NOT NULL,
    summary TEXT, params TEXT, result TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL, ts TEXT NOT NULL,
    event TEXT NOT NULL, detail TEXT
);
"""
PUBLIC = "task_id, bot_id, status, summary, created_at, updated_at"


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def init(path: Path = DB_PATH) -> None:
    global _conn
    path.parent.mkdir(parents=True, exist_ok=True)
    _conn = sqlite3.connect(path, check_same_thread=False)
    _conn.row_factory = sqlite3.Row
    with _lock, _conn:
        _conn.executescript(SCHEMA)
    # Anything still mid-flight when the server died can never finish: mark it FAILED.
    marks = ",".join("?" * len(TERMINAL))
    with _lock:
        stale = [r["task_id"] for r in _conn.execute(f"SELECT task_id FROM tasks WHERE status NOT IN ({marks})", TERMINAL)]
    for tid in stale:
        set_status(tid, "failed", detail="server restarted before task finished")


def audit(task_id: str, event: str, detail: str | None = None) -> None:
    with _lock, _conn:
        _conn.execute("INSERT INTO audit (task_id, ts, event, detail) VALUES (?,?,?,?)", (task_id, now(), event, detail))


def create_task(bot_id: str, params: dict | None = None) -> str:
    task_id = uuid.uuid4().hex[:8]
    ts = now()
    with _lock, _conn:
        _conn.execute("INSERT INTO tasks (task_id, bot_id, status, params, created_at, updated_at) VALUES (?,?,?,?,?,?)",
                      (task_id, bot_id, "idle", json.dumps(params or {}, default=str), ts, ts))
    audit(task_id, "created", bot_id)
    return task_id


def set_status(task_id: str, status: str, detail: str | None = None, summary: str | None = None, result: dict | None = None) -> None:
    with _lock, _conn:
        _conn.execute(
            "UPDATE tasks SET status=?, updated_at=?, summary=COALESCE(?, summary), result=COALESCE(?, result) WHERE task_id=?",
            (status, now(), summary, json.dumps(result, default=str) if result is not None else None, task_id))
    audit(task_id, status, detail)


def get_task(task_id: str) -> dict | None:
    with _lock:
        row = _conn.execute(f"SELECT {PUBLIC} FROM tasks WHERE task_id=?", (task_id,)).fetchone()
    return dict(row) if row else None


def recent_tasks(limit: int = 20) -> list[dict]:
    with _lock:
        rows = _conn.execute(f"SELECT {PUBLIC} FROM tasks ORDER BY created_at DESC, rowid DESC LIMIT ?", (limit,)).fetchall()
    return [dict(r) for r in rows]


def audit_log(task_id: str) -> list[dict]:
    with _lock:
        rows = _conn.execute("SELECT ts, event, detail FROM audit WHERE task_id=? ORDER BY id", (task_id,)).fetchall()
    return [dict(r) for r in rows]


def completed_since(iso_ts: str) -> list[dict]:
    with _lock:
        rows = _conn.execute("SELECT bot_id, result FROM tasks WHERE status='completed' AND result IS NOT NULL AND updated_at>=? ORDER BY created_at, rowid",
                             (iso_ts,)).fetchall()
    return [dict(r) for r in rows]

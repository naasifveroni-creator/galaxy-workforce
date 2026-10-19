"""
Run:  uvicorn main:app --reload --port 8000
"""
import asyncio
import json
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from core import db
from core.hub import hub
from core.registry import registry

# PAUSED: from bots.email_bot import EmailBot
from bots.data_bot import DataBot
from bots.excel_bot import ExcelBot
from bots.report_bot import ReportBot
from bots.ppt_bot import PPTBot # NEW

app = FastAPI(title="Galaxy Workforce")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

db.init()

# Register bots. EmailBot is paused.
for bot_cls in (DataBot, ExcelBot, ReportBot, PPTBot):
    registry.register(bot_cls())

# Rebuild today's approved outputs so ReportBot still works after a restart.
_today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat(timespec="seconds")
for row in db.completed_since(_today):
    if row["bot_id"] in registry.outputs:
        registry.outputs[row["bot_id"]].append(json.loads(row["result"]))

# ---------- REST ----------
@app.get("/api/bots")
def list_bots():
    return registry.snapshot()

@app.post("/api/bots/{bot_id}/start")
async def start_bot(bot_id: str):
    bot = registry.get(bot_id)
    if not bot:
        raise HTTPException(404, "Unknown bot")
    asyncio.create_task(bot.run())
    return {"ok": True}

@app.get("/api/tasks")
def list_tasks(limit: int = 20):
    return db.recent_tasks(limit)

@app.get("/api/tasks/{task_id}/audit")
def task_audit(task_id: str):
    if not db.get_task(task_id):
        raise HTTPException(404, "Unknown task")
    return db.audit_log(task_id)

# ---------- WebSocket bridge ----------
async def handle_message(ws: WebSocket, msg: dict) -> None:
    kind = msg.get("type")
    if kind in ("APPROVE_ACTION", "REJECT_ACTION"):
        err = hub.resolve(msg.get("task_id"), kind == "APPROVE_ACTION")
        if err:
            await ws.send_json({"type": "ERROR", "message": err})
    elif kind == "START_TASK":
        bot = registry.get(msg.get("bot_id", ""))
        if bot and not bot.busy:
            asyncio.create_task(bot.run(**(msg.get("params") or {})))

@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await hub.connect(ws)
    await ws.send_json({"type": "SNAPSHOT", "bots": registry.snapshot(),
                        "approvals": hub.pending_approvals(), "tasks": db.recent_tasks(10)})
    try:
        while True:
            await handle_message(ws, await ws.receive_json())
    except WebSocketDisconnect:
        hub.disconnect(ws)
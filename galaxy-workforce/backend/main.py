"""
Run:  uvicorn main:app --reload --port 8000

WebSocket protocol (all JSON)
  server -> client
    SNAPSHOT           {bots:[...], approvals:[...]}        sent once on connect
    BOT_STATUS         {bot_id, status, location, task...}  status: idle|walking|working|waiting_approval|executing|error
    APPROVAL_REQUEST   {action_id, bot_id, summary, details}
    APPROVAL_RESOLVED  {action_id}
  client -> server
    START_TASK         {bot_id, params?}
    APPROVE_ACTION     {action_id}
    REJECT_ACTION      {action_id}
"""
import asyncio
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from core.hub import hub
from core.registry import registry
from bots.email_bot import EmailBot
from bots.data_bot import DataBot
from bots.excel_bot import ExcelBot
from bots.report_bot import ReportBot

app = FastAPI(title="Galaxy Workforce")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Register bots. To add a new one: write a BaseBot subclass, add it here, add its room to registry.ROOMS.
for bot_cls in (EmailBot, DataBot, ExcelBot, ReportBot):
    registry.register(bot_cls())


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


# ---------- WebSocket bridge ----------
async def handle_message(msg: dict) -> None:
    kind = msg.get("type")
    if kind == "APPROVE_ACTION":
        hub.resolve(msg["action_id"], True)       # wakes the bot waiting in hub.request_approval()
    elif kind == "REJECT_ACTION":
        hub.resolve(msg["action_id"], False)
    elif kind == "START_TASK":
        bot = registry.get(msg.get("bot_id", ""))
        if bot and not bot.busy:
            asyncio.create_task(bot.run(**(msg.get("params") or {})))


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await hub.connect(ws)
    # Give the new client the full current picture so a page refresh doesn't lose state
    await ws.send_json({"type": "SNAPSHOT", "bots": registry.snapshot(), "approvals": hub.pending_approvals()})
    try:
        while True:
            await handle_message(await ws.receive_json())
    except WebSocketDisconnect:
        hub.disconnect(ws)

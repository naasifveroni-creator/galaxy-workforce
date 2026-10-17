"""
THE WEBSOCKET BRIDGE (backend half)
-----------------------------------
Phaser (browser) <--- JSON over WebSocket ---> Hub (this file) <--- method calls ---> Bots

* Bots call `hub.broadcast({...})` whenever their state changes.
  Every connected browser tab receives it and Phaser tweens the sprite.
* Bots call `await hub.request_approval(task_id, ...)`. That pushes an APPROVAL_REQUEST to the
  UI and then *suspends the bot* on an asyncio.Future until you click Approve/Reject.
  The click arrives as APPROVE_ACTION / REJECT_ACTION {task_id}, which calls `hub.resolve(...)`.
  Approvals are bound to a task_id: an unknown, already-decided or non-pending task is refused.
"""
import asyncio
from fastapi import WebSocket

from . import db


class Hub:
    def __init__(self) -> None:
        self.clients: set[WebSocket] = set()
        self._futures: dict[str, asyncio.Future] = {}
        self._meta: dict[str, dict] = {}

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.clients.add(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self.clients.discard(ws)

    async def broadcast(self, message: dict) -> None:
        dead = []
        for ws in list(self.clients):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    async def request_approval(self, task_id: str, bot_id: str, summary: str, details: dict | None = None) -> bool:
        fut = asyncio.get_running_loop().create_future()
        self._futures[task_id] = fut
        self._meta[task_id] = {"type": "APPROVAL_REQUEST", "task_id": task_id, "bot_id": bot_id,
                               "summary": summary, "details": details or {}}
        await self.broadcast(self._meta[task_id])
        try:
            return await fut  # <-- bot sleeps here until the Commander decides
        finally:
            self._futures.pop(task_id, None)
            self._meta.pop(task_id, None)
            await self.broadcast({"type": "APPROVAL_RESOLVED", "task_id": task_id})

    def resolve(self, task_id: str | None, approved: bool) -> str | None:
        """Returns an error string, or None on success."""
        fut = self._futures.get(task_id or "")
        if fut is None:
            return "No pending approval for that task"
        if fut.done():
            return "That task was already decided"
        db.audit(task_id, "commander_approved" if approved else "commander_rejected")
        fut.set_result(approved)
        return None

    def pending_approvals(self) -> list[dict]:
        return list(self._meta.values())


hub = Hub()

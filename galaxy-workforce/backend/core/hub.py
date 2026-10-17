"""
THE WEBSOCKET BRIDGE (backend half)
-----------------------------------
Phaser (browser) <--- JSON over WebSocket ---> Hub (this file) <--- method calls ---> Bots

* Bots call `hub.broadcast({...})` whenever their state changes.
  Every connected browser tab receives it and Phaser tweens the sprite.
* Bots call `await hub.request_approval(...)`. That pushes an APPROVAL_REQUEST to the
  UI and then *suspends the bot* on an asyncio.Future until you click Approve/Reject.
  The frontend's click arrives as APPROVE_ACTION / REJECT_ACTION, which calls
  `hub.resolve(...)` and wakes the bot up. That's the human-in-the-loop gate.
"""
import asyncio
import uuid
from fastapi import WebSocket


class Hub:
    def __init__(self) -> None:
        self.clients: set[WebSocket] = set()
        self._futures: dict[str, asyncio.Future] = {}
        self._meta: dict[str, dict] = {}

    # ---- connection lifecycle ----
    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.clients.add(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self.clients.discard(ws)

    # ---- server -> browser ----
    async def broadcast(self, message: dict) -> None:
        dead = []
        for ws in list(self.clients):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    # ---- human-in-the-loop gate ----
    async def request_approval(self, bot_id: str, summary: str, details: dict | None = None) -> bool:
        action_id = uuid.uuid4().hex[:8]
        fut = asyncio.get_running_loop().create_future()
        self._futures[action_id] = fut
        self._meta[action_id] = {
            "type": "APPROVAL_REQUEST",
            "action_id": action_id,
            "bot_id": bot_id,
            "summary": summary,
            "details": details or {},
        }
        await self.broadcast(self._meta[action_id])
        try:
            return await fut  # <-- bot sleeps here until the Commander decides
        finally:
            self._futures.pop(action_id, None)
            self._meta.pop(action_id, None)
            await self.broadcast({"type": "APPROVAL_RESOLVED", "action_id": action_id})

    def resolve(self, action_id: str, approved: bool) -> None:
        fut = self._futures.get(action_id)
        if fut and not fut.done():
            fut.set_result(approved)

    def pending_approvals(self) -> list[dict]:
        return list(self._meta.values())


hub = Hub()

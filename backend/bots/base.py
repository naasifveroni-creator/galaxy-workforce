import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from core import db
from core.hub import hub
from core.registry import registry
from core.status import TaskStatus as S

WALK_SECONDS = 2.0  # roughly matches the frontend tween duration so server/UI stay in sync


@dataclass
class TaskResult:
    summary: str                      # shown on the approval card
    data: dict = field(default_factory=dict)


class BaseBot(ABC):
    """
    Task lifecycle:  WALKING -> WORKING -> AWAITING_APPROVAL -> APPROVED -> COMPLETED
                                                            \\-> REJECTED      (any step may -> FAILED)
    Subclasses only implement `work()` (safe, reversible) and `execute()` (the final action).
    """
    bot_id: str = "base"
    name: str = "Base"
    room: str = "bridge"      # workstation this bot walks to
    home: str = "bridge"
    color: str = "#ffffff"

    def __init__(self) -> None:
        self.status = S.IDLE
        self.location = self.home
        self.task: str | None = None
        self.task_id: str | None = None
        self.busy = False

    def state(self) -> dict:
        return {"type": "BOT_STATUS", "bot_id": self.bot_id, "name": self.name, "color": self.color,
                "status": self.status.value, "location": self.location, "task": self.task, "task_id": self.task_id}

    async def set_status(self, status: S, location: str | None = None, task: str | None = None,
                         detail: str | None = None, result: dict | None = None) -> None:
        self.status = status
        if location:
            self.location = location
        if task is not None:
            self.task = task
        if self.task_id:  # persist every transition (audit trail) and tell the HUD
            db.set_status(self.task_id, status.value, detail=detail or task, summary=task if status != S.WALKING else None, result=result)
            await hub.broadcast({"type": "TASK_UPDATE", "task": db.get_task(self.task_id)})
        await hub.broadcast(self.state())

    async def run(self, **kwargs) -> None:
        if self.busy:
            return
        self.busy = True
        self.task_id = db.create_task(self.bot_id, kwargs)
        try:
            await self.set_status(S.WALKING, self.room, f"Heading to {self.room}")
            await asyncio.sleep(WALK_SECONDS)

            await self.set_status(S.WORKING, task="Working...")
            result = await self.work(**kwargs)

            await self.set_status(S.AWAITING_APPROVAL, task=result.summary)
            approved = await hub.request_approval(self.task_id, self.bot_id, result.summary, result.data.get("preview"))

            if approved:
                await self.set_status(S.APPROVED, task="Approved by Commander")
                await self.execute(result)
                output = {"summary": result.summary, **result.data}
                registry.outputs[self.bot_id].append(output)
                await self.set_status(S.COMPLETED, task=result.summary, result=output)
            else:
                await self.discard(result)
                await self.set_status(S.REJECTED, task="Rejected by Commander")
        except Exception as exc:  # never let a bot crash the server
            await self.set_status(S.FAILED, task=f"Failed: {exc}", detail=repr(exc))
            await asyncio.sleep(2)
        finally:
            self.task_id = None   # task is terminal; the walk home isn't part of it
            self.task = None
            await self.set_status(S.WALKING, self.home)
            await asyncio.sleep(WALK_SECONDS)
            await self.set_status(S.IDLE)
            self.busy = False

    @abstractmethod
    async def work(self, **kwargs) -> TaskResult: ...

    @abstractmethod
    async def execute(self, result: TaskResult) -> None: ...

    async def discard(self, result: TaskResult) -> None:
        """Called when you click Reject. Override to clean up drafts/files."""
        return None

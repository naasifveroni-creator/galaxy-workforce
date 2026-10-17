import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from core.hub import hub
from core.registry import registry

WALK_SECONDS = 2.0  # roughly matches the frontend tween duration so server/UI stay in sync


@dataclass
class TaskResult:
    summary: str                      # shown on the approval card
    data: dict = field(default_factory=dict)


class BaseBot(ABC):
    """
    Lifecycle:  idle -> walking -> working -> waiting_approval -> executing -> walking(home) -> idle
    Subclasses only implement `work()` (safe, reversible) and `execute()` (the final action).
    """
    bot_id: str = "base"
    name: str = "Base"
    room: str = "bridge"      # workstation this bot walks to
    home: str = "bridge"
    color: str = "#ffffff"

    def __init__(self) -> None:
        self.status = "idle"
        self.location = self.home
        self.task: str | None = None
        self.busy = False

    def state(self) -> dict:
        return {"type": "BOT_STATUS", "bot_id": self.bot_id, "name": self.name, "color": self.color,
                "status": self.status, "location": self.location, "task": self.task}

    async def set_status(self, status: str, location: str | None = None, task: str | None = None) -> None:
        self.status = status
        if location:
            self.location = location
        if task is not None:
            self.task = task
        await hub.broadcast(self.state())

    async def run(self, **kwargs) -> None:
        if self.busy:
            return
        self.busy = True
        try:
            await self.set_status("walking", self.room, f"Heading to {self.room}")
            await asyncio.sleep(WALK_SECONDS)

            await self.set_status("working", task="Working...")
            result = await self.work(**kwargs)

            await self.set_status("waiting_approval", task=result.summary)
            approved = await hub.request_approval(self.bot_id, result.summary, result.data.get("preview"))

            if approved:
                await self.set_status("executing", task="Executing approved action")
                await self.execute(result)
                registry.outputs[self.bot_id].append({"summary": result.summary, **result.data})
            else:
                await self.discard(result)
        except Exception as exc:  # never let a bot crash the server
            await self.set_status("error", task=str(exc))
            await asyncio.sleep(2)
        finally:
            await self.set_status("walking", self.home, "Returning to bridge")
            await asyncio.sleep(WALK_SECONDS)
            await self.set_status("idle", task=None)
            self.busy = False

    @abstractmethod
    async def work(self, **kwargs) -> TaskResult: ...

    @abstractmethod
    async def execute(self, result: TaskResult) -> None: ...

    async def discard(self, result: TaskResult) -> None:
        """Called when you click Reject. Override to clean up drafts/files."""
        return None

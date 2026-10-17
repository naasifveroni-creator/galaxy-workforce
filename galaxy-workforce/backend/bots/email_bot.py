import asyncio
from .base import BaseBot, TaskResult
from . import outlook_client as ol

URGENT = ("urgent", "asap", "down", "outage", "critical", "immediately", "escalat")
LOW = ("newsletter", "fyi", "unsubscribe", "digest")


def categorize(subject: str, body: str) -> str:
    text = f"{subject} {body}".lower()
    if any(k in text for k in URGENT):
        return "high"
    if any(k in text for k in LOW):
        return "low"
    return "normal"


def draft_text(email: dict, urgency: str) -> str:
    # PLACEHOLDER: swap for an LLM call later.
    if urgency == "high":
        return "Thanks for flagging this. We're looking into it now and will update you shortly."
    return "Thanks for your email. I'll review and get back to you."


class EmailBot(BaseBot):
    bot_id, name, room, color = "email_bot", "EmailBot", "comms_array", "#ff4d4d"

    async def work(self, **kwargs) -> TaskResult:
        emails = await asyncio.to_thread(ol.read_recent_emails, 15)  # COM call off the event loop
        drafts = []
        for e in emails:
            urgency = categorize(e["subject"], e["body"])
            if urgency == "low":
                continue  # don't draft replies to newsletters
            text = draft_text(e, urgency)
            draft_id = await asyncio.to_thread(ol.create_reply_draft, e["entry_id"], text)
            drafts.append({"draft_id": draft_id, "to": e["sender"], "subject": e["subject"], "urgency": urgency, "reply": text})
        drafts.sort(key=lambda d: d["urgency"] != "high")
        return TaskResult(
            summary=f"{len(drafts)} reply drafts ready ({sum(d['urgency']=='high' for d in drafts)} urgent)",
            data={"drafts": drafts, "preview": drafts[:5]},
        )

    async def execute(self, result: TaskResult) -> None:
        for d in result.data["drafts"]:
            await asyncio.to_thread(ol.send_draft, d["draft_id"])

    async def discard(self, result: TaskResult) -> None:
        for d in result.data["drafts"]:
            await asyncio.to_thread(ol.delete_draft, d["draft_id"])

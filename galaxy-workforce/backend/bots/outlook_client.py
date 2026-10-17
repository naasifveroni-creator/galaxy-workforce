"""
Thin pywin32 wrapper around the local Outlook desktop app (Windows only).
COM objects are thread-bound, so every function calls CoInitialize and we pass
EntryIDs around (plain strings) instead of live COM objects.
Falls back to mock data when pywin32/Outlook isn't available so you can dev on any OS.
"""
try:
    import pythoncom
    import win32com.client
    HAS_OUTLOOK = True
except ImportError:
    HAS_OUTLOOK = False

OL_FOLDER_INBOX = 6


def _ns():
    pythoncom.CoInitialize()
    return win32com.client.Dispatch("Outlook.Application").GetNamespace("MAPI")


def read_recent_emails(limit: int = 15) -> list[dict]:
    if not HAS_OUTLOOK:
        return [
            {"entry_id": "mock1", "sender": "ops@example.com", "subject": "URGENT: system down at BLVD", "body": "Agents can't log in."},
            {"entry_id": "mock2", "sender": "hr@example.com", "subject": "Rota for next week", "body": "Please review."},
            {"entry_id": "mock3", "sender": "news@example.com", "subject": "Newsletter", "body": "FYI only."},
        ][:limit]

    inbox = _ns().GetDefaultFolder(OL_FOLDER_INBOX)
    items = inbox.Items
    items.Sort("[ReceivedTime]", True)  # newest first
    out = []
    for item in items:
        if len(out) >= limit:
            break
        if getattr(item, "Class", None) != 43:  # 43 = MailItem (skips meeting requests etc.)
            continue
        out.append({
            "entry_id": item.EntryID,
            "sender": item.SenderEmailAddress,
            "subject": item.Subject,
            "body": (item.Body or "")[:1500],
            "received": str(item.ReceivedTime),
        })
    return out


def create_reply_draft(entry_id: str, reply_text: str) -> str:
    """Creates a reply and SAVES it to Drafts. Never sends. Returns the draft's EntryID."""
    if not HAS_OUTLOOK:
        return f"draft-{entry_id}"
    ns = _ns()
    reply = ns.GetItemFromID(entry_id).Reply()
    reply.Body = reply_text + "\n\n" + reply.Body
    reply.Save()
    return reply.EntryID


def send_draft(draft_entry_id: str) -> None:
    """Only called AFTER you approve in the UI."""
    if not HAS_OUTLOOK:
        return
    _ns().GetItemFromID(draft_entry_id).Send()


def delete_draft(draft_entry_id: str) -> None:
    if not HAS_OUTLOOK:
        return
    _ns().GetItemFromID(draft_entry_id).Delete()

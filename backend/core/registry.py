"""Holds every bot + the map's room list. Add a bot/room here and the whole stack picks it up."""

# Keep these IDs in sync with frontend/config.js
ROOMS = [
    "bridge", 
    "comms_array", 
    "data_forge", 
    "strategy_deck", 
    "office", 
    "hangar_bay", 
    "medbay", 
    "presentation_suite"
]


class Registry:
    def __init__(self) -> None:
        self.bots: dict = {}
        self.outputs: dict[str, list[dict]] = {}  # bot_id -> finished results (ReportBot reads this)

    def register(self, bot) -> None:
        self.bots[bot.bot_id] = bot
        self.outputs.setdefault(bot.bot_id, [])

    def get(self, bot_id: str):
        return self.bots.get(bot_id)

    def snapshot(self) -> list[dict]:
        return [b.state() for b in self.bots.values()]


registry = Registry()
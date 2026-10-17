import asyncio
from pathlib import Path
import pandas as pd
from core.registry import registry
from .base import BaseBot, TaskResult

OUT = Path(__file__).resolve().parent.parent / "output"


class ExcelBot(BaseBot):
    bot_id, name, room, color = "excel_bot", "ExcelBot", "strategy_deck", "#2ecc71"

    async def work(self, **kwargs) -> TaskResult:
        stats = (registry.outputs["data_bot"][-1].get("stats") if registry.outputs["data_bot"] else None)
        tmp = OUT / "dashboard_DRAFT.xlsx"

        def build():
            with pd.ExcelWriter(tmp, engine="xlsxwriter") as xw:
                wb = xw.book
                ws = wb.add_worksheet("Dashboard")
                xw.sheets["Dashboard"] = ws
                head = wb.add_format({"bold": True, "bg_color": "#1f2a44", "font_color": "white"})
                ws.write_row(0, 0, ["Metric", "Value"], head)
                rows = [("Rows analysed", stats["rows"] if stats else 0)]
                for i, (k, v) in enumerate(rows, start=1):
                    ws.write_row(i, 0, [k, v])
                ws.set_column(0, 1, 22)
        await asyncio.to_thread(build)
        return TaskResult(summary="Dashboard drafted: dashboard_DRAFT.xlsx", data={"draft": str(tmp), "preview": {"file": tmp.name}})

    async def execute(self, result: TaskResult) -> None:
        draft = Path(result.data["draft"])
        draft.replace(draft.with_name("dashboard.xlsx"))  # "publish" = rename draft -> final

    async def discard(self, result: TaskResult) -> None:
        Path(result.data["draft"]).unlink(missing_ok=True)

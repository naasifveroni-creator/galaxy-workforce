import asyncio
import numpy as np
import pandas as pd
from .base import BaseBot, TaskResult


class DataBot(BaseBot):
    bot_id, name, room, color = "data_bot", "DataBot", "data_forge", "#4da6ff"

    async def work(self, path: str | None = None, **kwargs) -> TaskResult:
        def analyze():
            if path:
                df = pd.read_excel(path) if path.endswith((".xlsx", ".xls")) else pd.read_csv(path)
            else:  # demo data
                df = pd.DataFrame({"site": np.random.choice(["Wembley", "BLVD"], 200),
                                   "delay_hours": np.random.gamma(2.0, 1.5, 200).round(2)})
            num = df.select_dtypes("number")
            return {"rows": len(df), "columns": list(df.columns),
                    "describe": num.describe().round(2).to_dict()}
        stats = await asyncio.to_thread(analyze)
        return TaskResult(summary=f"Analysed {stats['rows']} rows", data={"stats": stats, "preview": stats["describe"]})

    async def execute(self, result: TaskResult) -> None:
        pass  # nothing external to do; approval just "publishes" the findings to the registry

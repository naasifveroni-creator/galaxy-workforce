// Shared map config. Room IDs MUST match backend/core/registry.py ROOMS.
const WS_URL = "wss://orange-system-g4w4gq7r9gxxcw7q-8000.app.github.dev/ws";
const TILE = 80;

// Grid-based layout: col/row/w/h are in tiles.
const ROOMS = {
  bridge:        { label: "Bridge (HQ)",    col: 5, row: 4, w: 3, h: 2, color: 0x2c3e50 },
  comms_array:   { label: "Comms Array",    col: 0, row: 0, w: 4, h: 3, color: 0x7b241c },
  data_forge:    { label: "Data Forge",     col: 8, row: 0, w: 4, h: 3, color: 0x1b4f72 },
  strategy_deck: { label: "Strategy Deck",  col: 0, row: 5, w: 4, h: 3, color: 0x1d6a39 },
};

// Slight x-offset per bot so two bots in one room don't stack perfectly.
const BOT_OFFSETS = { email_bot: [-20, 0], data_bot: [0, 0], excel_bot: [-20, 0], report_bot: [20, 0] };
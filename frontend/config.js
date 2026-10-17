// Shared map config. Room IDs MUST match backend/core/registry.py ROOMS.
const WS_URL = "wss://orange-system-g4w4gq7r9gxxcw7q-8000.app.github.dev/ws";
const TILE = 80;

// Grid-based layout: col/row/w/h are in tiles.
const ROOMS = {
  bridge:        { label: "Bridge (HQ)",     col: 4, row: 3, w: 4, h: 3, color: 0x1e293b },
  comms_array:   { label: "Comms Array",     col: 0, row: 0, w: 3, h: 2, color: 0x451a1a },
  data_forge:    { label: "Data Forge",      col: 9, row: 0, w: 3, h: 2, color: 0x0f3a4d },
  strategy_deck: { label: "Strategy Deck",   col: 0, row: 6, w: 3, h: 2, color: 0x1a3d1a },
  office:        { label: "Commander's Office", col: 9, row: 6, w: 3, h: 2, color: 0x3b2b4d }
};

// Spread the bots out inside the new bigger Bridge
const BOT_OFFSETS = { 
  email_bot: [-90, 10], 
  data_bot: [-30, 10], 
  excel_bot: [30, 10], 
  report_bot: [90, 10] 
};
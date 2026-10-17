const WS_URL = "wss://orange-system-g4w4gq7r9gxxcw7q-8000.app.github.dev/ws";
const TILE = 80;

const ROOMS = {
  bridge:        { label: "Bridge (HQ)",    col: 5, row: 4, w: 3, h: 2, color: 0x2c3e50 },
  comms_array:   { label: "Comms Array",    col: 0, row: 0, w: 4, h: 3, color: 0x7b241c },
  data_forge:    { label: "Data Forge",     col: 8, row: 0, w: 4, h: 3, color: 0x1b4f72 },
  strategy_deck: { label: "Strategy Deck",  col: 0, row: 5, w: 4, h: 3, color: 0x1d6a39 },
};

// Widened the offsets so they don't overlap and cover each other's text
const BOT_OFFSETS = { 
  email_bot: [-90, -10], 
  data_bot: [-30, -10], 
  excel_bot: [30, -10], 
  report_bot: [90, -10] 
};
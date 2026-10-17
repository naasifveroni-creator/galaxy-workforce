/*
 THE WEBSOCKET BRIDGE (browser half)
 -----------------------------------
 FastAPI /ws  --JSON-->  `ws.onmessage`  -->  scene.applyBotStatus()  -->  Phaser tween
 Button click --JSON-->  `send()`        -->  FastAPI handle_message() -->  hub.resolve() wakes the bot
*/

let scene;                 // the active Phaser scene (set in create)
const bots = {};           // bot_id -> { sprite, label, statusText }
let ws;

// ---------- WebSocket client ----------
function send(obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }

function connect() {
  ws = new WebSocket(WS_URL);
  ws.onopen  = () => document.getElementById("conn").textContent = "🟢 connected";
  ws.onclose = () => { document.getElementById("conn").textContent = "🔴 reconnecting..."; setTimeout(connect, 1500); };
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    switch (msg.type) {
      case "SNAPSHOT":
        msg.bots.forEach(b => { ensureBot(b); applyBotStatus(b, true); });
        document.getElementById("approvals").innerHTML = "";
        msg.approvals.forEach(showApproval);
        break;
      case "BOT_STATUS":        ensureBot(msg); applyBotStatus(msg); break;
      case "APPROVAL_REQUEST":  showApproval(msg); break;
      case "APPROVAL_RESOLVED": document.getElementById("ap-" + msg.action_id)?.remove(); break;
    }
  };
}

// ---------- HUD ----------
function addControl(bot) {
  if (document.getElementById("btn-" + bot.bot_id)) return;
  const b = document.createElement("button");
  b.id = "btn-" + bot.bot_id;
  b.textContent = "▶ Run " + bot.name;
  b.onclick = () => send({ type: "START_TASK", bot_id: bot.bot_id });
  document.getElementById("controls").appendChild(b);
}

function showApproval(a) {
  const el = document.createElement("div");
  el.className = "card"; el.id = "ap-" + a.action_id;
  el.innerHTML = `<b>${a.bot_id}</b><br>${a.summary}<pre>${JSON.stringify(a.details, null, 2)}</pre>
    <div class="row"><button class="approve">Approve</button><button class="reject">Reject</button></div>`;
  el.querySelector(".approve").onclick = () => send({ type: "APPROVE_ACTION", action_id: a.action_id });
  el.querySelector(".reject").onclick  = () => send({ type: "REJECT_ACTION",  action_id: a.action_id });
  document.getElementById("approvals").appendChild(el);
}

// ---------- Map helpers ----------
const roomCenter = (id, botId) => {
  const r = ROOMS[id]; const [ox, oy] = BOT_OFFSETS[botId] || [0, 0];
  return { x: (r.col + r.w / 2) * TILE + ox, y: (r.row + r.h / 2) * TILE + oy };
};

function ensureBot(b) {
  addControl(b);
  if (bots[b.bot_id]) return;
  const p = roomCenter(b.location || "bridge", b.bot_id);
  const color = Phaser.Display.Color.HexStringToColor(b.color).color;
  const sprite = scene.add.circle(p.x, p.y, 16, color).setStrokeStyle(3, 0xffffff).setDepth(10);
  const label = scene.add.text(p.x, p.y - 30, b.name, { fontSize: "12px", color: "#fff" }).setOrigin(0.5).setDepth(11);
  const statusText = scene.add.text(p.x, p.y + 28, "", { fontSize: "11px", color: "#9fb3ff" }).setOrigin(0.5).setDepth(11);
  bots[b.bot_id] = { sprite, label, statusText };
}

// The core hook: status -> animation
function applyBotStatus(msg, instant = false) {
  const bot = bots[msg.bot_id]; if (!bot) return;
  bot.statusText.setText(msg.status);

  // Move whenever the server says we're walking (or working at a new location).
  if (msg.status === "walking" || msg.status === "working") {
    const t = roomCenter(msg.location, msg.bot_id);
    const dist = Phaser.Math.Distance.Between(bot.sprite.x, bot.sprite.y, t.x, t.y);
    if (dist > 2) {
      const targets = [bot.sprite, bot.label, bot.statusText];
      targets.forEach((o, i) => scene.tweens.add({
        targets: o, x: t.x, y: t.y + [0, -30, 28][i],
        duration: instant ? 0 : Math.min(2000, dist * 4), ease: "Sine.easeInOut",
      }));
    }
  }
  // Pulse while waiting for you
  scene.tweens.killTweensOf(bot.sprite.scale ? bot.sprite : []);
  bot.sprite.setScale(1);
  if (msg.status === "waiting_approval") {
    scene.tweens.add({ targets: bot.sprite, scale: 1.4, yoyo: true, repeat: -1, duration: 500 });
  }
}

// ---------- Phaser ----------
new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 12 * TILE, height: 8 * TILE,
  backgroundColor: "#05060f",
  scene: {
    create() {
      scene = this;
      // faint grid
      const g = this.add.graphics().lineStyle(1, 0x121a33);
      for (let x = 0; x <= 12; x++) g.lineBetween(x * TILE, 0, x * TILE, 8 * TILE);
      for (let y = 0; y <= 8; y++)  g.lineBetween(0, y * TILE, 12 * TILE, y * TILE);
      // rooms
      Object.values(ROOMS).forEach(r => {
        this.add.rectangle(r.col * TILE, r.row * TILE, r.w * TILE, r.h * TILE, r.color, 0.85)
          .setOrigin(0).setStrokeStyle(2, 0x8899cc);
        this.add.text(r.col * TILE + 8, r.row * TILE + 6, r.label, { fontSize: "13px", color: "#fff" });
      });
      connect(); // start the bridge only after the scene exists
    },
  },
});

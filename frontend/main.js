let scene;
const bots = {};
let ws;

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
        document.getElementById("feed").innerHTML = "";
        msg.tasks.slice().reverse().forEach(updateTask);
        break;
      case "TASK_UPDATE":       updateTask(msg.task); break;
      case "ERROR":             document.getElementById("conn").textContent = "⚠ " + msg.message; break;
      case "BOT_STATUS":        ensureBot(msg); applyBotStatus(msg); break;
      case "APPROVAL_REQUEST":  showApproval(msg); break;
      case "APPROVAL_RESOLVED": document.getElementById("ap-" + msg.task_id)?.remove(); break;
    }
  };
}

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
  el.className = "card"; el.id = "ap-" + a.task_id;
  el.innerHTML = `<b>${a.bot_id}</b><br>${a.summary}<pre>${JSON.stringify(a.details, null, 2)}</pre>
    <div class="row"><button class="approve">Approve</button><button class="reject">Reject</button></div>`;
  el.querySelector(".approve").onclick = () => send({ type: "APPROVE_ACTION", task_id: a.task_id });
  el.querySelector(".reject").onclick  = () => send({ type: "REJECT_ACTION",  task_id: a.task_id });
  document.getElementById("approvals").appendChild(el);
}

function updateTask(t) {
  const feed = document.getElementById("feed");
  let el = document.getElementById("t-" + t.task_id);
  if (!el) {
    el = document.createElement("div"); el.id = "t-" + t.task_id; el.style.cssText = "font-size:12px;margin:4px 0";
    feed.prepend(el);
    while (feed.children.length > 15) feed.lastChild.remove();
  }
  el.textContent = `${t.bot_id} · ${t.status}${t.summary ? " — " + t.summary : ""}`;
}

const roomCenter = (id, botId) => {
  const r = ROOMS[id]; const [ox, oy] = BOT_OFFSETS[botId] || [0, 0];
  return { x: (r.col + r.w / 2) * TILE + ox, y: (r.row + r.h / 2) * TILE + oy };
};

// Using frame numbers based on the 6-column Phaser sprite sheet
const BOT_FRAMES = {
  email_bot: { idle: 0, walk: [0, 1, 2, 3, 4, 5] },      // Red
  excel_bot: { idle: 6, walk: [6, 7, 8, 9, 10, 11] },    // Blue
  report_bot:{ idle: 12, walk: [12, 13, 14, 15, 16, 17] },// Green
  data_bot:  { idle: 30, walk: [30, 31, 32, 33, 34, 35] } // Yellow
};

function ensureBot(b) {
  addControl(b);
  if (bots[b.bot_id]) return;
  const p = roomCenter(b.location || "bridge", b.bot_id);
  
  const frames = BOT_FRAMES[b.bot_id] || BOT_FRAMES.email_bot;
  const sprite = scene.add.sprite(p.x, p.y, "crew", frames.idle).setDepth(10).setScale(1.0);

  const label = scene.add.text(p.x, p.y - 35, b.name, { fontSize: "12px", color: "#fff", fontWeight: "bold", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(11);
  const statusText = scene.add.text(p.x, p.y + 30, "", { fontSize: "11px", color: "#9fb3ff", stroke: "#000", strokeThickness: 2 }).setOrigin(0.5).setDepth(11);
  
  const walkAnimKey = `walk-${b.bot_id}`;
  if (!scene.anims.exists(walkAnimKey)) {
    scene.anims.create({
      key: walkAnimKey,
      frames: frames.walk.map(f => ({ key: 'crew', frame: f })),
      frameRate: 8,
      repeat: -1
    });
  }
  
  bots[b.bot_id] = { sprite, label, statusText, walkAnimKey, idleFrame: frames.idle };
}

function applyBotStatus(msg, instant = false) {
  const bot = bots[msg.bot_id]; if (!bot) return;
  bot.statusText.setText(msg.status);

  if (msg.status === "walking" || msg.status === "working") {
    const t = roomCenter(msg.location, msg.bot_id);
    const dist = Phaser.Math.Distance.Between(bot.sprite.x, bot.sprite.y, t.x, t.y);
    
    if (dist > 2) {
      bot.sprite.setFlipX(t.x < bot.sprite.x);
      bot.sprite.play(bot.walkAnimKey, true);

      const targets = [bot.sprite, bot.label, bot.statusText];
      targets.forEach((o, i) => scene.tweens.add({
        targets: o, x: t.x, y: t.y + [0, -35, 30][i],
        duration: instant ? 0 : Math.min(2000, dist * 4), 
        ease: "Sine.easeInOut",
        onComplete: () => {
          bot.sprite.stop();
          bot.sprite.setTexture('crew', bot.idleFrame);
          bot.sprite.setFlipX(false);
        }
      }));
    }
  }

  if (bot.pulse) { bot.pulse.stop(); bot.pulse = null; bot.sprite.setScale(1.0); }
  if (msg.status === "awaiting_approval") {
    bot.pulse = scene.tweens.add({ targets: bot.sprite, y: bot.sprite.y - 10, yoyo: true, repeat: -1, duration: 300 });
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 12 * TILE, height: 8 * TILE,
  backgroundColor: "#05060f",
  scene: {
    preload() {
      // THIS is the permanent, official Phaser link for Among Us characters.
      this.load.spritesheet('crew', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/animations/amongus.png', { frameWidth: 64, frameHeight: 64 });
    },
    create() {
      scene = this;

      const g = this.add.graphics().lineStyle(1, 0x121a33);
      for (let x = 0; x <= 12; x++) g.lineBetween(x * TILE, 0, x * TILE, 8 * TILE);
      for (let y = 0; y <= 8; y++)  g.lineBetween(0, y * TILE, 12 * TILE, y * TILE);
      
      Object.values(ROOMS).forEach(r => {
        this.add.rectangle(r.col * TILE, r.row * TILE, r.w * TILE, r.h * TILE, r.color, 0.85)
          .setOrigin(0).setStrokeStyle(2, 0x8899cc);
        this.add.text(r.col * TILE + 8, r.row * TILE + 6, r.label, { fontSize: "13px", color: "#fff" });
      });
      connect(); 
    },
  },
});
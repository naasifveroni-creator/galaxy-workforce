/*
 THE WEBSOCKET BRIDGE (browser half)
*/
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

function ensureBot(b) {
  addControl(b);
  if (bots[b.bot_id]) return;
  const p = roomCenter(b.location || "bridge", b.bot_id);
  
  // 1. Create the sprite instead of a circle
  const sprite = scene.add.sprite(p.x, p.y, "crew").setDepth(10).setScale(0.8);
  
  // 2. Tint the sprite with the bot's specific color
  const color = Phaser.Display.Color.HexStringToColor(b.color).color;
  sprite.setTint(color);
  
  // 3. Play the idle animation
  sprite.play("idle");

  const label = scene.add.text(p.x, p.y - 35, b.name, { fontSize: "12px", color: "#fff", fontWeight: "bold", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(11);
  const statusText = scene.add.text(p.x, p.y + 30, "", { fontSize: "11px", color: "#9fb3ff", stroke: "#000", strokeThickness: 2 }).setOrigin(0.5).setDepth(11);
  
  bots[b.bot_id] = { sprite, label, statusText };
}

function applyBotStatus(msg, instant = false) {
  const bot = bots[msg.bot_id]; if (!bot) return;
  bot.statusText.setText(msg.status);

  if (msg.status === "walking" || msg.status === "working") {
    const t = roomCenter(msg.location, msg.bot_id);
    const dist = Phaser.Math.Distance.Between(bot.sprite.x, bot.sprite.y, t.x, t.y);
    
    if (dist > 2) {
      // Flip the sprite based on walking direction
      if (t.x < bot.sprite.x) {
        bot.sprite.setFlipX(true);
      } else {
        bot.sprite.setFlipX(false);
      }
      
      // Play walking animation
      bot.sprite.play("walk", true);

      const targets = [bot.sprite, bot.label, bot.statusText];
      targets.forEach((o, i) => scene.tweens.add({
        targets: o, x: t.x, y: t.y + [0, -35, 30][i],
        duration: instant ? 0 : Math.min(2000, dist * 4), 
        ease: "Sine.easeInOut",
        onComplete: () => {
          // Return to idle when they stop moving
          bot.sprite.play("idle", true);
          bot.sprite.setFlipX(false);
        }
      }));
    }
  }

  if (bot.pulse) { bot.pulse.stop(); bot.pulse = null; bot.sprite.setScale(0.8); }
  if (msg.status === "awaiting_approval") {
    bot.pulse = scene.tweens.add({ targets: bot.sprite, scale: 0.9, yoyo: true, repeat: -1, duration: 500 });
  }
}

// ---------- Phaser with Sprite Loading ----------
new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 12 * TILE, height: 8 * TILE,
  backgroundColor: "#05060f",
  scene: {
    preload() {
      // We use a public URL so you don't have to download anything!
      // This loads a simple 2D Among Us style sprite sheet.
      this.load.spritesheet('crew', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/ufo.png', { frameWidth: 32, frameHeight: 32 });
      
      // NOTE: Since the UFO image doesn't have walk animations, we will just spin it slightly for the "walk" animation to simulate movement. 
    },
    create() {
      scene = this;

      // Create Animations
      this.anims.create({
        key: 'idle',
        frames: [{ key: 'crew', frame: 0 }],
        frameRate: 1
      });

      this.anims.create({
        key: 'walk',
        frames: [{ key: 'crew', frame: 1 }],
        frameRate: 10,
        repeat: -1
      });

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
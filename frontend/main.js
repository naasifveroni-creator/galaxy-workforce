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

const BOT_COLORS = {
  email_bot: 0xff0000, // Red
  data_bot:  0xffff00, // Yellow
  excel_bot: 0x0000ff, // Blue
  report_bot:0x00ff00  // Green
};

function ensureBot(b) {
  addControl(b);
  if (bots[b.bot_id]) return;
  const p = roomCenter(b.location || "bridge", b.bot_id);
  
  // 1. Create the sprite
  const container = scene.add.container(p.x, p.y).setDepth(10);
  const g = scene.add.graphics();
  const color = BOT_COLORS[b.bot_id] || 0xffffff;
  
  // 2. Draw the Among Us character
  g.fillStyle(color, 1);
  g.fillRoundedRect(-12, -16, 24, 32, 8);
  g.fillRoundedRect(-18, -6, 10, 18, 4);
  g.fillStyle(0x87ceeb, 1);
  g.fillRoundedRect(2, -10, 14, 8, 4);
  g.lineStyle(2, 0x333333, 1);
  g.strokeRoundedRect(2, -10, 14, 8, 4);
  g.fillStyle(0x000000, 0.5);
  g.fillRect(-8, 12, 6, 6);
  g.fillRect(2, 12, 6, 6);
  container.add(g);

  const label = scene.add.text(p.x, p.y - 35, b.name, { fontSize: "12px", color: "#fff", fontWeight: "bold", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(11);
  const statusText = scene.add.text(p.x, p.y + 30, "", { fontSize: "11px", color: "#9fb3ff", stroke: "#000", strokeThickness: 2 }).setOrigin(0.5).setDepth(11);
  
  bots[b.bot_id] = { sprite: container, label, statusText };
}

function applyBotStatus(msg, instant = false) {
  const bot = bots[msg.bot_id]; if (!bot) return;
  bot.statusText.setText(msg.status);

  if (msg.status === "walking" || msg.status === "working") {
    const t = roomCenter(msg.location, msg.bot_id);
    const dist = Phaser.Math.Distance.Between(bot.sprite.x, bot.sprite.y, t.x, t.y);
    
    if (dist > 2) {
      const targets = [bot.sprite, bot.label, bot.statusText];
      targets.forEach((o, i) => scene.tweens.add({
        targets: o, x: t.x, y: t.y + [0, -35, 30][i],
        duration: instant ? 0 : Math.min(2000, dist * 4), 
        ease: "Sine.easeInOut"
      }));
    }
  }

  if (bot.pulse) { bot.pulse.stop(); bot.pulse = null; bot.sprite.setScale(1); }
  if (msg.status === "awaiting_approval") {
    bot.pulse = scene.tweens.add({ targets: bot.sprite, scale: 1.2, yoyo: true, repeat: -1, duration: 500 });
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
      // Load the Commander avatar (using a reliable Phaser asset)
      this.load.spritesheet('commander', 'https://labs.phaser.io/assets/sprites/dude.png', { frameWidth: 32, frameHeight: 48 });
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

      // --- ADD THE COMMANDER AVATAR ---
      // Spawn the commander in the center of the Bridge
      const bridge = ROOMS['bridge'];
      const startX = (bridge.col + bridge.w / 2) * TILE;
      const startY = (bridge.row + bridge.h / 2) * TILE;
      
      this.commander = this.add.sprite(startX, startY, 'commander', 4).setDepth(20).setScale(1.2);
      
      // Add a label above the Commander
      this.commanderLabel = this.add.text(startX, startY - 40, "COMMANDER", { 
        fontSize: "12px", color: "#f1c40f", fontWeight: "bold", stroke: "#000", strokeThickness: 3 
      }).setOrigin(0.5).setDepth(21);

      // Create animations for the commander
      this.anims.create({
        key: 'left',
        frames: this.anims.generateFrameNumbers('commander', { start: 0, end: 3 }),
        frameRate: 10,
        repeat: -1
      });
      this.anims.create({
        key: 'turn',
        frames: [ { key: 'commander', frame: 4 } ],
        frameRate: 20
      });
      this.anims.create({
        key: 'right',
        frames: this.anims.generateFrameNumbers('commander', { start: 5, end: 8 }),
        frameRate: 10,
        repeat: -1
      });

      // --- KEYBOARD CONTROLS ---
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = this.input.keyboard.addKeys('W,A,S,D');

      connect(); 
    },
    update() {
      // If the commander doesn't exist yet, do nothing
      if (!this.commander) return;

      const speed = 3;
      let moving = false;

      // Left
      if (this.cursors.left.isDown || this.wasd.A.isDown) {
        this.commander.x -= speed;
        this.commander.play('left', true);
        moving = true;
      }
      // Right
      else if (this.cursors.right.isDown || this.wasd.D.isDown) {
        this.commander.x += speed;
        this.commander.play('right', true);
        moving = true;
      }

      // Up
      if (this.cursors.up.isDown || this.wasd.W.isDown) {
        this.commander.y -= speed;
        moving = true;
      }
      // Down
      else if (this.cursors.down.isDown || this.wasd.S.isDown) {
        this.commander.y += speed;
        moving = true;
      }

      // If not moving, play the idle 'turn' frame
      if (!moving) {
        this.commander.play('turn', true);
      }

      // Make the label follow the commander
      this.commanderLabel.x = this.commander.x;
      this.commanderLabel.y = this.commander.y - 40;
    }
  },
});
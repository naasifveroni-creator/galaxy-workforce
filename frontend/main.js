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
  
  const container = scene.add.container(p.x, p.y).setDepth(10);
  const g = scene.add.graphics();
  const color = BOT_COLORS[b.bot_id] || 0xffffff;
  
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

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 12 * TILE, height: 8 * TILE,
  backgroundColor: "#05060f",
  scene: {
    preload() {
      this.load.spritesheet('commander', 'https://labs.phaser.io/assets/sprites/dude.png', { frameWidth: 32, frameHeight: 48 });
    },
    create() {
      scene = this;

      // 1. Deep Space Background
      const stars = this.add.graphics();
      for (let i = 0; i < 200; i++) {
        stars.fillStyle(0xffffff, Math.random() * 0.8 + 0.2);
        stars.fillCircle(Math.random() * 960, Math.random() * 640, Math.random() * 1.5);
      }

      // 2. Metal Floor Grid (Ship Hull)
      const g = this.add.graphics().lineStyle(1, 0x1a2b4c, 0.5);
      for (let x = 0; x <= 12; x++) g.lineBetween(x * TILE, 0, x * TILE, 8 * TILE);
      for (let y = 0; y <= 8; y++)  g.lineBetween(0, y * TILE, 12 * TILE, y * TILE);

      // ---------------------------------------------------------
      // ROOM 1: THE BRIDGE (Command Center)
      // ---------------------------------------------------------
      const bridge = ROOMS['bridge'];
      const bx = bridge.col * TILE;
      const by = bridge.row * TILE;
      const bw = bridge.w * TILE;
      const bh = bridge.h * TILE;

      // Room Shadow & Floor
      this.add.rectangle(bx + 4, by + 4, bw, bh, 0x000000, 0.5).setOrigin(0);
      this.add.rectangle(bx, by, bw, bh, 0x1e293b, 0.95).setOrigin(0);
      
      // Raised Command Platform
      this.add.rectangle(bx + 30, by + 30, bw - 60, bh - 60, 0x0f172a).setOrigin(0).setStrokeStyle(2, 0x334155);
      
      // Captain's Chair
      this.add.circle(bx + bw/2, by + bh - 40, 25, 0x2c3e50);
      this.add.circle(bx + bw/2, by + bh - 40, 15, 0x1e293b);
      
      // Holo-Map Table
      this.add.rectangle(bx + 40, by + 40, 100, 50, 0x1e293b).setOrigin(0).setStrokeStyle(1, 0x4da6ff);
      const holo = this.add.rectangle(bx + 50, by + 50, 80, 30, 0x4da6ff, 0.2).setOrigin(0);
      this.tweens.add({ targets: holo, alpha: 0.6, yoyo: true, repeat: -1, duration: 1000 });
      
      this.add.text(bx + 10, by + 10, "BRIDGE (HQ)", { fontSize: "12px", color: "#4da6ff", fontWeight: "bold", stroke: "#000", strokeThickness: 2 });

      // ---------------------------------------------------------
      // ROOM 2: COMMS ARRAY (Server & Antenna Room)
      // ---------------------------------------------------------
      const comms = ROOMS['comms_array'];
      const cx = comms.col * TILE;
      const cy = comms.row * TILE;
      const cw = comms.w * TILE;
      const ch = comms.h * TILE;

      this.add.rectangle(cx + 4, cy + 4, cw, ch, 0x000000, 0.5).setOrigin(0);
      this.add.rectangle(cx, cy, cw, ch, 0x451a1a, 0.95).setOrigin(0);
      
      // Wall of Server Racks
      for (let i = 0; i < 4; i++) {
        this.add.rectangle(cx + 20, cy + 40 + (i * 35), 80, 30, 0x1c0c0c).setOrigin(0).setStrokeStyle(1, 0x7b241c);
        const light = this.add.circle(cx + 90, cy + 55 + (i * 35), 3, 0xff4d4d);
        this.tweens.add({ targets: light, alpha: 0.1, yoyo: true, repeat: -1, duration: 300 + Math.random() * 500 });
      }

      // Satellite Uplink Dish
      this.add.circle(cx + cw - 60, cy + 60, 40, 0x1a1a1a).setStrokeStyle(3, 0x555555);
      this.add.circle(cx + cw - 60, cy + 60, 30, 0x2a2a2a);
      this.add.line(cx + cw - 60, cy + 60, 0, 0, 0, -40, 0x888888).setLineWidth(2);
      
      this.add.text(cx + 10, cy + 10, "COMMS ARRAY", { fontSize: "12px", color: "#ff4d4d", fontWeight: "bold", stroke: "#000", strokeThickness: 2 });

      // ---------------------------------------------------------
      // ROOM 3: DATA FORGE (Data Core Room)
      // ---------------------------------------------------------
      const data = ROOMS['data_forge'];
      const dx = data.col * TILE;
      const dy = data.row * TILE;
      const dw = data.w * TILE;
      const dh = data.h * TILE;

      this.add.rectangle(dx + 4, dy + 4, dw, dh, 0x000000, 0.5).setOrigin(0);
      this.add.rectangle(dx, dy, dw, dh, 0x0f3a4d, 0.95).setOrigin(0);

      // Central Data Core
      this.add.circle(dx + dw/2, dy + dh/2, 50, 0x0a2533).setStrokeStyle(2, 0x1b4f72);
      this.add.circle(dx + dw/2, dy + dh/2, 30, 0x4da6ff, 0.2);
      this.add.circle(dx + dw/2, dy + dh/2, 15, 0x87ceeb, 0.5);
      
      // Rotating Data Rings
      const ring1 = this.add.circle(dx + dw/2, dy + dh/2, 40, 0x000000, 0).setStrokeStyle(1, 0x4da6ff, 0.6);
      this.tweens.add({ targets: ring1, angle: 360, repeat: -1, duration: 4000 });
      const ring2 = this.add.circle(dx + dw/2, dy + dh/2, 60, 0x000000, 0).setStrokeStyle(1, 0x4da6ff, 0.3);
      this.tweens.add({ targets: ring2, angle: -360, repeat: -1, duration: 6000 });

      // Server Pylons
      this.add.rectangle(dx + 20, dy + 20, 30, 30, 0x051420).setOrigin(0).setStrokeStyle(1, 0x1b4f72);
      this.add.rectangle(dx + dw - 50, dy + 20, 30, 30, 0x051420).setOrigin(0).setStrokeStyle(1, 0x1b4f72);
      this.add.rectangle(dx + 20, dy + dh - 50, 30, 30, 0x051420).setOrigin(0).setStrokeStyle(1, 0x1b4f72);
      this.add.rectangle(dx + dw - 50, dy + dh - 50, 30, 30, 0x051420).setOrigin(0).setStrokeStyle(1, 0x1b4f72);

      this.add.text(dx + 10, dy + 10, "DATA FORGE", { fontSize: "12px", color: "#4da6ff", fontWeight: "bold", stroke: "#000", strokeThickness: 2 });

      // ---------------------------------------------------------
      // ROOM 4: STRATEGY DECK (War Room)
      // ---------------------------------------------------------
      const strat = ROOMS['strategy_deck'];
      const sx = strat.col * TILE;
      const sy = strat.row * TILE;
      const sw = strat.w * TILE;
      const sh = strat.h * TILE;

      this.add.rectangle(sx + 4, sy + 4, sw, sh, 0x000000, 0.5).setOrigin(0);
      this.add.rectangle(sx, sy, sw, sh, 0x1a3d1a, 0.95).setOrigin(0);

      // Central War Table
      this.add.ellipse(sx + sw/2, sy + sh/2, 160, 100, 0x0f2410).setStrokeStyle(2, 0x2ecc71);
      this.add.ellipse(sx + sw/2, sy + sh/2, 140, 80, 0x000000, 0.5);
      
      // Holographic Board
      const holoBoard = this.add.rectangle(sx + sw/2, sy + sh/2, 100, 50, 0x2ecc71, 0.1);
      this.tweens.add({ targets: holoBoard, alpha: 0.4, yoyo: true, repeat: -1, duration: 1500 });

      // Surrounding Consoles
      for (let i = 0; i < 4; i++) {
        const angle = (i * 90) * (Math.PI / 180);
        const ox = Math.cos(angle) * 110;
        const oy = Math.sin(angle) * 70;
        this.add.rectangle(sx + sw/2 + ox - 15, sy + sh/2 + oy - 10, 30, 20, 0x0f2410).setOrigin(0).setStrokeStyle(1, 0x2ecc71);
      }

      this.add.text(sx + 10, sy + 10, "STRATEGY DECK", { fontSize: "12px", color: "#2ecc71", fontWeight: "bold", stroke: "#000", strokeThickness: 2 });

      // ---------------------------------------------------------
      // 4. Add the Commander Avatar
      // ---------------------------------------------------------
      const startX = bx + (bw / 2);
      const startY = by + (bh / 2);
      
      this.commander = this.add.sprite(startX, startY, 'commander', 4).setDepth(20).setScale(1.2);
      
      this.commanderLabel = this.add.text(startX, startY - 40, "COMMANDER", { 
        fontSize: "12px", color: "#f1c40f", fontWeight: "bold", stroke: "#000", strokeThickness: 3 
      }).setOrigin(0.5).setDepth(21);

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

      // 5. Commander Scanner Ability
      this.scanner = this.add.circle(startX, startY, 10, 0x4da6ff, 0.5).setDepth(15);
      this.scanner.setVisible(false);
      this.scanTween = null;

      this.input.keyboard.on('keydown-SPACE', () => {
        this.scanner.setPosition(this.commander.x, this.commander.y);
        this.scanner.setRadius(10);
        this.scanner.setVisible(true);
        
        if (this.scanTween) this.scanTween.stop();
        
        this.scanTween = this.tweens.add({
          targets: this.scanner,
          radius: 300,
          alpha: 0,
          duration: 1000,
          ease: 'Quad.easeOut',
          onComplete: () => {
            this.scanner.setVisible(false);
            this.scanner.setAlpha(0.5);
          }
        });
      });

      // 6. Keyboard Controls
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = this.input.keyboard.addKeys('W,A,S,D');

      connect(); 
    },
    update() {
      if (!this.commander) return;

      const speed = 3;
      let moving = false;

      if (this.cursors.left.isDown || this.wasd.A.isDown) {
        this.commander.x -= speed;
        this.commander.play('left', true);
        moving = true;
      }
      else if (this.cursors.right.isDown || this.wasd.D.isDown) {
        this.commander.x += speed;
        this.commander.play('right', true);
        moving = true;
      }

      if (this.cursors.up.isDown || this.wasd.W.isDown) {
        this.commander.y -= speed;
        moving = true;
      }
      else if (this.cursors.down.isDown || this.wasd.S.isDown) {
        this.commander.y += speed;
        moving = true;
      }

      if (!moving) {
        this.commander.play('turn', true);
      }

      this.commanderLabel.x = this.commander.x;
      this.commanderLabel.y = this.commander.y - 40;
    }
  },
});
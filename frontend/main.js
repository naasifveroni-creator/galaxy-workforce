// --- ADD THIS TO THE VERY TOP OF MAIN.JS ---
window.onerror = function(message, source, lineno, colno, error) {
    alert("CRITICAL ERROR: " + message + "\nLine: " + lineno);
    return false;
};
// -------------------------------------------

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    backgroundColor: '#0a0a0a',
    scene: { preload: preload, create: create }
};
const game = new Phaser.Game(config);
let ws;
let bots = {};

function preload() {}

function create() {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x333333, 1);
    for (let x = 0; x <= 800; x += TILE) graphics.lineBetween(x, 0, x, 600);
    for (let y = 0; y <= 600; y += TILE) graphics.lineBetween(0, y, 800, y);

    for (const [key, room] of Object.entries(ROOMS)) {
        const x = room.col * TILE;
        const y = room.row * TILE;
        const w = room.w * TILE;
        const h = room.h * TILE;
        this.add.rectangle(x, y, w, h, room.color, 0.5).setOrigin(0, 0).setStrokeStyle(1, 0x555555);
        this.add.text(x + 10, y + 10, room.label, { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' });
    }

    connectWebSocket.call(this);
}

function connectWebSocket() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        document.getElementById('connection-status').innerHTML = '🟢 connected';
    };

    ws.onclose = () => {
        document.getElementById('connection-status').innerHTML = '🔴 disconnected';
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'SNAPSHOT') {
            data.bots.forEach(botData => applyBotStatus.call(this, botData));
        } else if (data.type === 'BOT_STATUS') {
            applyBotStatus.call(this, data);
        } else if (data.type === 'APPROVAL_REQUEST') {
            showApprovalCard(data);
        }
    };
}

function applyBotStatus(data) {
    let bot = bots[data.bot_id];
    const targetRoom = ROOMS[data.location] || ROOMS['bridge'];
    const offsetX = BOT_OFFSETS[data.bot_id] ? BOT_OFFSETS[data.bot_id][0] : 0;
    const offsetY = BOT_OFFSETS[data.bot_id] ? BOT_OFFSETS[data.bot_id][1] : 0;
    const targetX = (targetRoom.col * TILE) + (targetRoom.w * TILE / 2) + offsetX;
    const targetY = (targetRoom.row * TILE) + (targetRoom.h * TILE / 2) + offsetY;

    if (!bot) {
        const circle = this.add.circle(targetX, targetY, 15, data.color).setStrokeStyle(2, 0xffffff);
        const label = this.add.text(targetX, targetY - 25, data.name, { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff' }).setOrigin(0.5);
        const statusLabel = this.add.text(targetX, targetY + 25, data.status.replace('_', ' '), { fontFamily: 'monospace', fontSize: '10px', color: '#aaaaaa' }).setOrigin(0.5);
        bot = { sprite: circle, label: label, statusLabel: statusLabel };
        bots[data.bot_id] = bot;
    }

    bot.statusLabel.setText(data.status.replace('_', ' '));

    const currentTargetX = bot.sprite.getData('targetX');
    const currentTargetY = bot.sprite.getData('targetY');

    if (currentTargetX !== targetX || currentTargetY !== targetY) {
        bot.sprite.setData('targetX', targetX);
        bot.sprite.setData('targetY', targetY);
        this.tweens.killTweensOf([bot.sprite, bot.label, bot.statusLabel]);
        this.tweens.add({
            targets: [bot.sprite, bot.label, bot.statusLabel],
            x: targetX,
            y: (target) => {
                if (target === bot.label) return targetY - 25;
                if (target === bot.statusLabel) return targetY + 25;
                return targetY;
            },
            duration: 2000,
            ease: 'Linear'
        });
    }

    if (data.status === 'working' || data.status === 'waiting_approval' || data.status === 'executing') {
        if (!bot.pulseTween) {
            bot.pulseTween = this.tweens.add({ targets: bot.sprite, scale: 1.3, duration: 500, yoyo: true, repeat: -1 });
        }
    } else {
        if (bot.pulseTween) {
            bot.pulseTween.stop();
            bot.pulseTween = null;
            bot.sprite.setScale(1);
        }
    }
}

function showApprovalCard(data) {
    const container = document.getElementById('approval-container');
    if(!container) return;
    const card = document.createElement('div');
    card.className = 'approval-card';
    card.innerHTML = `
        <div style="font-weight:bold; color:#4da6ff; margin-bottom:5px;">${data.bot_id}</div>
        <div style="margin-bottom:10px;">${data.summary}</div>
        <div style="display:flex; gap:10px;">
            <button class="action-btn" style="background:#2ecc71; color:#fff;" onclick="sendApproval('${data.bot_id}', true)">APPROVE</button>
            <button class="action-btn" style="background:#e74c3c; color:#fff;" onclick="sendApproval('${data.bot_id}', false)">REJECT</button>
        </div>
    `;
    container.appendChild(card);
}

function sendApproval(botId, isApproved) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'APPROVE_ACTION', bot_id: botId, approved: isApproved }));
        const card = document.getElementById(`card-${botId}`);
        if (card) card.remove();
    } else {
        alert("WebSocket is not connected!");
    }
}

function sendDispatch(botId) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'DISPATCH', bot_id: botId }));
    } else {
        alert("WebSocket is not connected! Check the HUD.");
    }
}
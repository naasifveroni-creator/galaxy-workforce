// --- Game Configuration ---
const config = {
    type: Phaser.AUTO,
    width: 1000,
    height: 600,
    parent: 'game-container',
    backgroundColor: '#0a0a0a',
    scene: {
        preload: preload,
        create: create
    }
};

const game = new Phaser.Game(config);

let ws;
let bots = {}; // Stores our bot objects
const botRadius = 15;

// --- Phaser Scene ---
function preload() {
    // We aren't loading any images yet, just using colored circles for now
}

function create() {
    // 1. Draw the Grid
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x333333, 1);
    for (let x = 0; x <= 1000; x += TILE) {
        graphics.lineBetween(x, 0, x, 600);
    }
    for (let y = 0; y <= 600; y += TILE) {
        graphics.lineBetween(0, y, 1000, y);
    }

    // 2. Draw the Rooms
    for (const [key, room] of Object.entries(ROOMS)) {
        const x = room.col * TILE;
        const y = room.row * TILE;
        const w = room.w * TILE;
        const h = room.h * TILE;

        // Room background
        const roomRect = this.add.rectangle(x, y, w, h, room.color, 0.5).setOrigin(0, 0);
        roomRect.setStrokeStyle(1, 0x555555);

        // Room Label
        this.add.text(x + 10, y + 10, room.label, {
            fontFamily: 'monospace', fontSize: '14px', color: '#ffffff'
        });
    }

    // 3. Connect to the Python Backend via WebSocket
    connectWebSocket.call(this);
}

// --- WebSocket Logic ---
function connectWebSocket() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        document.getElementById('connection-status').innerHTML = '🟢 connected';
        document.getElementById('connection-status').style.color = '#2ecc71';
    };

    ws.onclose = () => {
        document.getElementById('connection-status').innerHTML = '🔴 disconnected';
        document.getElementById('connection-status').style.color = '#ff4d4d';
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'SNAPSHOT') {
            // Initial state load
            data.bots.forEach(botData => applyBotStatus.call(this, botData));
        } 
        else if (data.type === 'BOT_STATUS') {
            applyBotStatus.call(this, data);
        } 
        else if (data.type === 'APPROVAL_REQUEST') {
            showApprovalCard(data);
        }
    };
}

// --- Bot Rendering & Movement ---
function applyBotStatus(data) {
    let bot = bots[data.bot_id];
    const targetRoom = ROOMS[data.location] || ROOMS['bridge'];

    // Calculate exact center of the room
    const targetX = (targetRoom.col * TILE) + (targetRoom.w * TILE / 2);
    const targetY = (targetRoom.row * TILE) + (targetRoom.h * TILE / 2);

    // 1. Create bot if it doesn't exist
    if (!bot) {
        const circle = this.add.circle(targetX, targetY, botRadius, data.color);
        circle.setStrokeStyle(2, 0xffffff);
        
        const label = this.add.text(targetX, targetY - 25, data.name, {
            fontFamily: 'monospace', fontSize: '12px', color: '#ffffff'
        }).setOrigin(0.5);

        const statusLabel = this.add.text(targetX, targetY + 25, data.status.replace('_', ' '), {
            fontFamily: 'monospace', fontSize: '10px', color: '#aaaaaa'
        }).setOrigin(0.5);

        bot = { sprite: circle, label: label, statusLabel: statusLabel };
        bots[data.bot_id] = bot;
    }

    // 2. Update Text
    bot.statusLabel.setText(data.status.replace('_', ' '));

    // 3. Movement Logic (Only move if target is different)
    const currentTargetX = bot.sprite.getData('targetX');
    const currentTargetY = bot.sprite.getData('targetY');

    if (currentTargetX !== targetX || currentTargetY !== targetY) {
        bot.sprite.setData('targetX', targetX);
        bot.sprite.setData('targetY', targetY);

        // Stop any existing tweens so they don't conflict
        this.tweens.killTweensOf(bot.sprite);

        // Walk to the new room
        this.tweens.add({
            targets: [bot.sprite, bot.label, bot.statusLabel],
            x: targetX,
            y: (target) => { // Adjust Y specifically for text labels so they stay above/below
                if (target === bot.label) return targetY - 25;
                if (target === bot.statusLabel) return targetY + 25;
                return targetY;
            },
            duration: 2000,
            ease: 'Linear'
        });
    }

    // 4. Working Animation (Pulse effect)
    if (data.status === 'working' || data.status === 'waiting_approval' || data.status === 'executing') {
        if (!bot.pulseTween) {
            bot.pulseTween = this.tweens.add({
                targets: bot.sprite,
                scale: 1.3,
                duration: 500,
                yoyo: true,
                repeat: -1
            });
        }
    } else {
        if (bot.pulseTween) {
            bot.pulseTween.stop();
            bot.pulseTween = null;
            bot.sprite.setScale(1);
        }
    }
}

// --- HUD / Approval Logic ---
function showApprovalCard(data) {
    const container = document.getElementById('approval-container');
    
    // Format the preview data nicely
    let previewText = "";
    if (data.preview) {
        previewText = JSON.stringify(data.preview, null, 2);
    }

    const card = document.createElement('div');
    card.className = 'approval-card';
    card.id = `card-${data.bot_id}`;
    card.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 5px; color: #4da6ff;">${data.bot_id}</div>
        <div style="margin-bottom: 10px;">${data.summary}</div>
        <pre style="background: #000; padding: 10px; border-radius: 4px; font-size: 10px; max-height: 150px; overflow-y: auto;">${previewText}</pre>
        <div style="display: flex; gap: 10px; margin-top: 10px;">
            <button onclick="sendApproval('${data.bot_id}', true)" style="flex: 1; background: #2ecc71; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer;">Approve</button>
            <button onclick="sendApproval('${data.bot_id}', false)" style="flex: 1; background: #e74c3c; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer;">Reject</button>
        </div>
    `;
    container.appendChild(card);
}

// --- Helper Functions ---
function sendApproval(botId, isApproved) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'APPROVE_ACTION',
            bot_id: botId,
            approved: isApproved
        }));
        
        // Remove the card from the UI
        const card = document.getElementById(`card-${botId}`);
        if (card) card.remove();
    }
}

function sendDispatch(botId) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'DISPATCH',
            bot_id: botId
        }));
    }
}
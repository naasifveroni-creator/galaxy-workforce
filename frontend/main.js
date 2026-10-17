function sendApproval(botId, isApproved, taskId) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ 
            type: isApproved ? 'APPROVE_ACTION' : 'REJECT_ACTION', 
            bot_id: botId, 
            task_id: taskId, 
            approved: isApproved 
        }));
        // ...
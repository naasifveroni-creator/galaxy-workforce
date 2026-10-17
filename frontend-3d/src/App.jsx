import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Box, Grid, Text, Html } from '@react-three/drei';
import useWebSocket from 'react-use-websocket';
import './App.css';

const WS_URL = "wss://orange-system-g4w4gq7r9gxxcw7q-8000.app.github.dev/ws";

const ROOM_COLORS = {
  bridge: '#1e293b',
  comms_array: '#451a1a',
  data_forge: '#0f3a4d',
  strategy_deck: '#1a3d1a',
  office: '#3b2b4d'
};

const BOT_COLORS = {
  email_bot: '#ff0000',
  data_bot: '#ffff00',
  excel_bot: '#0000ff',
  report_bot: '#00ff00'
};

const Room = ({ position, size, color, label }) => {
  return (
    <group position={position}>
      <Box args={size} position={[0, 0, 0]}>
        <meshStandardMaterial color={color} transparent opacity={0.8} />
      </Box>
      
      <Box args={[size[0], 0.1, size[2]]} position={[0, size[1]/2 + 0.1, 0]}>
        <meshBasicMaterial color="#00f0ff" wireframe />
      </Box>

      <Text position={[0, size[1]/2 + 1, 0]} color="#00f0ff" fontSize={0.8} font="https://fonts.gstatic.com/s/orbitron/v25/yMJRMIlzdpvBhQQL_Qq7dys.woff">
        {label.toUpperCase()}
      </Text>
    </group>
  );
};

const Bot = ({ position, color, name, status }) => {
  return (
    <group position={position}>
      <mesh>
        <capsuleGeometry args={[0.4, 0.8, 4, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
      
      <mesh position={[0, 0.3, 0.4]}>
        <boxGeometry args={[0.4, 0.2, 0.1]} />
        <meshStandardMaterial color="#87ceeb" />
      </mesh>

      <Html position={[0, 1.5, 0]} center>
        <div style={{ color: '#fff', fontFamily: 'Orbitron', fontSize: '12px', whiteSpace: 'nowrap', textShadow: '1px 1px 2px #000' }}>
          {name}
          <br />
          <span style={{ color: '#00f0ff', fontSize: '10px' }}>{status}</span>
        </div>
      </Html>
    </group>
  );
};

export default function App() {
  const [bots, setBots] = useState({});
  const [approvals, setApprovals] = useState([]);

  const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocket(WS_URL, {
    shouldReconnect: (closeEvent) => true,
  });

  useEffect(() => {
    if (lastJsonMessage) {
      const msg = lastJsonMessage;
      
      if (msg.type === 'SNAPSHOT') {
        const newBots = {};
        msg.bots.forEach(b => newBots[b.bot_id] = b);
        setBots(newBots);
        setApprovals(msg.approvals);
      } 
      else if (msg.type === 'BOT_STATUS') {
        setBots(prev => ({ ...prev, [msg.bot_id]: msg }));
      } 
      else if (msg.type === 'APPROVAL_REQUEST') {
        setApprovals(prev => [...prev, msg]);
      }
      else if (msg.type === 'APPROVAL_RESOLVED') {
        setApprovals(prev => prev.filter(a => a.task_id !== msg.task_id));
      }
    }
  }, [lastJsonMessage]);

  const dispatchBot = (botId) => {
    sendJsonMessage({ type: "START_TASK", bot_id: botId });
  };

  const resolveApproval = (taskId, isApproved) => {
    // THE FIX IS HERE ON THIS LINE
    sendJsonMessage({ 
      type: isApproved ? 'APPROVE_ACTION' : 'REJECT_ACTION', 
      task_id: taskId 
    });
  };

  return (
    <div className="app-container">
      
      <div className="canvas-container">
        <Canvas camera={{ position: [0, 15, 20], fov: 45 }}>
          <color attach="background" args={['#02040a']} />
          
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <pointLight position={[0, 5, 0]} intensity={2} color="#00f0ff" />

          <Grid 
            position={[0, -1, 0]} 
            args={[50, 50]} 
            cellSize={1} 
            cellThickness={0.5} 
            cellColor="#00f0ff" 
            sectionSize={5} 
            sectionThickness={1} 
            sectionColor="#00f0ff" 
            fadeDistance={30} 
            fadeStrength={1} 
          />

          <OrbitControls makeDefault />

          <Room position={[0, 0, 0]} size={[8, 1, 6]} color={ROOM_COLORS.bridge} label="Bridge (HQ)" />
          <Room position={[-8, 0, -8]} size={[5, 1, 5]} color={ROOM_COLORS.comms_array} label="Comms Array" />
          <Room position={[8, 0, -8]} size={[5, 1, 5]} color={ROOM_COLORS.data_forge} label="Data Forge" />
          <Room position={[-8, 0, 8]} size={[5, 1, 5]} color={ROOM_COLORS.strategy_deck} label="Strategy Deck" />
          <Room position={[8, 0, 8]} size={[5, 1, 5]} color={ROOM_COLORS.office} label="Commander's Office" />

          {Object.values(bots).map((bot) => {
            let x = 0, z = 0;
            if (bot.location === 'comms_array') { x = -8; z = -8; }
            if (bot.location === 'data_forge') { x = 8; z = -8; }
            if (bot.location === 'strategy_deck') { x = -8; z = 8; }
            if (bot.location === 'office') { x = 8; z = 8; }
            
            if (bot.bot_id === 'email_bot') x -= 1;
            if (bot.bot_id === 'data_bot') z -= 1;
            if (bot.bot_id === 'excel_bot') x += 1;
            if (bot.bot_id === 'report_bot') z += 1;

            return (
              <Bot 
                key={bot.bot_id}
                position={[x, 0.6, z]} 
                color={BOT_COLORS[bot.bot_id]} 
                name={bot.name} 
                status={bot.status}
              />
            );
          })}
        </Canvas>
      </div>

      <div className="hud-panel">
        <div className="profile-card">
          <div style={{ color: '#00f0ff', fontFamily: 'Orbitron' }}>⚔️ COMMANDER</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#fff' }}>LV.4</div>
          <div className="xp-bar-container"><div className="xp-bar"></div></div>
        </div>

        <div>
          <h4>Dispatch</h4>
          <div className="button-group">
            {['email_bot', 'data_bot', 'excel_bot', 'report_bot'].map(id => (
              <button key={id} onClick={() => dispatchBot(id)}>
                ▶ Run {id.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h4>Approvals</h4>
          {approvals.map((a) => (
            <div key={a.task_id} className="approval-card">
              <strong>{a.bot_id}</strong><br/>
              {a.summary}
              <div className="row">
                <button className="approve" onClick={() => resolveApproval(a.task_id, true)}>Approve</button>
                <button className="reject" onClick={() => resolveApproval(a.task_id, false)}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Box, Grid, Text, Html, Sphere, Cylinder, RoundedBox } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import './App.css';

const WS_URL = "wss://orange-system-g4w4gq7r9gxxcw7q-8000.app.github.dev/ws";

const ROOM_COLORS = {
  bridge: '#1e293b', comms_array: '#451a1a', data_forge: '#0f3a4d', strategy_deck: '#1a3d1a', office: '#3b2b4d'
};

const BOT_COLORS = {
  email_bot: '#ff0000', data_bot: '#ffff00', excel_bot: '#0000ff', report_bot: '#00ff00'
};

// --- 3D MACHINERY ---
const BridgeHologram = ({ position }) => {
  const ref = useRef();
  useFrame((state, delta) => (ref.current.rotation.y += delta));
  return (
    <group position={position}>
      <mesh ref={ref}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={2} wireframe />
      </mesh>
      <pointLight color="#00f0ff" intensity={2} distance={5} />
    </group>
  );
};

const DataForgeCore = ({ position }) => {
  const ref = useRef();
  useFrame((state, delta) => (ref.current.rotation.z += delta));
  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[0.5, 0.5, 1, 32]} />
        <meshStandardMaterial color="#4da6ff" emissive="#4da6ff" emissiveIntensity={0.5} transparent opacity={0.5} />
      </mesh>
      <mesh ref={ref}>
        <torusGeometry args={[1.2, 0.05, 16, 64]} />
        <meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={2} />
      </mesh>
    </group>
  );
};

// --- ROOM COMPONENT ---
const Room = ({ position, size, color, label, children }) => {
  return (
    <group position={position}>
      <Box args={[size[0], 0.5, size[2]]} position={[0, -0.25, 0]}>
        <meshStandardMaterial color={color} transparent opacity={0.9} />
      </Box>
      <Box args={[size[0], 0.1, size[2]]} position={[0, 0, 0]}>
        <meshBasicMaterial color="#00f0ff" wireframe />
      </Box>
      <Text position={[0, 1, size[2]/2 - 0.5]} color="#00f0ff" fontSize={0.4} font="https://fonts.gstatic.com/s/orbitron/v25/yMJRMIlzdpvBhQQL_Qq7dys.woff">
        {label.toUpperCase()}
      </Text>
      {children}
    </group>
  );
};

// --- REAL 3D AMONG US CHARACTER ---
const Crewmate3D = ({ color, name, status, isCommander }) => {
  return (
    <group>
      {/* Body (Capsule) */}
      <mesh castShadow>
        <capsuleGeometry args={[0.35, 0.5, 8, 16]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.1} />
      </mesh>
      
      {/* Backpack */}
      <RoundedBox args={[0.3, 0.4, 0.2]} position={[-0.35, 0, 0]} radius={0.05}>
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.1} />
      </RoundedBox>

      {/* Visor Frame */}
      <RoundedBox args={[0.45, 0.25, 0.2]} position={[0.15, 0.25, 0.25]} radius={0.1}>
        <meshStandardMaterial color="#cccccc" roughness={0.2} metalness={0.8} />
      </RoundedBox>
      
      {/* Glass Visor */}
      <RoundedBox args={[0.4, 0.2, 0.15]} position={[0.15, 0.25, 0.35]} radius={0.08}>
        <meshStandardMaterial color="#87ceeb" emissive="#87ceeb" emissiveIntensity={0.5} transparent opacity={0.8} roughness={0.1} metalness={0.9} />
      </RoundedBox>

      {/* Legs */}
      <mesh position={[-0.15, -0.5, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.2]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0.15, -0.5, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.2]} />
        <meshStandardMaterial color={color} />
      </mesh>

      {/* Glowing Halo underneath */}
      <mesh position={[0, -0.65, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.4, 0.5, 32]} />
        <meshBasicMaterial color={isCommander ? "#f1c40f" : color} transparent opacity={0.6} />
      </mesh>

      {/* Floating Text */}
      <Html position={[0, 1.2, 0]} center>
        <div style={{ 
          color: isCommander ? '#f1c40f' : '#fff', 
          fontFamily: 'Orbitron', fontSize: '10px', 
          whiteSpace: 'nowrap', textShadow: '1px 1px 3px #000', 
          textAlign: 'center', fontWeight: 'bold' 
        }}>
          {name}
          {status && <><br /><span style={{ color: '#00f0ff', fontSize: '9px' }}>{status}</span></>}
        </div>
      </Html>
    </group>
  );
};

// --- THE COMMANDER (3D Model with Movement) ---
const Commander = () => {
  const ref = useRef();
  const keys = useRef({});
  
  useEffect(() => {
    const down = (e) => keys.current[e.key.toLowerCase()] = true;
    const up = (e) => keys.current[e.key.toLowerCase()] = false;
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  useFrame((state, delta) => {
    if (!ref.current) return;
    const speed = 5 * delta;
    if (keys.current['w'] || keys.current['arrowup']) ref.current.position.z -= speed;
    if (keys.current['s'] || keys.current['arrowdown']) ref.current.position.z += speed;
    if (keys.current['a'] || keys.current['arrowleft']) ref.current.position.x -= speed;
    if (keys.current['d'] || keys.current['arrowright']) ref.current.position.x += speed;
  });

  return (
    <group ref={ref} position={[8, 0.6, 8]}>
      <Crewmate3D color="#f1c40f" name="COMMANDER" isCommander={true} />
      <pointLight color="#f1c40f" intensity={1} distance={3} position={[0, 0.5, 0]} />
    </group>
  );
};

// --- MAIN APP ---
export default function App() {
  const [bots, setBots] = useState({});
  const [approvals, setApprovals] = useState([]);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'SNAPSHOT') {
        const newBots = {};
        msg.bots.forEach(b => newBots[b.bot_id] = b);
        setBots(newBots);
        setApprovals(msg.approvals);
      } 
      else if (msg.type === 'BOT_STATUS') {
        setBots(prev => ({ ...prev, [msg.bot_id]: msg }));
      } 
      else if (msg.type === 'APPROVAL_REQUEST') setApprovals(prev => [...prev, msg]);
      else if (msg.type === 'APPROVAL_RESOLVED') setApprovals(prev => prev.filter(a => a.task_id !== msg.task_id));
    };
    setSocket(ws);
    return () => ws.close();
  }, []);

  const sendMessage = (obj) => {
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(obj));
  };

  return (
    <div className="app-container">
      <div className="canvas-container">
        <Suspense fallback={<div style={{color: 'white', position: 'absolute', top: '50%', left: '50%'}}>Loading Ship...</div>}>
          <Canvas camera={{ position: [0, 18, 22], fov: 40 }} shadows>
            <color attach="background" args={['#02040a']} />
            
            <ambientLight intensity={0.3} />
            {/* Shadow-casting light */}
            <directionalLight 
              position={[10, 20, 10]} 
              intensity={1} 
              castShadow 
              shadow-mapSize-width={2048} 
              shadow-mapSize-height={2048} 
            />
            
            <Grid 
              position={[0, -1, 0]} args={[50, 50]} cellSize={1} cellThickness={0.5} cellColor="#00f0ff" 
              sectionSize={5} sectionThickness={1} sectionColor="#00f0ff" fadeDistance={30} fadeStrength={1} 
            />

            <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.2} minDistance={10} maxDistance={40} />

            {/* ROOMS */}
            <Room position={[0, 0, 0]} size={[8, 1, 6]} color={ROOM_COLORS.bridge} label="Bridge (HQ)">
              <BridgeHologram position={[0, 1.5, 0]} />
            </Room>
            <Room position={[-8, 0, -8]} size={[5, 1, 5]} color={ROOM_COLORS.comms_array} label="Comms Array" />
            <Room position={[8, 0, -8]} size={[5, 1, 5]} color={ROOM_COLORS.data_forge} label="Data Forge">
              <DataForgeCore position={[0, 1.5, 0]} />
            </Room>
            <Room position={[-8, 0, 8]} size={[5, 1, 5]} color={ROOM_COLORS.strategy_deck} label="Strategy Deck" />
            <Room position={[8, 0, 8]} size={[5, 1, 5]} color={ROOM_COLORS.office} label="Commander's Office">
              <Commander />
            </Room>

            {/* BOTS */}
            {Object.values(bots).map((bot) => {
              let x = 0, z = 0;
              if (bot.location === 'comms_array') { x = -8; z = -8; }
              if (bot.location === 'data_forge') { x = 8; z = -8; }
              if (bot.location === 'strategy_deck') { x = -8; z = 8; }
              if (bot.location === 'office') { x = 8; z = 8; }
              
              if (bot.bot_id === 'email_bot') x -= 2;
              if (bot.bot_id === 'data_bot') z -= 2;
              if (bot.bot_id === 'excel_bot') x += 2;
              if (bot.bot_id === 'report_bot') z += 2;

              return (
                <group key={bot.bot_id} position={[x, 0.6, z]}>
                  <Crewmate3D 
                    color={BOT_COLORS[bot.bot_id]} 
                    name={bot.name} 
                    status={bot.status} 
                  />
                </group>
              );
            })}

            {/* THE MAGIC GLOW EFFECT */}
            <EffectComposer>
              <Bloom luminanceThreshold={0.5} mipmapBlur intensity={1.5} />
            </EffectComposer>
          </Canvas>
        </Suspense>
      </div>

      {/* HUD UI */}
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
              <button key={id} onClick={() => sendMessage({ type: "START_TASK", bot_id: id })}>
                ▶ Run {id.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h4>Approvals</h4>
          {approvals.map((a) => (
            <div key={a.task_id} className="approval-card">
              <strong>{a.bot_id}</strong><br/>{a.summary}
              <div className="row">
                <button className="approve" onClick={() => sendMessage({ type: 'APPROVE_ACTION', task_id: a.task_id })}>Approve</button>
                <button className="reject" onClick={() => sendMessage({ type: 'REJECT_ACTION', task_id: a.task_id })}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
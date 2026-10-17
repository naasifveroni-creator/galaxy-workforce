import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Box, Grid, Text, Html, RoundedBox } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import './App.css';

const WS_URL = "wss://orange-system-g4w4gq7r9gxxcw7q-8000.app.github.dev/ws";

const ROOM_COLORS = {
  bridge: '#1e293b', comms_array: '#451a1a', data_forge: '#0f3a4d', strategy_deck: '#1a3d1a', office: '#3b2b4d'
};

const BOT_COLORS = {
  email_bot: '#ff0000', data_bot: '#ffff00', excel_bot: '#0000ff', report_bot: '#00ff00'
};

const ROOM_POSITIONS = {
  bridge: { x: 0, z: 0, label: "Bridge (HQ)" },
  comms_array: { x: -8, z: -8, label: "Comms Array" },
  data_forge: { x: 8, z: -8, label: "Data Forge" },
  strategy_deck: { x: -8, z: 8, label: "Strategy Deck" },
  office: { x: 8, z: 8, label: "Commander's Office" }
};

// --- FLOATING PARTICLES ---
const DataParticles = () => {
  const pointsRef = useRef();
  const positions = React.useMemo(() => {
    const pos = new Float32Array(600);
    for (let i = 0; i < 600; i += 3) {
      pos[i] = (Math.random() - 0.5) * 40;     
      pos[i + 1] = Math.random() * 10;          
      pos[i + 2] = (Math.random() - 0.5) * 40; 
    }
    return pos;
  }, []);

  useFrame((state, delta) => {
    if (pointsRef.current) pointsRef.current.rotation.y += delta * 0.02;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={200} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.08} color="#00f0ff" transparent opacity={0.6} sizeAttenuation />
    </points>
  );
};

// --- 3D MACHINERY ---
const CommandTable = ({ position }) => {
  const ref = useRef();
  useFrame((state, delta) => (ref.current.rotation.y += delta * 0.5));
  return (
    <group position={position}>
      <RoundedBox args={[2.5, 0.2, 1.5]} position={[0, -0.4, 0]} radius={0.1}>
        <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.2} />
      </RoundedBox>
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 0.1, 32]} />
        <meshStandardMaterial color="#1e293b" metalness={0.5} />
      </mesh>
      <mesh ref={ref} position={[0, 0.4, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={2} wireframe transparent opacity={0.8} />
      </mesh>
      <pointLight color="#00f0ff" intensity={3} distance={6} position={[0, 0.5, 0]} />
    </group>
  );
};

const DataForgeCore = ({ position }) => {
  const ref = useRef();
  useFrame((state, delta) => (ref.current.rotation.z += delta));
  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[0.5, 0.5, 1.5, 32]} />
        <meshStandardMaterial color="#4da6ff" emissive="#4da6ff" emissiveIntensity={0.5} transparent opacity={0.4} />
      </mesh>
      <mesh ref={ref}>
        <torusGeometry args={[1.4, 0.05, 16, 64]} />
        <meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={2} />
      </mesh>
      <pointLight color="#00f0ff" intensity={2} distance={6} />
    </group>
  );
};

// --- ROOM COMPONENT ---
const Room = ({ position, size, color, label, children }) => {
  const [width, , depth] = size;
  const wallHeight = 0.8;
  const wallThick = 0.1;

  return (
    <group position={position}>
      <Box args={[width, 0.5, depth]} position={[0, -0.25, 0]}>
        <meshStandardMaterial color={color} transparent opacity={0.9} />
      </Box>
      
      <Box args={[width, 0.1, depth]} position={[0, 0, 0]}>
        <meshBasicMaterial color="#00f0ff" wireframe />
      </Box>

      <mesh position={[0, wallHeight/2, -depth/2 + wallThick]}>
        <boxGeometry args={[width, wallHeight, wallThick]} />
        <meshBasicMaterial color="#00f0ff" transparent opacity={0.3} />
      </mesh>
      <mesh position={[-width/2 + wallThick, wallHeight/2, 0]}>
        <boxGeometry args={[wallThick, wallHeight, depth]} />
        <meshBasicMaterial color="#00f0ff" transparent opacity={0.2} />
      </mesh>
      <mesh position={[width/2 - wallThick, wallHeight/2, 0]}>
        <boxGeometry args={[wallThick, wallHeight, depth]} />
        <meshBasicMaterial color="#00f0ff" transparent opacity={0.2} />
      </mesh>
      
      <Text position={[0, 0.6, depth/2 - 0.5]} color="#00f0ff" fontSize={0.3} font="https://fonts.gstatic.com/s/orbitron/v25/yMJRMIlzdpvBhQQL_Qq7dys.woff">
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
      <mesh castShadow>
        <capsuleGeometry args={[0.35, 0.5, 8, 16]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.2} />
      </mesh>
      <RoundedBox args={[0.3, 0.4, 0.2]} position={[-0.35, 0, 0]} radius={0.05}>
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.2} />
      </RoundedBox>
      <RoundedBox args={[0.45, 0.25, 0.2]} position={[0.15, 0.25, 0.25]} radius={0.1}>
        <meshStandardMaterial color="#888" roughness={0.2} metalness={0.9} />
      </RoundedBox>
      <RoundedBox args={[0.4, 0.2, 0.15]} position={[0.15, 0.25, 0.35]} radius={0.08}>
        <meshStandardMaterial color="#87ceeb" emissive="#87ceeb" emissiveIntensity={0.8} transparent opacity={0.9} roughness={0.1} metalness={0.8} />
      </RoundedBox>
      <mesh position={[-0.15, -0.5, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.2]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0.15, -0.5, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.2]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, -0.65, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.4, 0.5, 32]} />
        <meshBasicMaterial color={isCommander ? "#f1c40f" : color} transparent opacity={0.8} />
      </mesh>
      <Html position={[0, 1.2, 0]} center>
        <div style={{ color: isCommander ? '#f1c40f' : '#fff', fontFamily: 'Orbitron', fontSize: '10px', whiteSpace: 'nowrap', textShadow: '1px 1px 3px #000', textAlign: 'center', fontWeight: 'bold' }}>
          {name}
          {status && <><br /><span style={{ color: '#00f0ff', fontSize: '9px' }}>{status}</span></>}
        </div>
      </Html>
    </group>
  );
};

// --- THE COMMANDER ---
const Commander = ({ activeRoom, setActiveRoom, isPaused }) => {
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
    if (!ref.current || isPaused) return;
    const speed = 5 * delta;
    if (keys.current['w'] || keys.current['arrowup']) ref.current.position.z -= speed;
    if (keys.current['s'] || keys.current['arrowdown']) ref.current.position.z += speed;
    if (keys.current['a'] || keys.current['arrowleft']) ref.current.position.x -= speed;
    if (keys.current['d'] || keys.current['arrowright']) ref.current.position.x += speed;

    let closestRoom = null;
    let minDist = 4;

    Object.entries(ROOM_POSITIONS).forEach(([id, pos]) => {
      const dx = ref.current.position.x - pos.x;
      const dz = ref.current.position.z - pos.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      if (dist < minDist) {
        minDist = dist;
        closestRoom = id;
      }
    });

    if (closestRoom !== activeRoom) setActiveRoom(closestRoom);
  });

  return (
    <group ref={ref} position={[8, 0.6, 8]}>
      <Crewmate3D color="#f1c40f" name="COMMANDER" isCommander={true} />
      <pointLight color="#f1c40f" intensity={2} distance={4} position={[0, 0.5, 0]} />
    </group>
  );
};

// --- MAIN APP ---
export default function App() {
  const [bots, setBots] = useState({});
  const [approvals, setApprovals] = useState([]);
  const [socket, setSocket] = useState(null);
  
  const [activeRoom, setActiveRoom] = useState(null);
  const [openRoom, setOpenRoom] = useState(null);

  // Handle Keyboard E Press globally
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key.toLowerCase() === 'e' && activeRoom && !openRoom) {
        setOpenRoom(activeRoom);
      }
      if (e.key === 'Escape') {
        setOpenRoom(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeRoom, openRoom]);

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
            <directionalLight position={[10, 20, 10]} intensity={1} castShadow shadow-mapSize={[2048, 2048]} />
            
            <Grid 
              position={[0, -1, 0]} args={[50, 50]} cellSize={1} cellThickness={0.5} cellColor="#00f0ff" 
              sectionSize={5} sectionThickness={1} sectionColor="#00f0ff" fadeDistance={30} fadeStrength={1} 
            />

            <DataParticles />
            <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.2} minDistance={10} maxDistance={40} />

            {/* DYNAMIC TOOLTIPS (Hidden when modal is open) */}
            {!openRoom && Object.entries(ROOM_POSITIONS).map(([id, room]) => (
              <Html key={id} position={[room.x, 3.5, room.z]} center>
                <div style={{ 
                  background: activeRoom === id ? 'rgba(46, 204, 113, 0.9)' : 'rgba(0, 0, 0, 0.8)', 
                  border: activeRoom === id ? '1px solid #fff' : '1px solid #555', 
                  padding: '4px 8px', borderRadius: '4px', 
                  color: '#fff', fontFamily: 'Orbitron', fontSize: '10px', 
                  whiteSpace: 'nowrap', boxShadow: activeRoom === id ? '0 0 15px #2ecc71' : 'none',
                  transition: 'all 0.2s',
                  cursor: activeRoom === id ? 'pointer' : 'default'
                }} onClick={() => { if(activeRoom === id) setOpenRoom(id); }}>
                  {activeRoom === id ? `PRESS [E] - ${room.label.toUpperCase()}` : room.label.toUpperCase()}
                </div>
              </Html>
            ))}

            {/* ROOMS */}
            <Room position={[0, 0, 0]} size={[8, 1, 6]} color={ROOM_COLORS.bridge} label="Bridge (HQ)">
              <CommandTable position={[0, 0, 0]} />
            </Room>
            <Room position={[-8, 0, -8]} size={[5, 1, 5]} color={ROOM_COLORS.comms_array} label="Comms Array" />
            <Room position={[8, 0, -8]} size={[5, 1, 5]} color={ROOM_COLORS.data_forge} label="Data Forge">
              <DataForgeCore position={[0, 1, 0]} />
            </Room>
            <Room position={[-8, 0, 8]} size={[5, 1, 5]} color={ROOM_COLORS.strategy_deck} label="Strategy Deck" />
            <Room position={[8, 0, 8]} size={[5, 1, 5]} color={ROOM_COLORS.office} label="Commander's Office">
              <Commander activeRoom={activeRoom} setActiveRoom={setActiveRoom} isPaused={!!openRoom} />
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
                  <Crewmate3D color={BOT_COLORS[bot.bot_id]} name={bot.name} status={bot.status} />
                </group>
              );
            })}

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

      {/* --- ROOM INTERACTION MODAL --- */}
      {openRoom && (
        <div className="room-modal-overlay" onClick={() => setOpenRoom(null)}>
          <div className="room-modal" onClick={e => e.stopPropagation()}>
            <h2>{ROOM_POSITIONS[openRoom].label}</h2>
            <p>Terminal Access Granted. Welcome, Commander.</p>
            
            <div className="terminal-data">
              {openRoom === 'data_forge' && <p>Analyzing CSV... 200 rows processed.</p>}
              {openRoom === 'comms_array' && <p>Inbox: 4 unread messages.</p>}
              {openRoom === 'strategy_deck' && <p>Active reports: 2.</p>}
              {openRoom === 'bridge' && <p>Ship status: All systems nominal.</p>}
              {openRoom === 'office' && <p>Commander's personal logs.</p>}
            </div>
            
            <button className="close-btn" onClick={() => setOpenRoom(null)}>CLOSE TERMINAL [ESC]</button>
          </div>
        </div>
      )}
    </div>
  );
}
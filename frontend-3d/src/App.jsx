import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Box, Text, Html, RoundedBox, Sphere } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import './App.css';

const WS_URL = "wss://orange-system-g4w4gq7r9gxxcw7q-8000.app.github.dev/ws";

const ROOM_COLORS = {
  bridge: '#1e293b', comms_array: '#451a1a', data_forge: '#0f3a4d', strategy_deck: '#1a3d1a', office: '#3b2b4d', hangar_bay: '#2c3e50', medbay: '#4a235a', presentation_suite: '#7d3c98'
};

const BOT_COLORS = {
  data_bot: '#ffff00', 
  excel_bot: '#0000ff', 
  report_bot: '#00ff00',
  ppt_bot: '#f39c12' 
};

const ROOM_POSITIONS = {
  bridge: { x: 0, z: 0, label: "Bridge (HQ)" },
  comms_array: { x: -8, z: -8, label: "Comms Array" },
  data_forge: { x: 8, z: -8, label: "Data Forge" },
  strategy_deck: { x: -8, z: 8, label: "Strategy Deck" },
  office: { x: 8, z: 8, label: "Commander's Office" },
  hangar_bay: { x: 0, z: -14, label: "Hangar Bay" },
  medbay: { x: 0, z: 14, label: "MedBay" },
  presentation_suite: { x: -14, z: 0, label: "Presentation Suite" }
};

// --- SPACE ECOSYSTEM ---
const WarpStars = () => {
  const pointsRef = useRef();
  const positions = React.useMemo(() => {
    const pos = new Float32Array(3000);
    for (let i = 0; i < 3000; i += 3) {
      pos[i] = (Math.random() - 0.5) * 200;     
      pos[i + 1] = (Math.random() - 0.5) * 200;          
      pos[i + 2] = (Math.random() - 0.5) * 200; 
    }
    return pos;
  }, []);

  useFrame((state, delta) => {
    if (pointsRef.current) {
      pointsRef.current.position.z += delta * 2;
      if (pointsRef.current.position.z > 100) pointsRef.current.position.z = -100;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={1000} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.2} color="#ffffff" transparent opacity={0.6} sizeAttenuation />
    </points>
  );
};

const BackgroundPlanet = () => {
  const planetRef = useRef();
  useFrame((state, delta) => {
    if (planetRef.current) planetRef.current.rotation.y += delta * 0.02;
  });

  return (
    <group position={[-40, -10, -60]}>
      <mesh ref={planetRef}>
        <sphereGeometry args={[25, 64, 64]} />
        <meshStandardMaterial color="#1e3a8a" emissive="#0f172a" roughness={0.8} />
      </mesh>
      <mesh>
        <sphereGeometry args={[25.5, 64, 64]} />
        <meshBasicMaterial color="#00f0ff" transparent opacity={0.1} side={THREE.BackSide} />
      </mesh>
      <pointLight color="#00f0ff" intensity={5} distance={100} />
    </group>
  );
};

const EngineThrusters = () => {
  return (
    <group position={[0, -0.5, -20]}>
      {[-3, 0, 3].map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.5, 0.8, 4]} />
            <meshBasicMaterial color="#00f0ff" transparent opacity={0.6} />
          </mesh>
          <pointLight color="#00f0ff" intensity={5} distance={10} position={[0, 0, -2]} />
        </group>
      ))}
    </group>
  );
};

const ShipHull = () => {
  return (
    <group position={[0, -0.8, 0]}>
      <Box args={[34, 0.5, 40]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#0a0f1a" metalness={0.9} roughness={0.4} />
      </Box>
      <Box args={[34.2, 0.1, 40.2]} position={[0, 0, 0]}>
        <meshBasicMaterial color="#334155" wireframe />
      </Box>
      
      <Box args={[2, 0.1, 8]} position={[-4, 0.3, -4]} rotation={[0, Math.PI/4, 0]}><meshStandardMaterial color="#00f0ff" transparent opacity={0.2} /></Box>
      <Box args={[2, 0.1, 8]} position={[4, 0.3, -4]} rotation={[0, -Math.PI/4, 0]}><meshStandardMaterial color="#00f0ff" transparent opacity={0.2} /></Box>
      <Box args={[2, 0.1, 8]} position={[-4, 0.3, 4]} rotation={[0, -Math.PI/4, 0]}><meshStandardMaterial color="#00f0ff" transparent opacity={0.2} /></Box>
      <Box args={[2, 0.1, 8]} position={[4, 0.3, 4]} rotation={[0, Math.PI/4, 0]}><meshStandardMaterial color="#00f0ff" transparent opacity={0.2} /></Box>
      <Box args={[2, 0.1, 10]} position={[0, 0.3, -7]}><meshStandardMaterial color="#00f0ff" transparent opacity={0.2} /></Box>
      <Box args={[2, 0.1, 10]} position={[0, 0.3, 7]}><meshStandardMaterial color="#00f0ff" transparent opacity={0.2} /></Box>
      <Box args={[8, 0.1, 2]} position={[-7, 0.3, 0]}><meshStandardMaterial color="#00f0ff" transparent opacity={0.2} /></Box>
    </group>
  );
};

// --- UI & MACHINERY ---
const FloatingStatBar = ({ position, label, color, width = 1.5 }) => {
  const fillRef = useRef();
  useFrame((state) => {
    if (fillRef.current) {
      const scale = 0.5 + Math.sin(state.clock.elapsedTime * 2) * 0.3 + Math.random() * 0.1;
      fillRef.current.scale.x = scale;
      fillRef.current.position.x = -(width / 2) + (width * scale) / 2;
    }
  });

  return (
    <group position={position}>
      <Html center position={[0, 0.3, 0]}>
        <div style={{ color: color, fontFamily: 'Orbitron', fontSize: '8px', whiteSpace: 'nowrap', textShadow: '1px 1px 2px #000', fontWeight: 'bold' }}>{label}</div>
      </Html>
      <mesh position={[0, 0, 0]}><planeGeometry args={[width, 0.1]} /><meshBasicMaterial color="#111" transparent opacity={0.8} /></mesh>
      <mesh ref={fillRef} position={[0, 0, 0.01]}><planeGeometry args={[width, 0.1]} /><meshBasicMaterial color={color} /></mesh>
    </group>
  );
};

const SecurityCamera = ({ position }) => {
  const cameraRef = useRef();
  useFrame((state) => {
    if (cameraRef.current) cameraRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 2) * 0.5;
  });
  return (
    <group position={position}>
      <mesh ref={cameraRef}>
        <boxGeometry args={[0.4, 0.2, 0.3]} />
        <meshStandardMaterial color="#333" metalness={0.9} roughness={0.1} />
        <mesh position={[0, 0, 0.2]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.1, 0.1, 0.1]} /><meshBasicMaterial color="#ff0000" /></mesh>
      </mesh>
      <mesh position={[0, 0.15, 0]}><sphereGeometry args={[0.03]} /><meshBasicMaterial color="#ff0000" /></mesh>
      <pointLight color="#ff0000" intensity={1} distance={2} position={[0, 0.15, 0]} />
    </group>
  );
};

const CommandTable = ({ position }) => {
  const ref = useRef();
  useFrame((state, delta) => (ref.current.rotation.y += delta * 0.5));
  return (
    <group position={position}>
      <RoundedBox args={[2.5, 0.2, 1.5]} position={[0, -0.4, 0]} radius={0.1}><meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.2} /></RoundedBox>
      <mesh position={[0, -0.2, 0]}><cylinderGeometry args={[0.6, 0.6, 0.1, 32]} /><meshStandardMaterial color="#1e293b" metalness={0.5} /></mesh>
      <mesh ref={ref} position={[0, 0.4, 0]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={2} wireframe transparent opacity={0.8} /></mesh>
      <pointLight color="#00f0ff" intensity={3} distance={6} position={[0, 0.5, 0]} />
      <SecurityCamera position={[3.5, 1.5, -2.5]} />
      <FloatingStatBar position={[0, 1.8, 0]} label="SHIP POWER" color="#00f0ff" width={2.5} />
    </group>
  );
};

const DataForgeCore = ({ position }) => {
  const ref = useRef();
  const dataRings = useRef();
  useFrame((state, delta) => {
    ref.current.rotation.z += delta;
    dataRings.current.rotation.x += delta * 0.5;
    dataRings.current.rotation.y += delta * 0.3;
  });
  return (
    <group position={position}>
      <mesh><cylinderGeometry args={[0.5, 0.5, 1.5, 32]} /><meshStandardMaterial color="#4da6ff" emissive="#4da6ff" emissiveIntensity={0.5} transparent opacity={0.4} /></mesh>
      <mesh ref={ref}><torusGeometry args={[1.4, 0.05, 16, 64]} /><meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={2} /></mesh>
      <mesh ref={dataRings}><torusGeometry args={[1.0, 0.02, 16, 64]} /><meshStandardMaterial color="#87ceeb" emissive="#87ceeb" emissiveIntensity={1.5} /></mesh>
      <mesh position={[0, -0.8, 0]}><cylinderGeometry args={[1.6, 1.8, 0.2, 8]} /><meshStandardMaterial color="#051420" metalness={0.9} /></mesh>
      <pointLight color="#00f0ff" intensity={2} distance={6} />
      <SecurityCamera position={[2, 1.5, -2]} />
      <FloatingStatBar position={[0, 2.2, 0]} label="DATA STREAM" color="#00f0ff" />
    </group>
  );
};

const CommsMachinery = ({ position }) => {
  const dishRef = useRef();
  useFrame((state, delta) => (dishRef.current.rotation.y += delta * 0.2));
  return (
    <group position={position}>
      {[-1.5, 0, 1.5].map((x, i) => (
        <group key={i} position={[x, 0.5, -1]}>
          <RoundedBox args={[0.8, 1.5, 0.6]} radius={0.05}><meshStandardMaterial color="#111" metalness={0.8} /></RoundedBox>
          {[-0.4, 0, 0.4].map((y, j) => (
            <mesh key={j} position={[0, y, 0.31]}><sphereGeometry args={[0.05, 8, 8]} /><meshBasicMaterial color={j % 2 === 0 ? "#ff0000" : "#00ff00"} /></mesh>
          ))}
        </group>
      ))}
      <group position={[0, 1.5, 1]} ref={dishRef}>
        <mesh rotation={[Math.PI / 4, 0, 0]}><sphereGeometry args={[0.8, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#888" side={2} metalness={0.9} roughness={0.1} /></mesh>
        <mesh position={[0, -0.5, 0]}><cylinderGeometry args={[0.1, 0.1, 1]} /><meshStandardMaterial color="#555" /></mesh>
      </group>
      <pointLight color="#ff0000" intensity={2} distance={5} position={[0, 1, -1]} />
      <SecurityCamera position={[2, 1.5, -2]} />
      <FloatingStatBar position={[-1, 2.2, 0]} label="SIGNAL" color="#ff4d4d" width={1.2} />
    </group>
  );
};

const StrategyMachinery = ({ position }) => {
  const chartRef = useRef();
  useFrame((state, delta) => (chartRef.current.rotation.y += delta * 0.5));
  return (
    <group position={position}>
      <RoundedBox args={[3, 0.2, 2]} position={[0, 0, 0]} radius={0.1}><meshStandardMaterial color="#0f2410" metalness={0.8} roughness={0.2} /></RoundedBox>
      <mesh position={[0, 0.15, 0]}><cylinderGeometry args={[0.8, 0.8, 0.1, 32]} /><meshStandardMaterial color="#2ecc71" emissive="#2ecc71" emissiveIntensity={1} /></mesh>
      <group ref={chartRef} position={[0, 1, 0]}>
        <Box args={[0.3, 0.6, 0.3]} position={[-0.5, 0.3, 0]}><meshStandardMaterial color="#2ecc71" emissive="#2ecc71" emissiveIntensity={2} transparent opacity={0.8} /></Box>
        <Box args={[0.3, 1, 0.3]} position={[0, 0.5, 0]}><meshStandardMaterial color="#2ecc71" emissive="#2ecc71" emissiveIntensity={2} transparent opacity={0.8} /></Box>
        <Box args={[0.3, 1.4, 0.3]} position={[0.5, 0.7, 0]}><meshStandardMaterial color="#2ecc71" emissive="#2ecc71" emissiveIntensity={2} transparent opacity={0.8} /></Box>
      </group>
      <pointLight color="#2ecc71" intensity={3} distance={6} position={[0, 1.5, 0]} />
      <SecurityCamera position={[2, 1.5, -2]} />
      <FloatingStatBar position={[0, 2.5, 0]} label="REVENUE" color="#2ecc71" width={2} />
    </group>
  );
};

const PresentationMachinery = ({ position }) => {
  const screenRef = useRef();
  useFrame((state) => {
    if (screenRef.current) screenRef.current.material.opacity = 0.5 + Math.sin(state.clock.elapsedTime * 2) * 0.2;
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.4, 1]}>
        <cylinderGeometry args={[0.3, 0.4, 0.8]} />
        <meshStandardMaterial color="#333" metalness={0.8} />
      </mesh>
      <mesh ref={screenRef} position={[0, 1.5, -1.5]}>
        <boxGeometry args={[3.5, 2, 0.1]} />
        <meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={1.5} transparent opacity={0.6} />
      </mesh>
      <group position={[0, 1.2, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.4, 0.4, 0.1, 16]} /><meshStandardMaterial color="#f39c12" emissive="#f39c12" emissiveIntensity={2} /></mesh>
      </group>
      <pointLight color="#f39c12" intensity={2} distance={5} position={[0, 1, 0]} />
      <SecurityCamera position={[2, 1.5, -2]} />
      <FloatingStatBar position={[0, 2.5, 0]} label="SLIDE DECK" color="#f39c12" width={2} />
    </group>
  );
};

const OfficeMachinery = ({ position }) => {
  return (
    <group position={position}>
      <RoundedBox args={[2, 0.2, 1]} position={[0, 0, 0]} radius={0.05}><meshStandardMaterial color="#2c1e38" metalness={0.6} roughness={0.4} /></RoundedBox>
      <mesh position={[0, 0.2, 0]}><boxGeometry args={[0.6, 0.4, 0.1]} /><meshStandardMaterial color="#9b59b6" emissive="#9b59b6" emissiveIntensity={1.5} /></mesh>
      <pointLight color="#9b59b6" intensity={2} distance={4} position={[0, 0.5, 0]} />
      <SecurityCamera position={[2, 1.5, -2]} />
    </group>
  );
};

const HangarMachinery = ({ position }) => {
  const shipRef = useRef();
  useFrame((state) => { if (shipRef.current) shipRef.current.position.y = 0.5 + Math.sin(state.clock.elapsedTime * 2) * 0.2; });
  return (
    <group position={position}>
      <mesh position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.5, 1.8, 32]} /><meshBasicMaterial color="#00f0ff" transparent opacity={0.5} side={THREE.DoubleSide} /></mesh>
      <group ref={shipRef} position={[0, 0.5, 0]}>
        <mesh><coneGeometry args={[0.6, 2, 4]} rotation={[Math.PI/2, 0, 0]} /><meshStandardMaterial color="#555" metalness={0.9} roughness={0.2} /></mesh>
        <mesh position={[0, 0, -0.8]} rotation={[Math.PI/2, 0, 0]}><cylinderGeometry args={[0.3, 0.3, 0.5]} /><meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={2} /></mesh>
      </group>
      <pointLight color="#00f0ff" intensity={2} distance={5} position={[0, 1, 0]} />
      <SecurityCamera position={[2.5, 1.5, -2]} />
      <FloatingStatBar position={[0, 2.5, 0]} label="HANGAR STATUS" color="#00f0ff" width={2} />
    </group>
  );
};

const MedbayMachinery = ({ position }) => {
  const scanRef = useRef();
  useFrame((state) => {
    if (scanRef.current) {
      scanRef.current.rotation.y += 0.02;
      scanRef.current.position.y = 0.5 + Math.sin(state.clock.elapsedTime * 3) * 0.1;
    }
  });
  return (
    <group position={position}>
      <RoundedBox args={[1.5, 0.2, 1]} position={[0, 0, 0]} radius={0.1}><meshStandardMaterial color="#ecf0f1" metalness={0.5} roughness={0.5} /></RoundedBox>
      <group ref={scanRef} position={[0, 0.5, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.6, 0.7, 32]} /><meshBasicMaterial color="#e74c3c" transparent opacity={0.8} side={THREE.DoubleSide} /></mesh>
        <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.05, 0.05, 1]} /><meshBasicMaterial color="#e74c3c" /></mesh>
      </group>
      <pointLight color="#e74c3c" intensity={2} distance={4} position={[0, 1, 0]} />
      <SecurityCamera position={[2.5, 1.5, -2]} />
      <FloatingStatBar position={[0, 2.5, 0]} label="MEDICAL BAY" color="#e74c3c" width={2} />
    </group>
  );
};

const Room = ({ position, size, color, label, children }) => {
  const [width, , depth] = size;
  const wallHeight = 0.8;
  const wallThick = 0.1;
  return (
    <group position={position}>
      <Box args={[width, 0.5, depth]} position={[0, -0.25, 0]}><meshStandardMaterial color={color} transparent opacity={0.9} /></Box>
      <Box args={[width, 0.1, depth]} position={[0, 0, 0]}><meshBasicMaterial color="#00f0ff" wireframe /></Box>
      <mesh position={[0, wallHeight/2, -depth/2 + wallThick]}><boxGeometry args={[width, wallHeight, wallThick]} /><meshBasicMaterial color="#00f0ff" transparent opacity={0.3} /></mesh>
      <mesh position={[-width/2 + wallThick, wallHeight/2, 0]}><boxGeometry args={[wallThick, wallHeight, depth]} /><meshBasicMaterial color="#00f0ff" transparent opacity={0.2} /></mesh>
      <mesh position={[width/2 - wallThick, wallHeight/2, 0]}><boxGeometry args={[wallThick, wallHeight, depth]} /><meshBasicMaterial color="#00f0ff" transparent opacity={0.2} /></mesh>
      <Text position={[-width/2 + 0.2, 0.1, -depth/2 + 0.3]} rotation={[-Math.PI / 2, 0, 0]} color="#00f0ff" fontSize={0.3} font="https://fonts.gstatic.com/s/orbitron/v25/yMJRMIlzdpvBhQQL_Qq7dys.woff">{label.toUpperCase()}</Text>
      {children}
    </group>
  );
};

const Crewmate3D = ({ color, name, status, isCommander, refs }) => {
  return (
    <group>
      <mesh ref={refs?.body} castShadow><capsuleGeometry args={[0.35, 0.5, 8, 16]} /><meshStandardMaterial color={color} roughness={0.4} metalness={0.2} /></mesh>
      <RoundedBox args={[0.3, 0.4, 0.2]} position={[-0.35, 0, 0]} radius={0.05}><meshStandardMaterial color={color} roughness={0.4} metalness={0.2} /></RoundedBox>
      <RoundedBox args={[0.45, 0.25, 0.2]} position={[0.15, 0.25, 0.25]} radius={0.1}><meshStandardMaterial color="#888" roughness={0.2} metalness={0.9} /></RoundedBox>
      <RoundedBox args={[0.4, 0.2, 0.15]} position={[0.15, 0.25, 0.35]} radius={0.08}><meshStandardMaterial color="#87ceeb" emissive="#87ceeb" emissiveIntensity={0.8} transparent opacity={0.9} roughness={0.1} metalness={0.8} /></RoundedBox>
      <mesh ref={refs?.leftLeg} position={[-0.15, -0.5, 0]}><cylinderGeometry args={[0.1, 0.1, 0.3]} /><meshStandardMaterial color={color} /></mesh>
      <mesh ref={refs?.rightLeg} position={[0.15, -0.5, 0]}><cylinderGeometry args={[0.1, 0.1, 0.3]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[0, -0.65, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.4, 0.5, 32]} /><meshBasicMaterial color={isCommander ? "#f1c40f" : color} transparent opacity={0.8} /></mesh>
      <Html position={[0, 1.2, 0]} center>
        <div style={{ color: isCommander ? '#f1c40f' : '#fff', fontFamily: 'Orbitron', fontSize: '10px', whiteSpace: 'nowrap', textShadow: '1px 1px 3px #000', textAlign: 'center', fontWeight: 'bold' }}>
          {name}{status && <><br /><span style={{ color: '#00f0ff', fontSize: '9px' }}>{status}</span></>}
        </div>
      </Html>
    </group>
  );
};

const MovingBot = ({ bot }) => {
  const groupRef = useRef();
  const leftLegRef = useRef();
  const rightLegRef = useRef();
  const bodyRef = useRef();
  
  const getTargetPos = (loc, id) => {
    let x = 0, z = 0;
    if (loc === 'comms_array') { x = -8; z = -8; }
    if (loc === 'data_forge') { x = 8; z = -8; }
    if (loc === 'strategy_deck') { x = -8; z = 8; }
    if (loc === 'office') { x = 8; z = 8; }
    if (loc === 'hangar_bay') { x = 0; z = -14; }
    if (loc === 'medbay') { x = 0; z = 14; }
    if (loc === 'presentation_suite') { x = -14; z = 0; }
    
    if (id === 'data_bot') { x -= 2; z -= 2; }
    if (id === 'excel_bot') { x += 2; z -= 2; }
    if (id === 'report_bot') { x -= 2; z += 2; }
    if (id === 'ppt_bot') { x += 2; z += 2; }
    
    return new THREE.Vector3(x, 0.6, z);
  };
  
  const targetPos = useRef(getTargetPos(bot.location, bot.bot_id));
  const walkTime = useRef(0);
  const isWalking = useRef(false);
  
  useEffect(() => {
    const newTarget = getTargetPos(bot.location, bot.bot_id);
    if (!newTarget.equals(targetPos.current)) { targetPos.current = newTarget; isWalking.current = true; }
  }, [bot.location, bot.bot_id]);
  
  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const distance = groupRef.current.position.distanceTo(targetPos.current);
    if (distance > 0.05) {
      groupRef.current.position.lerp(targetPos.current, 3 * delta);
      const angle = Math.atan2(targetPos.current.x - groupRef.current.position.x, targetPos.current.z - groupRef.current.position.z);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, angle, 8 * delta);
      walkTime.current += delta * 12;
      const swing = Math.sin(walkTime.current) * 0.4;
      if (leftLegRef.current && rightLegRef.current && bodyRef.current) {
        leftLegRef.current.rotation.x = swing;
        rightLegRef.current.rotation.x = -swing;
        bodyRef.current.position.y = Math.abs(Math.sin(walkTime.current)) * 0.05;
      }
    } else {
      groupRef.current.position.copy(targetPos.current);
      if (isWalking.current) {
        isWalking.current = false;
        if (leftLegRef.current && rightLegRef.current && bodyRef.current) {
          leftLegRef.current.rotation.x = 0;
          rightLegRef.current.rotation.x = 0;
          bodyRef.current.position.y = 0;
        }
      }
    }
  });
  
  return (
    <group ref={groupRef} position={getTargetPos(bot.location, bot.bot_id)}>
      <Crewmate3D color={BOT_COLORS[bot.bot_id]} name={bot.name} status={bot.status} refs={{ leftLeg: leftLegRef, rightLeg: rightLegRef, body: bodyRef }} />
    </group>
  );
};

const CombatDrone = ({ position, commanderPos, bots }) => {
  const droneRef = useRef();
  const barrelRef = useRef();
  const laserRef = useRef();
  const [isFiring, setIsFiring] = useState(false);
  
  useFrame((state, delta) => {
    if (!droneRef.current) return;

    const time = state.clock.elapsedTime;
    const orbitRadius = 2.5;
    const targetX = commanderPos.x + Math.cos(time * 1.5 + position[0]) * orbitRadius;
    const targetZ = commanderPos.z + Math.sin(time * 1.5 + position[2]) * orbitRadius;
    
    droneRef.current.position.lerp(new THREE.Vector3(targetX, 1.2 + Math.sin(time * 3) * 0.2, targetZ), 3 * delta);

    let closestBot = null;
    let minDist = 5;

    bots.forEach(bot => {
      let bx = 0, bz = 0;
      if (bot.location === 'comms_array') { bx = -8; bz = -8; }
      if (bot.location === 'data_forge') { bx = 8; bz = -8; }
      if (bot.location === 'strategy_deck') { bx = -8; bz = 8; }
      if (bot.location === 'office') { bx = 8; bz = 8; }
      if (bot.location === 'hangar_bay') { bx = 0; bz = -14; }
      if (bot.location === 'medbay') { bx = 0; bz = 14; }
      if (bot.location === 'presentation_suite') { bx = -14; bz = 0; }

      const dx = droneRef.current.position.x - bx;
      const dz = droneRef.current.position.z - bz;
      const dist = Math.sqrt(dx*dx + dz*dz);

      if (dist < minDist) {
        minDist = dist;
        closestBot = { x: bx, z: bz };
      }
    });

    if (closestBot && barrelRef.current) {
      const angle = Math.atan2(closestBot.x - droneRef.current.position.x, closestBot.z - droneRef.current.position.z);
      barrelRef.current.rotation.y = angle;
      
      setIsFiring(true);
      if (laserRef.current) {
        laserRef.current.visible = true;
        laserRef.current.scale.z = minDist;
        laserRef.current.material.opacity = 0.5 + Math.random() * 0.5;
      }
    } else {
      if (laserRef.current) laserRef.current.visible = false;
      setIsFiring(false);
    }
  });

  return (
    <group ref={droneRef} position={position}>
      <mesh><sphereGeometry args={[0.2, 16, 16]} /><meshStandardMaterial color="#333" metalness={0.9} roughness={0.1} /></mesh>
      <mesh position={[0, 0, 0.15]}><sphereGeometry args={[0.05]} /><meshBasicMaterial color="#e74c3c" /></mesh>
      <group ref={barrelRef} position={[0, 0, 0]}>
        <mesh position={[0, 0, 0.3]}><cylinderGeometry args={[0.05, 0.05, 0.6]} rotation={[Math.PI/2, 0, 0]} /><meshStandardMaterial color="#111" /></mesh>
      </group>
      <mesh ref={laserRef} position={[0, 0, 0]} visible={false}><boxGeometry args={[0.05, 0.05, 1]} /><meshBasicMaterial color="#ff0000" transparent opacity={0.8} /></mesh>
      <pointLight color="#e74c3c" intensity={1} distance={2} />
    </group>
  );
};

// --- THE COMMANDER (WASD ONLY) ---
const Commander = ({ activeRoom, setActiveRoom, isPaused, commanderPos, allBots }) => {
  const ref = useRef();
  const platformRef = useRef();
  const keys = useRef({});
  const scanRef = useRef();
  const scanTime = useRef(0);
  
  const [turrets, setTurrets] = useState([]);
  const shieldRef = useRef();
  const shieldTime = useRef(0);

  useEffect(() => {
    const down = (e) => {
      keys.current[e.key.toLowerCase()] = true;
      
      if (e.code === 'Space') {
        if (scanRef.current && scanTime.current <= 0) {
          scanTime.current = 1.5;
          scanRef.current.position.set(ref.current.position.x, 0.2, ref.current.position.z);
          scanRef.current.visible = true;
          scanRef.current.scale.set(1, 1, 1);
          scanRef.current.material.opacity = 1;
        }
      }

      if (e.key.toLowerCase() === 'f') {
        if (shieldRef.current && shieldTime.current <= 0) {
          shieldTime.current = 3.0;
          shieldRef.current.visible = true;
          shieldRef.current.scale.set(1, 1, 1);
          shieldRef.current.material.opacity = 0.5;
        }
      }

      if (e.key.toLowerCase() === 't') {
        const newTurret = { 
          id: Date.now(), 
          pos: [ref.current.position.x + (Math.random() - 0.5) * 2, 0.2, ref.current.position.z + (Math.random() - 0.5) * 2] 
        };
        setTurrets(prev => [...prev, newTurret]);
      }
    };
    const up = (e) => keys.current[e.key.toLowerCase()] = false;
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  useFrame((state, delta) => {
    if (!ref.current || isPaused) return;
    
    const isBoosting = keys.current['shift'];
    const speed = (isBoosting ? 10 : 5) * delta;

    // Pure WASD Movement
    if (keys.current['w'] || keys.current['arrowup']) ref.current.position.z -= speed;
    if (keys.current['s'] || keys.current['arrowdown']) ref.current.position.z += speed;
    if (keys.current['a'] || keys.current['arrowleft']) ref.current.position.x -= speed;
    if (keys.current['d'] || keys.current['arrowright']) ref.current.position.x += speed;

    commanderPos.current = { x: ref.current.position.x, z: ref.current.position.z };

    let closestRoom = null;
    let minDist = 4;
    Object.entries(ROOM_POSITIONS).forEach(([id, pos]) => {
      const dx = ref.current.position.x - pos.x;
      const dz = ref.current.position.z - pos.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      if (dist < minDist) { minDist = dist; closestRoom = id; }
    });
    if (closestRoom !== activeRoom) setActiveRoom(closestRoom);

    if (platformRef.current) {
      platformRef.current.rotation.z -= delta * 0.5;
      platformRef.current.position.set(ref.current.position.x, 0.1, ref.current.position.z);
    }

    if (scanTime.current > 0) {
      scanTime.current -= delta;
      if (scanRef.current) {
        const scale = 1 + (1.5 - scanTime.current) * 5;
        scanRef.current.scale.set(scale, scale, 1);
        scanRef.current.material.opacity = Math.max(0, scanTime.current / 1.5);
        if (scanTime.current <= 0) scanRef.current.visible = false;
      }
    }

    if (shieldTime.current > 0) {
      shieldTime.current -= delta;
      if (shieldRef.current) {
        shieldRef.current.rotation.y += delta;
        const scale = 1 + Math.sin(state.clock.elapsedTime * 10) * 0.05;
        shieldRef.current.scale.set(scale, scale, scale);
        shieldRef.current.material.opacity = Math.max(0, shieldTime.current / 3.0);
        if (shieldTime.current <= 0) shieldRef.current.visible = false;
      }
    }
  });

  return (
    <>
      <mesh ref={platformRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 1.0, 6]} />
        <meshBasicMaterial color="#f1c40f" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      
      <group ref={ref} position={[8, 0.6, 8]}>
        <Crewmate3D color="#f1c40f" name="COMMANDER" isCommander={true} />
        <pointLight color="#f1c40f" intensity={2} distance={4} position={[0, 0.5, 0]} />
        
        <group position={[0.4, 0.2, -0.2]} rotation={[0, 0, -0.5]}>
          <mesh><boxGeometry args={[0.1, 0.1, 0.8]} /><meshStandardMaterial color="#333" metalness={0.9} /></mesh>
          <mesh position={[0, 0, 0.4]}><boxGeometry args={[0.05, 0.2, 0.1]} /><meshStandardMaterial color="#111" /></mesh>
          <pointLight color="#00f0ff" intensity={2} distance={1} position={[0, 0, 0.5]} />
        </group>

        <mesh ref={shieldRef} visible={false}>
          <sphereGeometry args={[2.5, 32, 32]} />
          <meshBasicMaterial color="#00f0ff" transparent opacity={0.3} wireframe />
        </mesh>

        <mesh ref={scanRef} rotation={[-Math.PI / 2, 0, 0]} visible={false} position={[0, 0, 0]}>
          <ringGeometry args={[0.8, 1, 32]} /><meshBasicMaterial color="#00f0ff" transparent opacity={1} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {turrets.map(turret => (
        <CombatDrone key={turret.id} position={turret.pos} commanderPos={commanderPos.current} bots={allBots} />
      ))}
    </>
  );
};

const Minimap = ({ bots, commanderPos }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  return (
    <div className={`minimap-container ${isExpanded ? 'expanded' : 'minimized'}`}>
      <div className="minimap-header">
        {isExpanded && <span className="minimap-title">TACTICAL RADAR</span>}
        <button className="minimap-toggle" onClick={() => setIsExpanded(!isExpanded)}>{isExpanded ? '−' : '+'}</button>
      </div>
      {isExpanded && (
        <div className="minimap-map">
          <div className="map-room map-bridge" title="Bridge"></div>
          <div className="map-room map-comms" title="Comms"></div>
          <div className="map-room map-data" title="Data"></div>
          <div className="map-room map-strategy" title="Strategy"></div>
          <div className="map-room map-office" title="Office"></div>
          <div className="map-room map-hangar" title="Hangar"></div>
          <div className="map-room map-medbay" title="MedBay"></div>
          <div className="map-room map-presentation" title="Presentation"></div>
          
          <div className="map-dot commander-dot" style={{ left: `calc(50% + ${commanderPos.current.x * 3}%)`, top: `calc(50% + ${commanderPos.current.z * 3}%)` }} />
          
          {Object.values(bots).map(bot => {
            let x = 0, z = 0;
            if (bot.location === 'comms_array') { x = -8; z = -8; }
            if (bot.location === 'data_forge') { x = 8; z = -8; }
            if (bot.location === 'strategy_deck') { x = -8; z = 8; }
            if (bot.location === 'office') { x = 8; z = 8; }
            if (bot.location === 'hangar_bay') { x = 0; z = -14; }
            if (bot.location === 'medbay') { x = 0; z = 14; }
            if (bot.location === 'presentation_suite') { x = -14; z = 0; }
            
            if (bot.bot_id === 'data_bot') { x -= 2; z -= 2; }
            if (bot.bot_id === 'excel_bot') { x += 2; z -= 2; }
            if (bot.bot_id === 'report_bot') { x -= 2; z += 2; }
            if (bot.bot_id === 'ppt_bot') { x += 2; z += 2; }
            
            return <div key={bot.bot_id} className="map-dot bot-dot" style={{ left: `calc(50% + ${x * 3}%)`, top: `calc(50% + ${z * 3}%)`, backgroundColor: BOT_COLORS[bot.bot_id], boxShadow: `0 0 8px ${BOT_COLORS[bot.bot_id]}` }} />;
          })}
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [bots, setBots] = useState({});
  const [approvals, setApprovals] = useState([]);
  const [socket, setSocket] = useState(null);
  const [activeRoom, setActiveRoom] = useState(null);
  const [openRoom, setOpenRoom] = useState(null);
  const [isHudExpanded, setIsHudExpanded] = useState(true);
  const commanderPos = useRef({ x: 8, z: 8 });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key.toLowerCase() === 'e' && activeRoom && !openRoom) setOpenRoom(activeRoom);
      if (e.key === 'Escape') { setOpenRoom(null); setApprovals([]); }
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
        msg.bots.forEach(b => { if(b.bot_id !== 'email_bot') newBots[b.bot_id] = b; });
        setBots(newBots);
        setApprovals(msg.approvals);
      } 
      else if (msg.type === 'BOT_STATUS') {
        if (msg.bot_id !== 'email_bot') setBots(prev => ({ ...prev, [msg.bot_id]: msg }));
      }
      else if (msg.type === 'APPROVAL_REQUEST') setApprovals(prev => [...prev, msg]);
      else if (msg.type === 'APPROVAL_RESOLVED') setApprovals(prev => prev.filter(a => a.task_id !== msg.task_id));
    };
    setSocket(ws);
    return () => ws.close();
  }, []);

  const sendMessage = (obj) => { if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(obj)); };

  return (
    <div className="app-container">
      <div className="canvas-container">
        <Suspense fallback={<div style={{color: 'white', position: 'absolute', top: '50%', left: '50%'}}>Loading Ship...</div>}>
          <Canvas camera={{ position: [0, 25, 30], fov: 40 }} shadows>
            <color attach="background" args={['#02040a']} />
            <ambientLight intensity={0.2} />
            <directionalLight position={[10, 20, 10]} intensity={0.8} castShadow shadow-mapSize={[2048, 2048]} />
            
            <WarpStars />
            <BackgroundPlanet />
            <ShipHull />
            <EngineThrusters />

            <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.5} minPolarAngle={Math.PI / 4} minDistance={10} maxDistance={60} enablePan={true} />
            
            {!openRoom && activeRoom && Object.entries(ROOM_POSITIONS).filter(([id]) => id === activeRoom).map(([id, room]) => (
              <Html key={id} position={[room.x, 3.5, room.z]} center>
                <div style={{ background: 'rgba(46, 204, 113, 0.9)', border: '1px solid #fff', padding: '4px 8px', borderRadius: '4px', color: '#fff', fontFamily: 'Orbitron', fontSize: '10px', whiteSpace: 'nowrap', boxShadow: '0 0 15px #2ecc71', cursor: 'pointer' }} onClick={() => setOpenRoom(id)}>
                  PRESS [E] - {room.label.toUpperCase()}
                </div>
              </Html>
            ))}

            <Room position={[0, 0, 0]} size={[8, 1, 6]} color={ROOM_COLORS.bridge} label="Bridge (HQ)"><CommandTable position={[0, 0, 0]} /></Room>
            <Room position={[-8, 0, -8]} size={[5, 1, 5]} color={ROOM_COLORS.comms_array} label="Comms Array"><CommsMachinery position={[0, 0, 0]} /></Room>
            <Room position={[8, 0, -8]} size={[5, 1, 5]} color={ROOM_COLORS.data_forge} label="Data Forge"><DataForgeCore position={[0, 1, 0]} /></Room>
            <Room position={[-8, 0, 8]} size={[5, 1, 5]} color={ROOM_COLORS.strategy_deck} label="Strategy Deck"><StrategyMachinery position={[0, 0, 0]} /></Room>
            <Room position={[8, 0, 8]} size={[5, 1, 5]} color={ROOM_COLORS.office} label="Commander's Office"><OfficeMachinery position={[0, 0, -1]} /><Commander activeRoom={activeRoom} setActiveRoom={setActiveRoom} isPaused={!!openRoom} commanderPos={commanderPos} allBots={Object.values(bots)} /></Room>
            <Room position={[0, 0, -14]} size={[6, 1, 5]} color={ROOM_COLORS.hangar_bay} label="Hangar Bay"><HangarMachinery position={[0, 0, 0]} /></Room>
            <Room position={[0, 0, 14]} size={[6, 1, 5]} color={ROOM_COLORS.medbay} label="MedBay"><MedbayMachinery position={[0, 0, 0]} /></Room>
            
            <Room position={[-14, 0, 0]} size={[5, 1, 5]} color={ROOM_COLORS.presentation_suite} label="Presentation Suite">
              <PresentationMachinery position={[0, 0, 0]} />
            </Room>

            {Object.values(bots).map((bot) => <MovingBot key={bot.bot_id} bot={bot} />)}
            <EffectComposer><Bloom luminanceThreshold={0.5} mipmapBlur intensity={1.5} /></EffectComposer>
          </Canvas>
        </Suspense>
        <Minimap bots={bots} commanderPos={commanderPos} />
      </div>

      <button className={`hud-toggle-btn ${isHudExpanded ? '' : 'collapsed'}`} onClick={() => setIsHudExpanded(!isHudExpanded)}>
        {isHudExpanded ? '▶' : '◀'}
      </button>

      <div className={`hud-panel ${isHudExpanded ? 'expanded' : 'collapsed'}`}>
        <div className="hud-content">
          <div className="system-header">
            <div className="logo-text">GALAXY WORKFORCE</div>
            <div className="status-badge">ONLINE</div>
          </div>
          <div className="profile-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#8892b0' }}>COMMANDER</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff' }}>LV.4</div>
              </div>
              <div style={{ fontSize: '24px' }}>⚔️</div>
            </div>
            <div className="xp-bar-container"><div className="xp-bar" style={{ width: '65%' }}></div></div>
          </div>
          <div>
            <h4>System Telemetry</h4>
            <div className="telemetry-grid">
              <div className="telemetry-box"><div className="telem-label">CPU</div><div className="telem-value">42%</div></div>
              <div className="telemetry-box"><div className="telem-label">NETWORK</div><div className="telem-value" style={{ color: '#2ecc71' }}>STABLE</div></div>
              <div className="telemetry-box"><div className="telem-label">POWER</div><div className="telem-value" style={{ color: '#f1c40f' }}>98%</div></div>
              <div className="telemetry-box"><div className="telem-label">TASKS</div><div className="telem-value">{approvals.length} PENDING</div></div>
            </div>
          </div>
          <div>
            <h4>Agent Status</h4>
            <div className="bot-matrix">
              {['data_bot', 'excel_bot', 'report_bot', 'ppt_bot'].map(id => {
                const bot = bots[id] || { status: 'offline' };
                return (
                  <div key={id} className="bot-row">
                    <div className={`status-indicator ${bot.status}`}></div>
                    <div className="bot-name">{id.replace('_', ' ')}</div>
                    <div className="bot-state">{bot.status}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <h4>Dispatch Controls</h4>
            <div className="button-group">
              <button onClick={() => sendMessage({ type: "START_TASK", bot_id: 'data_bot' })}><span>▶ RUN DATA FORGE</span></button>
              <button onClick={() => sendMessage({ type: "START_TASK", bot_id: 'excel_bot' })}><span>▶ BUILD EXCEL</span></button>
              <button onClick={() => sendMessage({ type: "START_TASK", bot_id: 'report_bot' })}><span>▶ GENERATE REPORT</span></button>
              <button onClick={() => sendMessage({ type: "START_TASK", bot_id: 'ppt_bot' })}><span>▶ GENERATE PPTX</span></button>
            </div>
          </div>
          <div>
            <h4>Commander Controls</h4>
            <div className="button-group" style={{ fontSize: '10px', color: '#8892b0', lineHeight: '1.6' }}>
              <div>⌨️ <strong>WASD/Arrows:</strong> Move Commander</div>
              <div>⚡ <strong>Hold Shift:</strong> Overclock Speed</div>
              <div>🔵 <strong>Spacebar:</strong> Tactical Scan</div>
              <div>🛡️ <strong>F Key:</strong> Activate Energy Shield</div>
              <div>🔫 <strong>T Key:</strong> Deploy Combat Drone</div>
            </div>
          </div>
        </div>
      </div>

      {openRoom && (
        <div className="room-modal-overlay" onClick={() => setOpenRoom(null)}>
          <div className="room-modal" onClick={e => e.stopPropagation()}>
            <h2>{ROOM_POSITIONS[openRoom].label}</h2>
            <p>Terminal Access Granted. Welcome, Commander.</p>
            <div className="terminal-data">
              {openRoom === 'data_forge' && <p>Analyzing CSV... 200 rows processed.</p>}
              {openRoom === 'comms_array' && <p>Comms Array offline for maintenance.</p>}
              {openRoom === 'strategy_deck' && <p>Active reports: 2.</p>}
              {openRoom === 'bridge' && <p>Ship status: All systems nominal.</p>}
              {openRoom === 'office' && <p>Commander's personal logs.</p>}
              {openRoom === 'hangar_bay' && <p>Shuttle is fueled and ready.</p>}
              {openRoom === 'medbay' && <p>All crew vitals are normal.</p>}
              {openRoom === 'presentation_suite' && <p>PowerPoint presentation suite ready.</p>}
            </div>
            <button className="close-btn" onClick={() => setOpenRoom(null)}>CLOSE TERMINAL [ESC]</button>
          </div>
        </div>
      )}

      {approvals.length > 0 && !openRoom && (
        <div className="room-modal-overlay" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="room-modal" style={{ borderColor: '#f1c40f', width: '600px' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ color: '#f1c40f' }}>APPROVAL REQUIRED</h2>
            <p style={{ color: '#fff' }}>One or more agents are waiting for your command.</p>
            {approvals.map((a) => (
              <div key={a.task_id} className="approval-card" style={{ marginBottom: '15px' }}>
                <div style={{ color: '#f1c40f', fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>{a.bot_id.toUpperCase()}</div>
                <div style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '10px' }}>{a.summary}</div>
                <div className="row">
                  <button className="approve" style={{ padding: '10px', fontSize: '13px' }} onClick={() => { sendMessage({ type: 'APPROVE_ACTION', task_id: a.task_id }); setApprovals(prev => prev.filter(x => x.task_id !== a.task_id)); }}>APPROVE</button>
                  <button className="reject" style={{ padding: '10px', fontSize: '13px' }} onClick={() => { sendMessage({ type: 'REJECT_ACTION', task_id: a.task_id }); setApprovals(prev => prev.filter(x => x.task_id !== a.task_id)); }}>REJECT</button>
                </div>
              </div>
            ))}
            <button className="close-btn" onClick={() => setApprovals([])}>DISMISS (WILL RE-TRIGGER)</button>
          </div>
        </div>
      )}
    </div>
  );
}
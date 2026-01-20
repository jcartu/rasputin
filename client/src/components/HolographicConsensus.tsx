import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, Trail, Text } from '@react-three/drei';
import * as THREE from 'three';

interface ModelStatus {
  id: string;
  name: string;
  status: 'idle' | 'thinking' | 'streaming' | 'complete' | 'error';
  color: string;
}

interface HolographicConsensusProps {
  progress: number;
  models: ModelStatus[];
}

// Helper to get current theme primary color from CSS variable
const usePrimaryColor = () => {
  const [color, setColor] = useState('#06b6d4');

  useEffect(() => {
    const updateColor = () => {
      const style = getComputedStyle(document.documentElement);
      // Try to parse oklch color or fallback to hex
      // Since we can't easily parse oklch in JS without a library, 
      // we'll map theme classes to hex values for the 3D engine
      const theme = document.documentElement.className.match(/theme-([\w-]+)/)?.[1] || 'cyber-blue';
      
      const themeColors: Record<string, string> = {
        'cyber-blue': '#06b6d4',
        'code-red': '#ef4444',
        'matrix-green': '#22c55e',
        'void-purple': '#a855f7',
        'solar-gold': '#eab308',
        'ice-white': '#f8fafc',
        'stealth-obsidian': '#404040', // Lighter grey for visibility against black
        'neon-pink': '#ec4899',
        'radioactive-orange': '#f97316',
        'deep-ocean': '#0ea5e9'
      };
      
      setColor(themeColors[theme] || '#06b6d4');
    };

    // Initial update
    updateColor();

    // Watch for class changes on html element
    const observer = new MutationObserver(updateColor);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  return color;
};

const ModelNode = ({ 
  model, 
  index, 
  total, 
  progress,
  primaryColor
}: { 
  model: ModelStatus; 
  index: number; 
  total: number; 
  progress: number; 
  primaryColor: string;
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  
  // Use theme color for all nodes to match the aesthetic
  const color = primaryColor;

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    
    const t = clock.getElapsedTime();
    const convergence = Math.min(progress / 100, 1);
    
    // Orbit logic
    const baseRadius = 3;
    const currentRadius = baseRadius * (1 - convergence * 0.9); // Shrink to center
    const speed = 0.5 + (convergence * 2); // Speed up as they merge
    
    const angle = (index / total) * Math.PI * 2 + (t * speed);
    const yOffset = Math.sin(t * 2 + index) * 0.5 * (1 - convergence); // Bobbing motion reduces as they merge
    
    groupRef.current.position.x = Math.cos(angle) * currentRadius;
    groupRef.current.position.z = Math.sin(angle) * currentRadius;
    groupRef.current.position.y = yOffset;
    
    // Rotate mesh
    if (meshRef.current) {
      meshRef.current.rotation.x += 0.02;
      meshRef.current.rotation.y += 0.02;
    }
  });

  return (
    <group ref={groupRef}>
      <Trail
        width={0.2}
        length={8}
        color={new THREE.Color(color)}
        attenuation={(t) => t * t}
      >
        <mesh ref={meshRef}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshStandardMaterial 
            color={color} 
            emissive={color}
            emissiveIntensity={2}
            toneMapped={false}
          />
        </mesh>
      </Trail>
      
      {/* Label */}
      <Text
        position={[0, 0.4, 0]}
        fontSize={0.15}
        color={color}
        anchorX="center"
        anchorY="middle"
      >
        {model.name}
      </Text>
      
      {/* Connection Line to Center */}
      {progress > 0 && (
        <line>
          <bufferGeometry />
          <lineBasicMaterial color={color} transparent opacity={0.2} />
        </line>
      )}
    </group>
  );
};

const CentralCore = ({ progress, color }: { progress: number; color: string }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    const convergence = Math.min(progress / 100, 1);
    
    // Pulse effect
    const scale = 1 + Math.sin(t * 3) * 0.1 + (convergence * 1.5);
    meshRef.current.scale.set(scale, scale, scale);
    
    meshRef.current.rotation.y -= 0.01;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.5, 32, 32]} />
      <meshStandardMaterial 
        color={color}
        emissive={color}
        emissiveIntensity={progress > 90 ? 5 : 1}
        wireframe
        transparent
        opacity={0.8}
      />
    </mesh>
  );
};

const ParticleField = ({ color }: { color: string }) => {
  const count = 200;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    return pos;
  }, []);

  const pointsRef = useRef<THREE.Points>(null);

  useFrame(() => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.001;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.02}
        color={color}
        transparent
        opacity={0.4}
        sizeAttenuation
      />
    </points>
  );
};

export default function HolographicConsensus({ progress, models }: HolographicConsensusProps) {
  const primaryColor = usePrimaryColor();

  return (
    <div className="w-full h-[400px] rounded-xl overflow-hidden border border-primary/30 bg-black/80 relative transition-colors duration-500">
      <div className="absolute top-4 left-4 z-10 font-mono text-xs text-primary transition-colors duration-500">
        VIEW: ORBITAL_SYNC
        <br />
        ZOOM: ENABLED
      </div>
      
      <Canvas camera={{ position: [0, 2, 6], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        
        <group>
          <CentralCore progress={progress} color={primaryColor} />
          
          {models.map((model, i) => (
            <ModelNode 
              key={model.id}
              model={model}
              index={i}
              total={models.length}
              progress={progress}
              primaryColor={primaryColor}
            />
          ))}
          
          <ParticleField color={primaryColor} />
        </group>
        
        <OrbitControls 
          enablePan={false}
          minDistance={3}
          maxDistance={10}
          autoRotate={progress < 100}
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
}

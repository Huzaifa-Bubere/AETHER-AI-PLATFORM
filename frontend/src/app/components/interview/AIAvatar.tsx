import { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Text } from '@react-three/drei';
import * as THREE from 'three';

interface AIAvatarProps {
  isListening?: boolean;
  isSpeaking?: boolean;
  emotion?: 'neutral' | 'happy' | 'encouraging' | 'thinking';
  className?: string;
}

function AvatarModel({ isListening, isSpeaking, emotion }: {
  isListening?: boolean;
  isSpeaking?: boolean;
  emotion?: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      // Subtle breathing animation
      meshRef.current.scale.y = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.02;
      
      // Speaking animation
      if (isSpeaking) {
        meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 8) * 0.1;
      }
      
      // Listening animation
      if (isListening) {
        meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 3) * 0.1;
      }
    }
  });

  return (
    <group>
      {/* Avatar Head */}
      <mesh
        ref={meshRef}
        position={[0, 0, 0]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial
          color={hovered ? '#4f46e5' : '#6366f1'}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>

      {/* Eyes */}
      <mesh position={[-0.3, 0.2, 0.8]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh position={[0.3, 0.2, 0.8]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>

      {/* Mouth - changes based on speaking */}
      <mesh position={[0, -0.2, 0.8]} scale={isSpeaking ? [1.2, 0.8, 1] : [1, 1, 1]}>
        <sphereGeometry args={[0.15, 16, 8]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>

      {/* Status indicator */}
      {isListening && (
        <mesh position={[0, 1.5, 0]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.5} />
        </mesh>
      )}

      {isSpeaking && (
        <mesh position={[0, 1.5, 0]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.5} />
        </mesh>
      )}

      {/* Name tag */}
      <Text
        position={[0, -1.8, 0]}
        fontSize={0.3}
        color="#374151"
        anchorX="center"
        anchorY="middle"
      >
        AI Interviewer
      </Text>
    </group>
  );
}

export function AIAvatar({ isListening, isSpeaking, emotion, className }: AIAvatarProps) {
  return (
    <div className={`w-full h-full ${className}`}>
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <pointLight position={[-10, -10, -10]} color="#4f46e5" intensity={0.3} />
        
        <AvatarModel
          isListening={isListening}
          isSpeaking={isSpeaking}
          emotion={emotion}
        />
        
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          maxPolarAngle={Math.PI / 2}
          minPolarAngle={Math.PI / 3}
        />
      </Canvas>
      
      {/* Status overlay */}
      <div className="absolute bottom-4 left-4 flex items-center gap-2">
        {isListening && (
          <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            Listening...
          </div>
        )}
        
        {isSpeaking && (
          <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            Speaking...
          </div>
        )}
      </div>
    </div>
  );
}
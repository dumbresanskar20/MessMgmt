import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, useTexture } from '@react-three/drei';
import * as THREE from 'three';

// Realistic Photorealistic Food Texture Mesh
function RealisticFoodPlane({ scrollProgress }) {
  const meshRef = useRef();
  const texture = useTexture('/hero_canteen_thali_meal.png');

  useFrame((state) => {
    if (!meshRef.current) return;

    // Smooth lerp targets based on scroll progress (0 to 1) — Scale is fixed at 1.0 (no zoom)
    const targetY = -0.1 - scrollProgress * 1.2;
    const targetX = Math.sin(scrollProgress * Math.PI) * 0.75;
    const targetRotY = (scrollProgress - 0.5) * 0.8 + Math.sin(state.clock.elapsedTime * 0.8) * 0.08;
    const targetRotX = Math.sin(scrollProgress * Math.PI) * 0.35 + (state.pointer.y * 0.15);

    // Fluid frame interpolation (lerp) for position and rotation
    meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, targetY, 0.08);
    meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, targetX, 0.08);
    meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRotY, 0.08);
    meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetRotX, 0.08);

    // Subtle continuous float wobble
    meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 1.2) * 0.03;
  });

  return (
    <group ref={meshRef} position={[0, -0.1, 0]}>
      {/* Soft Circular Ambient Base Glow (No Square Box) */}
      <mesh position={[0, -0.05, -0.05]}>
        <circleGeometry args={[2.15, 64]} />
        <meshBasicMaterial color="#d97706" transparent opacity={0.12} />
      </mesh>

      {/* Main Floating Photorealistic Food Texture Circle */}
      <mesh receiveShadow castShadow position={[0, 0, 0]}>
        <circleGeometry args={[2.1, 64]} />
        <meshStandardMaterial
          map={texture}
          transparent
          alphaTest={0.01}
          roughness={0.2}
          metalness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// 3D Background Floating Particle Wisps
function BackgroundParticles({ scrollProgress }) {
  const count = 45;
  const particlesRef = useRef();

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const palette = ['#ea580c', '#f59e0b', '#fbbf24', '#ffffff'];

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 8;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6 - 2;

      const c = new THREE.Color(palette[Math.floor(Math.random() * palette.length)]);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return [pos, col];
  }, [count]);

  useFrame((state) => {
    if (!particlesRef.current) return;
    const time = state.clock.getElapsedTime();
    particlesRef.current.rotation.y = time * 0.05 + scrollProgress * 0.4;
    particlesRef.current.position.y = Math.sin(time * 0.5) * 0.2 - scrollProgress * 0.4;
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.12}
        vertexColors
        transparent
        opacity={0.5}
        sizeAttenuation
      />
    </points>
  );
}

function SceneRig({ scrollProgress }) {
  useFrame((state) => {
    // Cinematic camera elevation and depth dolly
    const targetCamZ = 5 - scrollProgress * 1.2;
    const targetCamY = 1.8 + scrollProgress * 0.6;
    state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, targetCamZ, 0.05);
    state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, targetCamY, 0.05);
    state.camera.lookAt(0, -0.1, 0);
  });

  return null;
}

export default function ScrollFoodScene({ scrollProgress = 0 }) {
  const [hasWebGL, setHasWebGL] = useState(true);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) setHasWebGL(false);
    } catch {
      setHasWebGL(false);
    }

    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 2;
    const isSmallScreen = window.innerWidth < 768;
    if (isTouch && isSmallScreen) {
      setIsMobileDevice(true);
    }
  }, []);

  return (
    <div className="relative w-full h-full flex items-center justify-center pointer-events-none bg-transparent">
      {hasWebGL && !isMobileDevice ? (
        <Canvas
          className="w-full h-full bg-transparent"
          gl={{ alpha: true, antialias: true }}
          style={{ background: 'transparent' }}
        >
          <PerspectiveCamera makeDefault position={[0, 1.8, 5]} fov={45} />
          <ambientLight intensity={1.5} />
          <directionalLight position={[5, 8, 5]} intensity={2.0} castShadow />
          <pointLight position={[-5, -2, -2]} intensity={0.6} color="#ea580c" />
          
          <BackgroundParticles scrollProgress={scrollProgress} />
          <SceneRig scrollProgress={scrollProgress} />
          
          <RealisticFoodPlane scrollProgress={scrollProgress} />
        </Canvas>
      ) : (
        /* Lightweight CSS-based 3D transform fallback for low-end mobile devices (Fixed scale) */
        <div
          className="relative text-center transition-transform duration-300 ease-out bg-transparent"
          style={{
            transform: `translateY(${scrollProgress * 40}px) rotate(${scrollProgress * 30}deg)`,
          }}
        >
          <img
            src="/hero_canteen_thali_meal.png"
            alt="Appetizing Canteen Meal"
            className="w-64 h-64 sm:w-72 sm:h-72 object-contain filter drop-shadow-xl"
          />
        </div>
      )}
    </div>
  );
}

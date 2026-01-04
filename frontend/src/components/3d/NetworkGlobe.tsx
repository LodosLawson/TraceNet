
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Box, Stars, Line } from '@react-three/drei';
import * as THREE from 'three';

// Helper to convert lat/lng to 3D vector
const getPosition = (lat: number, lng: number, radius: number) => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = (radius * Math.sin(phi) * Math.sin(theta));
    const y = (radius * Math.cos(phi));
    return new THREE.Vector3(x, y, z);
};

// Generate random "Seed" nodes
const generateNodes = (count: number, radius: number) => {
    return Array.from({ length: count }).map((_, i) => ({
        id: i,
        lat: (Math.random() - 0.5) * 160, // Avoid poles
        lng: (Math.random() - 0.5) * 360,
        position: getPosition((Math.random() - 0.5) * 160, (Math.random() - 0.5) * 360, radius)
    }));
};

const NodeSeed = ({ position }: { position: THREE.Vector3 }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.rotation.x += 0.01;
            meshRef.current.rotation.y += 0.02;
            // Pulse effect
            const s = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
            meshRef.current.scale.set(s, s, s);
        }
    });

    return (
        <Box args={[0.08, 0.08, 0.08]} position={position} ref={meshRef}>
            <meshStandardMaterial
                color="#ef233c" // Pomegranate 500
                emissive="#d90429"
                emissiveIntensity={2}
                roughness={0.2}
                metalness={0.8}
            />
        </Box>
    );
};

export const NetworkGlobe = () => {
    const groupRef = useRef<THREE.Group>(null);
    const radius = 2;
    const nodes = useMemo(() => generateNodes(30, radius), []);

    useFrame(() => {
        if (groupRef.current) {
            groupRef.current.rotation.y += 0.0005; // Slow rotation
        }
    });

    // Connections between close nodes
    const connections = useMemo(() => {
        const lines: THREE.Vector3[][] = [];
        nodes.forEach((node, i) => {
            nodes.forEach((other, j) => {
                if (i < j) {
                    const dist = node.position.distanceTo(other.position);
                    if (dist < 1.5) {
                        lines.push([node.position, other.position]);
                    }
                }
            });
        });
        return lines;
    }, [nodes]);

    return (
        <group ref={groupRef}>
            {/* Core Earth */}
            <Sphere args={[radius - 0.05, 64, 64]}>
                <meshPhongMaterial
                    color="#2f0205" // Deep Pomegranate Background
                    emissive="#4a0404"
                    emissiveIntensity={0.2}
                    shininess={10}
                    specular={new THREE.Color('#ef233c')}
                />
            </Sphere>

            {/* Wireframe Atmosphere */}
            <Sphere args={[radius, 32, 32]}>
                <meshBasicMaterial
                    color="#d90429"
                    wireframe
                    transparent
                    opacity={0.15}
                />
            </Sphere>

            {/* Nodes (Seeds) */}
            {nodes.map((node) => (
                <NodeSeed key={node.id} position={node.position} />
            ))}

            {/* Connections */}
            {connections.map((line, i) => (
                <Line
                    key={i}
                    points={line}
                    color="#ffb703" // Gold
                    transparent
                    opacity={0.3}
                    lineWidth={1}
                />
            ))}

            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        </group>
    );
};

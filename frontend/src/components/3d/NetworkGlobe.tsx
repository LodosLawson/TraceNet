import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Stars, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// --- Constants & Config ---
const GLOBE_RADIUS = 2;
const NODE_COUNT = 80; // Increased density
const CONNECTION_DISTANCE = 1.8; // Connection threshold
const COLORS = {
    background: '#1a0b0c', // Darkest Red/Black
    globeBase: '#2f0205',  // Deep Pomegranate
    globeWire: '#d90429',  // Bright Pomegranate
    node: '#ef233c',       // High-vis Red
    connection: '#ffb703', // Gold
    active: '#ffffff'
};

// --- Helpers ---
const getPosition = (lat: number, lng: number, radius: number) => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = (radius * Math.sin(phi) * Math.sin(theta));
    const y = (radius * Math.cos(phi));
    return new THREE.Vector3(x, y, z);
};

// Generate curved paths (Quadratic Bezier)
const getCurve = (p1: THREE.Vector3, p2: THREE.Vector3) => {
    const distance = p1.distanceTo(p2);
    // Find midpoint
    const mid = p1.clone().add(p2).multiplyScalar(0.5);
    // Push midpoint OUT directly from center to create arc
    const midLength = mid.length();
    mid.normalize().multiplyScalar(midLength + distance * 0.5); // Curve height depends on distance

    const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
    // Get distinct points
    return curve.getPoints(20);
};

// --- Sub-Components ---

const GlobeBase = () => {
    return (
        <group>
            {/* Core Dark Sphere */}
            <Sphere args={[GLOBE_RADIUS - 0.02, 64, 64]}>
                <meshStandardMaterial
                    color={COLORS.globeBase}
                    roughness={0.7}
                    metalness={0.1}
                    emissive={COLORS.globeBase}
                    emissiveIntensity={0.2}
                />
            </Sphere>

            {/* Glowing Atmosphere/Rim */}
            <Sphere args={[GLOBE_RADIUS, 64, 64]}>
                <meshPhongMaterial
                    color={COLORS.globeWire}
                    transparent
                    opacity={0.1}
                    side={THREE.BackSide} /* Inner glow */
                    blending={THREE.AdditiveBlending}
                />
            </Sphere>

            {/* Tech Wireframe Overlay */}
            <Sphere args={[GLOBE_RADIUS + 0.01, 32, 32]}>
                <meshBasicMaterial
                    color={COLORS.globeWire}
                    wireframe
                    transparent
                    opacity={0.08}
                />
            </Sphere>
        </group>
    );
};

const NodesInstanced = ({ nodes }: { nodes: any[] }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const tempObj = new THREE.Object3D();

    useFrame((state) => {
        if (!meshRef.current) return;

        const time = state.clock.getElapsedTime();

        nodes.forEach((node, i) => {
            tempObj.position.copy(node.position);
            // Subtle "breathing" scale animation based on ID and Time
            const scale = 1 + Math.sin(time * 2 + node.id) * 0.2;
            tempObj.scale.set(scale, scale, scale);
            tempObj.lookAt(0, 0, 0); // Orient towards center (or away)
            tempObj.updateMatrix();
            meshRef.current!.setMatrixAt(i, tempObj.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined as any, undefined as any, nodes.length]}>
            <boxGeometry args={[0.06, 0.06, 0.06]} />
            <meshBasicMaterial color={COLORS.node} toneMapped={false} />
        </instancedMesh>
    );
};

const DataArcs = ({ nodes }: { nodes: any[] }) => {
    // We compute the geometry ONCE (or when nodes change).
    // Using simple Lines for performance, but formatted as arcs.

    const geometry = useMemo(() => {
        const points: THREE.Vector3[] = [];

        // Connect nearby nodes
        for (let i = 0; i < nodes.length; i++) {
            // Limit connections per node to avoid mess
            let connections = 0;
            for (let j = i + 1; j < nodes.length; j++) {
                if (connections > 2) break; // Max 2 connections outgoing per node

                const dist = nodes[i].position.distanceTo(nodes[j].position);
                // Connect if moderately close but not too close (looks better)
                if (dist < CONNECTION_DISTANCE && dist > 0.5) {
                    const curvePoints = getCurve(nodes[i].position, nodes[j].position);
                    points.push(...curvePoints);
                    connections++;
                }
            }
        }

        const geo = new THREE.BufferGeometry().setFromPoints(points);
        return geo;
    }, [nodes]);

    return (
        <lineSegments geometry={geometry}>
            <lineBasicMaterial
                color={COLORS.connection}
                transparent
                opacity={0.15}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
            />
        </lineSegments>
    );
};


const Sun = () => {
    const lightRef = useRef<THREE.DirectionalLight>(null);
    const sunMeshRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        const time = state.clock.getElapsedTime() * 0.2; // Day cycle speed

        // Circular orbit
        const x = Math.sin(time) * 10;
        const z = Math.cos(time) * 10;

        if (lightRef.current) {
            lightRef.current.position.set(x, 5, z);
            lightRef.current.lookAt(0, 0, 0);
        }
        if (sunMeshRef.current) {
            sunMeshRef.current.position.set(x, 5, z);
        }
    });

    return (
        <group>
            <directionalLight
                ref={lightRef}
                intensity={3}
                color="#ffffff"
                castShadow
                shadow-mapSize={[1024, 1024]}
            />
            {/* Sun Visual */}
            <mesh ref={sunMeshRef}>
                <sphereGeometry args={[0.5, 32, 32]} />
                <meshBasicMaterial color="#ffbd00" fog={false} />
            </mesh>
            {/* Opposite Fill Light (Moon/Fill) */}
            <ambientLight intensity={0.8} color={COLORS.globeWire} />
        </group>
    );
};

// --- Main Component ---

export const NetworkGlobe = () => {
    // Generate stable random nodes
    const nodes = useMemo(() => {
        return Array.from({ length: NODE_COUNT }).map((_, i) => {
            const lat = (Math.random() - 0.5) * 160;
            const lng = (Math.random() - 0.5) * 360;
            return {
                id: i,
                position: getPosition(lat, lng, GLOBE_RADIUS),
                lat,
                lng
            };
        });
    }, []);

    return (
        <group>
            <Sun />  {/* Added Day/Night Cycle */}
            <GlobeBase />
            <NodesInstanced nodes={nodes} />
            <DataArcs nodes={nodes} />

            {/* Background Stars - Subtle */}
            <Stars radius={150} depth={50} count={3000} factor={4} saturation={0} fade speed={0.5} />

            {/* Mobile Optimization: Allow touch rotation, disable zoom to prevent breaking layout */}
            <OrbitControls
                enableZoom={false}
                enablePan={false}
                autoRotate
                autoRotateSpeed={0.8}
                minPolarAngle={Math.PI / 4}
                maxPolarAngle={Math.PI - Math.PI / 4}
            />
        </group>
    );
};

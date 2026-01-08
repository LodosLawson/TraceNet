import { useMemo, useRef } from 'react';
import { useFrame, extend } from '@react-three/fiber';
import { Sphere, Stars, OrbitControls, shaderMaterial, useTexture } from '@react-three/drei';
import * as THREE from 'three';

// --- Constants ---
const GLOBE_RADIUS = 2;
const NODE_COUNT_FALLBACK = 60; // Reduced for cleaner look

const COLORS = {
    background: '#1a0b0c',
    globeBase: '#000000',
    globeGlow: '#d90429',
    node: '#ef233c',
    localNode: '#ffb703',
    connection: '#ff4d6d',
    packet: '#ffffff'
};

// --- Shaders ---
const AtmosphereMaterial = shaderMaterial(
    {
        color: new THREE.Color(COLORS.globeGlow),
        coefficient: 0.5,
        power: 4.0,
    },
    `varying vec3 vNormal;
    void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
    `varying vec3 vNormal;
    uniform vec3 color;
    uniform float coefficient;
    uniform float power;
    void main() {
        float intensity = pow(coefficient - dot(vNormal, vec3(0.0, 0.0, 1.0)), power);
        gl_FragColor = vec4(color, 1.0) * intensity;
    }`
);

extend({ AtmosphereMaterial });

// --- Helpers ---
const getPosition = (lat: number, lng: number, radius: number) => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = (radius * Math.sin(phi) * Math.sin(theta));
    const y = (radius * Math.cos(phi));
    return new THREE.Vector3(x, y, z);
};

const stringToHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
};

const getDeterministicLatLng = (id: string | number) => {
    const hash = stringToHash(String(id));
    // Lat: -60 to 80 (avoid extreme south Antarctica)
    const lat = (hash % 140) - 60;
    // Lng: -180 to 180
    const lng = ((hash * 13) % 360) - 180;
    return { lat, lng };
};

// --- Components ---

const Globe = () => {
    const earthMap = useTexture('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg');

    return (
        <group>
            <Sphere args={[GLOBE_RADIUS, 64, 64]}>
                <meshPhongMaterial
                    map={earthMap}
                    color={COLORS.globeGlow}
                    emissive={COLORS.globeBase}
                    emissiveIntensity={0.2}
                    specular={new THREE.Color(COLORS.node)}
                    shininess={5}
                    transparent
                    opacity={0.8}
                    blending={THREE.AdditiveBlending}
                />
            </Sphere>
            <Sphere args={[GLOBE_RADIUS - 0.01, 64, 64]}>
                <meshBasicMaterial color="#000000" />
            </Sphere>
            <mesh>
                <sphereGeometry args={[GLOBE_RADIUS + 0.1, 64, 64]} />
                {/* @ts-ignore */}
                <atmosphereMaterial transparent side={THREE.BackSide} blending={THREE.AdditiveBlending} />
            </mesh>
        </group>
    );
};

// ... (LocalNodePulse and PeersInstanced remain mostly similar but simplified if needed)
const LocalNodePulse = ({ position }: { position: THREE.Vector3 }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const ringRef = useRef<THREE.Mesh>(null);
    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        if (meshRef.current) meshRef.current.scale.setScalar(1 + Math.sin(t * 3) * 0.2);
        if (ringRef.current) {
            const ringScale = (t * 2) % 3;
            ringRef.current.scale.setScalar(ringScale);
            (ringRef.current.material as THREE.MeshBasicMaterial).opacity = 1 - (ringScale / 3);
        }
    });
    return (
        <group position={position}>
            <mesh ref={meshRef}><sphereGeometry args={[0.08, 16, 16]} /><meshBasicMaterial color={COLORS.localNode} /></mesh>
            <pointLight distance={3} intensity={3} color={COLORS.localNode} />
            <mesh ref={ringRef}><ringGeometry args={[0.08, 0.15, 32]} /><meshBasicMaterial color={COLORS.localNode} transparent side={THREE.DoubleSide} /></mesh>
        </group>
    );
};

const PeersInstanced = ({ nodes }: { nodes: any[] }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const tempObj = new THREE.Object3D();
    useFrame((state) => {
        if (!meshRef.current) return;
        const time = state.clock.getElapsedTime();
        nodes.forEach((node, i) => {
            tempObj.position.copy(node.position);
            const scale = 1 + Math.sin(time + String(node.id).length) * 0.1;
            tempObj.scale.setScalar(scale);
            tempObj.updateMatrix();
            meshRef.current!.setMatrixAt(i, tempObj.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    });
    return (
        <instancedMesh ref={meshRef} args={[undefined as any, undefined as any, nodes.length]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshBasicMaterial color={COLORS.node} />
        </instancedMesh>
    );
};

// Simplified Data Traffic
const DataTraffic = ({ curves }: { curves: THREE.QuadraticBezierCurve3[] }) => {
    // Only show traffic on subset of curves to reduce visual noise
    const activeCurves = useMemo(() => curves.filter((_, i) => i % 2 === 0), [curves]);
    const PACKETS_PER_CURVE = 1;
    const TOTAL_PACKETS = activeCurves.length * PACKETS_PER_CURVE;
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const tempObj = new THREE.Object3D();
    const offsets = useMemo(() => new Float32Array(TOTAL_PACKETS).map(() => Math.random()), [activeCurves.length]);
    const speeds = useMemo(() => new Float32Array(TOTAL_PACKETS).map(() => 0.3 + Math.random() * 0.4), [activeCurves.length]);

    useFrame((_, delta) => {
        if (!meshRef.current) return;
        for (let i = 0; i < TOTAL_PACKETS; i++) {
            offsets[i] += speeds[i] * delta;
            if (offsets[i] > 1) offsets[i] = 0;
            const curveIndex = Math.floor(i / PACKETS_PER_CURVE);
            const curve = activeCurves[curveIndex];
            if (curve) {
                tempObj.position.copy(curve.getPoint(offsets[i]));
                tempObj.scale.setScalar(1);
                tempObj.updateMatrix();
                meshRef.current.setMatrixAt(i, tempObj.matrix);
            }
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    if (activeCurves.length === 0) return null;
    return (
        <instancedMesh ref={meshRef} args={[undefined as any, undefined as any, TOTAL_PACKETS]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshBasicMaterial color={COLORS.packet} />
        </instancedMesh>
    );
}

const ConnectionLines = ({ curves }: { curves: THREE.QuadraticBezierCurve3[] }) => {
    const geometry = useMemo(() => {
        const points: THREE.Vector3[] = [];
        curves.forEach(curve => points.push(...curve.getPoints(24)));
        return new THREE.BufferGeometry().setFromPoints(points);
    }, [curves]);
    if (curves.length === 0) return null;
    return (
        <lineSegments geometry={geometry}>
            <lineBasicMaterial color={COLORS.connection} transparent opacity={0.15} blending={THREE.AdditiveBlending} depthWrite={false} />
        </lineSegments>
    );
};

// --- Main ---

export const NetworkGlobe = ({ realNodes }: { realNodes?: any[] }) => {

    const { localNode, others, curves } = useMemo(() => {
        // 1. STABLE NODE LIST GENERATION
        let nodes: any[] = [];
        const inputNodes = realNodes && realNodes.length > 0 ? realNodes : [];

        // Combine inputs + fallback to ensure we always have enough points for a "network" look
        // If realNodes is sparse, we fill with stable placeholders
        const needed = Math.max(0, NODE_COUNT_FALLBACK - inputNodes.length);

        // Process Real Nodes
        nodes = inputNodes.map((n, i) => {
            // Strict deterministic fallback
            let coords = { lat: n.lat, lng: n.lng };
            if (coords.lat === undefined || (coords.lat === 0 && coords.lng === 0)) {
                coords = getDeterministicLatLng(n.id || `node-${i}`);
            }
            return {
                ...n,
                id: n.id || `node-${i}`,
                lat: coords.lat,
                lng: coords.lng,
                position: getPosition(coords.lat, coords.lng, GLOBE_RADIUS),
                isLocal: n.id === 'local-node' // Check ID safely
            };
        });

        // Add Fallback Nodes (Deterministic)
        for (let i = 0; i < needed; i++) {
            const id = `fallback-stable-${i}`;
            const coords = getDeterministicLatLng(id);
            nodes.push({
                id,
                lat: coords.lat,
                lng: coords.lng,
                position: getPosition(coords.lat, coords.lng, GLOBE_RADIUS),
                isLocal: false
            });
        }

        const local = nodes.find(n => n.isLocal || n.id === 'local-node') || nodes[0];
        const othersList = nodes.filter(n => n.id !== local.id);

        // 2. MESH TOPOLOGY GENERATION (Nearest Block)
        // Instead of connecting everyone to Local, connect nodes to their nearest neighbors
        const curveList: THREE.QuadraticBezierCurve3[] = [];

        // Helper to find nearest neighbors
        const findNearest = (source: any, candidates: any[], count: number) => {
            return candidates
                .map(c => ({ node: c, dist: source.position.distanceTo(c.position) }))
                .sort((a, b) => a.dist - b.dist)
                .slice(0, count)
                .map(i => i.node);
        };

        // Connect Local to its nearest 5 neighbors
        const localNeighbors = findNearest(local, othersList, 5);
        localNeighbors.forEach(peer => {
            const mid = local.position.clone().add(peer.position).multiplyScalar(0.5).normalize().multiplyScalar(GLOBE_RADIUS * 1.2);
            curveList.push(new THREE.QuadraticBezierCurve3(local.position, mid, peer.position));
        });

        // Connect each other node to its nearest 2 neighbors (Partial Mesh)
        // Optimization: Limit to random subset to prevent curve explosion
        const subset = othersList.slice(0, 40);
        subset.forEach(source => {
            // Find neighbors in the same subset
            const neighbors = findNearest(source, subset.filter(n => n !== source), 2);
            neighbors.forEach(target => {
                // Determine arc height based on distance
                const dist = source.position.distanceTo(target.position);
                if (dist < 0.1) return; // Skip too close
                // avoid duplicates (simple check)
                if (source.id < target.id) {
                    const mid = source.position.clone().add(target.position).multiplyScalar(0.5).normalize().multiplyScalar(GLOBE_RADIUS + dist * 0.5);
                    curveList.push(new THREE.QuadraticBezierCurve3(source.position, mid, target.position));
                }
            });
        });

        return { localNode: local, others: othersList, curves: curveList };

    }, [realNodes]); // UseMemo ensures this only recalcs when input changes. 
    // Since we use deterministic placement, even if it recalcs, positions won't jump unless IDs change.

    return (
        <group>
            <ambientLight intensity={0.4} color={COLORS.globeGlow} />
            <pointLight position={[20, 20, 20]} intensity={1} color="#ffffff" />
            <pointLight position={[-10, 5, -10]} intensity={0.8} color="#ff0040" />

            <Globe />
            {localNode && <LocalNodePulse position={localNode.position} />}
            <PeersInstanced nodes={others} />
            <ConnectionLines curves={curves} />
            <DataTraffic curves={curves} />
            <Stars radius={150} depth={50} count={3000} factor={4} saturation={0} fade speed={0.3} />

            <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.5} minPolarAngle={Math.PI / 3.5} maxPolarAngle={Math.PI - Math.PI / 3.5} />
        </group>
    );
};

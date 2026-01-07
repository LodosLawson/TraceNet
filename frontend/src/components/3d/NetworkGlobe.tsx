import { useMemo, useRef } from 'react';
import { useFrame, extend } from '@react-three/fiber';
import { Sphere, Stars, OrbitControls, shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';

// --- Constants ---
const GLOBE_RADIUS = 2;
const NODE_COUNT_FALLBACK = 80;

const COLORS = {
    background: '#1a0b0c',
    globeBase: '#000000',      // Pitch black core
    globeGlow: '#d90429',      // Deep Pomegranate Glow
    node: '#ef233c',           // Standard Node Red
    localNode: '#ffb703',      // Gold for YOU
    connection: '#ff4d6d',     // Pinkish connection
    packet: '#ffffff'          // White data packets
};

// --- Shaders ---

// 1. Atmosphere / Fresnel Glow Shader
const AtmosphereMaterial = shaderMaterial(
    {
        color: new THREE.Color(COLORS.globeGlow),
        coefficient: 0.5,
        power: 4.0,
    },
    // Vertex
    `
    varying vec3 vNormal;
    void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
    `,
    // Fragment
    `
    varying vec3 vNormal;
    uniform vec3 color;
    uniform float coefficient;
    uniform float power;
    void main() {
        float intensity = pow(coefficient - dot(vNormal, vec3(0.0, 0.0, 1.0)), power);
        gl_FragColor = vec4(color, 1.0) * intensity;
    }
    `
);

// NOTE: I decided against complex line shaders on LineSegments due to UV complexity. 
// I will implement "Data Particles" as separate instanced meshes traveling the curves.

extend({ AtmosphereMaterial });

// --- Types ---
// --- Types ---
declare global {
    namespace JSX {
        interface IntrinsicElements {
            atmosphereMaterial: any;
        }
    }
}

// --- Helpers ---
const getPosition = (lat: number, lng: number, radius: number) => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = (radius * Math.sin(phi) * Math.sin(theta));
    const y = (radius * Math.cos(phi));
    return new THREE.Vector3(x, y, z);
};


// --- Components ---

const Globe = () => {
    return (
        <group>
            {/* Black Core */}
            <Sphere args={[GLOBE_RADIUS - 0.05, 64, 64]}>
                <meshBasicMaterial color={COLORS.globeBase} />
            </Sphere>

            {/* Fresnel Atmosphere (Glow) */}
            <mesh>
                <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
                <atmosphereMaterial
                    transparent
                    side={THREE.BackSide}
                    blending={THREE.AdditiveBlending}
                />
            </mesh>

            {/* Wireframe Overlay */}
            <Sphere args={[GLOBE_RADIUS + 0.02, 48, 48]}>
                <meshBasicMaterial
                    color={COLORS.globeGlow}
                    wireframe
                    transparent
                    opacity={0.05}
                />
            </Sphere>
        </group>
    );
};

const LocalNodePulse = ({ position }: { position: THREE.Vector3 }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const ringRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        if (meshRef.current) {
            const scale = 1 + Math.sin(t * 3) * 0.2;
            meshRef.current.scale.set(scale, scale, scale);
        }
        if (ringRef.current) {
            // Expanding ring effect
            const ringScale = (t * 2) % 3; // 0 to 3 repeating
            const opacity = 1 - (ringScale / 3);
            ringRef.current.scale.set(ringScale, ringScale, ringScale);
            (ringRef.current.material as THREE.MeshBasicMaterial).opacity = opacity;
        }
    });

    return (
        <group position={position}>
            {/* Core */}
            <mesh ref={meshRef}>
                <sphereGeometry args={[0.08, 16, 16]} />
                <meshBasicMaterial color={COLORS.localNode} />
            </mesh>
            {/* Point Light */}
            <pointLight distance={2} intensity={2} color={COLORS.localNode} />

            {/* Pulse Ring */}
            <mesh ref={ringRef}>
                <ringGeometry args={[0.08, 0.1, 32]} />
                <meshBasicMaterial color={COLORS.localNode} transparent side={THREE.DoubleSide} />
            </mesh>
        </group>
    );
};

const PeersInstanced = ({ nodes }: { nodes: any[] }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const tempObj = new THREE.Object3D();

    useFrame((state) => {
        if (!meshRef.current || nodes.length === 0) return;

        const time = state.clock.getElapsedTime();
        nodes.forEach((node, i) => {
            tempObj.position.copy(node.position);
            const scale = 1 + Math.sin(time + node.id) * 0.1;
            tempObj.scale.set(scale, scale, scale);
            tempObj.updateMatrix();
            meshRef.current!.setMatrixAt(i, tempObj.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    // We skip index 0 (Local Node) for the instanced mesh if we want to render it uniquely
    // But since `nodes` passed here will exclude Local Node (handled by parent logic), we just render all.
    return (
        <instancedMesh ref={meshRef} args={[undefined as any, undefined as any, nodes.length]}>
            <boxGeometry args={[0.04, 0.04, 0.04]} />
            <meshBasicMaterial color={COLORS.node} />
        </instancedMesh>
    );
};

// "Data Packets" - particles moving along the curves
const DataTraffic = ({ curves }: { curves: THREE.QuadraticBezierCurve3[] }) => {
    // We'll use instanced mesh for packets
    const PACKETS_PER_CURVE = 2; // Density
    const TOTAL_PACKETS = curves.length * PACKETS_PER_CURVE;

    const meshRef = useRef<THREE.InstancedMesh>(null);
    const tempObj = new THREE.Object3D();

    // Store offsets [0..1] for each packet
    const offsets = useMemo(() => {
        return new Float32Array(TOTAL_PACKETS).map(() => Math.random());
    }, [curves.length]);

    // Store speeds
    const speeds = useMemo(() => {
        return new Float32Array(TOTAL_PACKETS).map(() => 0.2 + Math.random() * 0.5); // Random speeds
    }, [curves.length]);

    useFrame((_, delta) => {
        if (!meshRef.current || curves.length === 0) return;

        for (let i = 0; i < TOTAL_PACKETS; i++) {
            // Update offset
            offsets[i] += speeds[i] * delta;
            if (offsets[i] > 1) offsets[i] = 0; // Loop

            // Get curve index
            const curveIndex = Math.floor(i / PACKETS_PER_CURVE);
            const curve = curves[curveIndex];

            if (curve) {
                // Get point on curve
                const point = curve.getPoint(offsets[i]);
                tempObj.position.copy(point);
                tempObj.scale.set(1, 1, 1);
                tempObj.updateMatrix();
                meshRef.current.setMatrixAt(i, tempObj.matrix);
            }
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    if (curves.length === 0) return null;

    return (
        <instancedMesh ref={meshRef} args={[undefined as any, undefined as any, TOTAL_PACKETS]}>
            <sphereGeometry args={[0.015, 8, 8]} />
            <meshBasicMaterial color={COLORS.packet} />
        </instancedMesh>
    );
}

const ConnectionLines = ({ curves }: { curves: THREE.QuadraticBezierCurve3[] }) => {
    const geometry = useMemo(() => {
        const points: THREE.Vector3[] = [];
        curves.forEach(curve => {
            points.push(...curve.getPoints(20));
        });
        return new THREE.BufferGeometry().setFromPoints(points);
    }, [curves]);

    if (curves.length === 0) return null;

    return (
        <lineSegments geometry={geometry}>
            <lineBasicMaterial
                color={COLORS.connection}
                transparent
                opacity={0.1}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
            />
        </lineSegments>
    );
};


// --- Main ---

export const NetworkGlobe = ({ realNodes }: { realNodes?: any[] }) => {

    // 1. Process Nodes
    const { localNode, peers, curves } = useMemo(() => {
        // A. Parse or Generate Nodes
        let nodesList: any[] = [];

        if (realNodes && realNodes.length > 0) {
            nodesList = realNodes.map((n, i) => {
                const lat = n.lat !== undefined ? n.lat : (Math.random() - 0.5) * 160;
                const lng = n.lng !== undefined ? n.lng : (Math.random() - 0.5) * 360;
                return {
                    ...n,
                    id: i, // Ensure ID
                    position: getPosition(lat, lng, GLOBE_RADIUS),
                    lat,
                    lng
                };
            });
        } else {
            // Fallback
            nodesList = Array.from({ length: NODE_COUNT_FALLBACK }).map((_, i) => {
                const lat = (Math.random() - 0.5) * 160;
                const lng = (Math.random() - 0.5) * 360;
                return {
                    id: i,
                    position: getPosition(lat, lng, GLOBE_RADIUS),
                    lat,
                    lng,
                    isLocal: i === 0 // Mock first as local
                };
            });
        }

        // B. Identify Local vs Peers
        // Prioritize explicit "local-node" ID, otherwise assume index 0
        const local = nodesList.find(n => n.id === 'local-node') || nodesList[0];
        const remote = nodesList.filter(n => n !== local);

        // C. Generate Curves (From Local to all Remote)
        const curveList: THREE.QuadraticBezierCurve3[] = [];
        if (local && remote.length > 0) {
            remote.forEach(peer => {
                const distance = local.position.distanceTo(peer.position);
                const mid = local.position.clone().add(peer.position).multiplyScalar(0.5);
                const midLength = mid.length();
                mid.normalize().multiplyScalar(midLength + distance * 0.4); // Curve height
                curveList.push(new THREE.QuadraticBezierCurve3(local.position, mid, peer.position));
            });
        }

        return {
            allNodes: nodesList,
            localNode: local,
            peers: remote,
            curves: curveList
        };

    }, [realNodes]);


    return (
        <group>
            {/* Lighting */}
            <ambientLight intensity={0.2} color={COLORS.globeGlow} />
            <pointLight position={[10, 10, 10]} intensity={1} color="#ffffff" />
            <pointLight position={[-10, 5, -10]} intensity={0.8} color="#ff0040" />

            {/* Globe */}
            <Globe />

            {/* Local Node - High Vis */}
            {localNode && <LocalNodePulse position={localNode.position} />}

            {/* Remote Peers - Standard Instanced */}
            <PeersInstanced nodes={peers} />

            {/* Connections */}
            <ConnectionLines curves={curves} />

            {/* Moving Data Packets */}
            <DataTraffic curves={curves} />

            {/* Environment */}
            <Stars radius={150} depth={50} count={5000} factor={4} saturation={0} fade speed={0.5} />

            <OrbitControls
                enableZoom={false}
                enablePan={false}
                autoRotate
                autoRotateSpeed={0.5}
                minPolarAngle={Math.PI / 3.5}
                maxPolarAngle={Math.PI - Math.PI / 3.5}
            />
        </group>
    );
};

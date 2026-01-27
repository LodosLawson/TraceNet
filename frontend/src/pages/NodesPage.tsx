import { useState, useEffect, useRef, useMemo } from 'react';
import { api, type NodeInfo } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Server, Activity, Maximize2, Minimize2, RefreshCw, Wifi } from 'lucide-react';
import Globe from 'react-globe.gl';

interface PageProps {
    onNavigate: (page: string) => void;
}

// Extend NodeInfo to ensure we have required props for visualization, or use union
type VisNode = NodeInfo & {
    lat: number;
    lng: number;
    // visual props
    size?: number;
    color?: string;
    name?: string;
}

export const NodesPage = ({ onNavigate }: PageProps) => {
    const [nodes, setNodes] = useState<VisNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const globeEl = useRef<any>(null);

    const fetchNodes = async () => {
        setLoading(true);
        try {
            // Upgrade: Use getDiscoveredNodes to show ALL known nodes (Meeting Point logic)
            const peers = await api.getDiscoveredNodes();

            // Current User / Local Node
            const localNode: VisNode = {
                id: 'local-node',
                status: 'connected',
                ip: '127.0.0.1',
                url: 'localhost',
                city: 'Your Node',
                country: 'Local',
                lat: 39.9334,
                lng: 32.8597
            };

            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((pos) => {
                    localNode.lat = pos.coords.latitude;
                    localNode.lng = pos.coords.longitude;
                }, () => { }, { timeout: 2000 });
            }

            // Filter peers that have coordinates
            const validPeers = peers
                .filter(p => p.lat !== undefined && p.lng !== undefined && (p.lat !== 0 || p.lng !== 0))
                .map(p => p as VisNode); // Cast to VisNode as we filtered undefineds

            setNodes([localNode, ...validPeers]);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNodes();
        const interval = setInterval(fetchNodes, 10000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (globeEl.current) {
            globeEl.current.controls().autoRotate = true;
            globeEl.current.controls().autoRotateSpeed = 0.5;
        }
    }, [globeEl.current]); // Add globeEl.current to dependency to trigger when ref attaches

    const gData = useMemo(() => {
        const points = nodes.map(node => ({
            ...node,
            size: node.id === 'local-node' ? 0.3 : 0.15,
            color: node.id === 'local-node' ? '#ef4444' : (node.status === 'connected' ? '#22c55e' : '#eab308'),
            name: node.city || node.ip || 'Unknown'
        }));

        const local = nodes.find(n => n.id === 'local-node');
        const arcs = local ? nodes.filter(n => n.id !== 'local-node').map(peer => ({
            startLat: local.lat,
            startLng: local.lng,
            endLat: peer.lat,
            endLng: peer.lng,
            color: peer.status === 'connected' ? ['rgba(34, 197, 94, 0.5)', 'rgba(34, 197, 94, 0.1)'] : ['rgba(234, 179, 8, 0.5)', 'rgba(234, 179, 8, 0.1)'],
            dashLength: 0.4,
            dashGap: 0.2,
            dashAnimateTime: 2000
        })) : [];

        return { points, arcs };
    }, [nodes]);

    return (
        <div className="min-h-screen bg-black text-seed-100 font-sans selection:bg-pomegranate-500 selection:text-white overflow-hidden relative">

            {/* Background Gradient */}
            <div className="absolute inset-0 bg-radial-gradient from-gray-900 to-black z-0 pointer-events-none" />

            {/* 3D Globe Container */}
            <div className={`absolute inset-0 transition-all duration-700 ease-in-out ${isFullscreen ? 'z-50' : 'z-0'}`}>
                <Globe
                    ref={globeEl}
                    globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
                    bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
                    backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"

                    // Points (Nodes)
                    pointsData={gData.points}
                    pointAltitude={0.01}
                    pointColor="color"
                    pointRadius="size"
                    pointResolution={32}
                    pointLabel={(d: any) => `
                        <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px 12px; border-radius: 4px; font-family: sans-serif; border: 1px solid #ef4444;">
                            <div style="font-weight: bold; margin-bottom: 2px;">${d.name}</div>
                            <div style="font-size: 0.8em; opacity: 0.8;">${d.ip}</div>
                            <div style="font-size: 0.8em; color: ${d.status === 'connected' ? '#22c55e' : '#f59e0b'};">${d.status.toUpperCase()}</div>
                        </div>
                    `}

                    // Arcs (Connections)
                    arcsData={gData.arcs}
                    arcColor="color"
                    arcDashLength="dashLength"
                    arcDashGap="dashGap"
                    arcDashAnimateTime="dashAnimateTime"
                    arcStroke={0.5}

                    // Atmosphere
                    atmosphereColor="#ef4444"
                    atmosphereAltitude={0.15}
                />
            </div>

            {/* UI Overlay */}
            <div className={`relative z-10 p-6 md:p-12 pointer-events-none flex flex-col h-screen ${isFullscreen ? 'opacity-0 hover:opacity-100 transition-opacity' : ''}`}>

                {/* Header */}
                <div className="flex items-start justify-between pointer-events-auto">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => onNavigate('landing')}
                            className="p-3 bg-black/50 backdrop-blur-md border border-white/10 rounded-full hover:bg-white/10 transition-colors cursor-pointer group"
                        >
                            <ArrowLeft className="text-seed-200 group-hover:text-white" />
                        </button>
                        <div>
                            <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tighter drop-shadow-2xl">
                                TraceNet <span className="text-pomegranate-500">Global</span>
                            </h1>
                            <div className="flex items-center gap-2 mt-2">
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/30">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-xs font-bold text-green-400">LIVE NETWORK</span>
                                </div>
                                <span className="text-seed-400 text-sm">| {nodes.length} Active Nodes</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={fetchNodes}
                            className="p-3 bg-black/50 backdrop-blur-md border border-white/10 rounded-lg hover:border-pomegranate-500/50 text-white transition-all"
                        >
                            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="p-3 bg-black/50 backdrop-blur-md border border-white/10 rounded-lg hover:border-pomegranate-500/50 text-white transition-all"
                        >
                            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                        </button>
                    </div>
                </div>

                {/* Node List Sidebar (Hidden in Fullscreen usually, or float) */}
                {!isFullscreen && (
                    <div className="mt-auto pointer-events-auto max-w-sm w-full">
                        <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                            <h3 className="text-sm font-bold text-seed-400 uppercase tracking-wider mb-3 sticky top-0 bg-black/0 backdrop-blur-xl">Connected Peers</h3>
                            <div className="space-y-2">
                                <AnimatePresence>
                                    {nodes.map((node, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="group flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10 transition-all cursor-pointer"
                                            onClick={() => {
                                                if (globeEl.current) {
                                                    globeEl.current.pointOfView({ lat: node.lat, lng: node.lng, altitude: 2.5 }, 1000);
                                                }
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-full ${node.id === 'local-node' ? 'bg-pomegranate-500/20 text-pomegranate-500' : 'bg-blue-500/20 text-blue-400'}`}>
                                                    {node.id === 'local-node' ? <Server size={14} /> : <Wifi size={14} />}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-white group-hover:text-pomegranate-400 transition-colors">
                                                        {node.city || 'Unknown Node'}
                                                    </div>
                                                    <div className="text-xs text-seed-500 font-mono">{node.ip}</div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <Activity size={10} className={node.status === 'connected' ? 'text-green-500' : 'text-yellow-500'} />
                                                {node.country && <span className="text-[10px] text-seed-500">{node.country}</span>}
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

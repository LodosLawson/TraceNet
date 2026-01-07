import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { motion } from 'framer-motion';
import { ArrowLeft, Server, Activity, Globe } from 'lucide-react';
// import { Link } from 'react-router-dom';

interface PageProps {
    onNavigate: (page: string) => void;
}

export const NodesPage = ({ onNavigate }: PageProps) => {
    const [nodes, setNodes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNodes = async () => {
            try {
                const peers = await api.getPeers();
                const localNode = {
                    id: 'local-node',
                    status: 'connected',
                    ip: '127.0.0.1',
                    city: 'Local Node',
                    lat: 39.9334,
                    lng: 32.8597
                };
                setNodes([localNode, ...peers]);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchNodes();
        const interval = setInterval(fetchNodes, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen bg-black text-seed-100 p-6 md:p-12 font-sans selection:bg-pomegranate-500 selection:text-white">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => onNavigate('landing')}
                        className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                    >
                        <ArrowLeft className="text-seed-200" />
                    </button>
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pomegranate-500 to-orange-500">
                            Active Nodes
                        </h1>
                        <p className="text-seed-400 text-sm">Network Topography & Status</p>
                    </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {nodes.map((node, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md hover:border-pomegranate-500/50 transition-colors group"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 bg-black/40 rounded-full text-pomegranate-500 group-hover:scale-110 transition-transform">
                                    {node.id === 'local-node' ? <Server /> : <Globe />}
                                </div>
                                <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${node.status === 'connected' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                    {node.status}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="text-lg font-bold truncate" title={node.id}>
                                    {node.id === 'local-node' ? 'Local Node (You)' : `Node ${node.id.substring(0, 8)}...`}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-seed-400">
                                    <Activity size={14} />
                                    <span>{node.ip || 'Unknown IP'}</span>
                                </div>
                                {node.city && (
                                    <div className="text-xs text-seed-500 font-mono mt-2">
                                        📍 {node.city}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>

                {loading && (
                    <div className="flex justify-center mt-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pomegranate-500"></div>
                    </div>
                )}
            </div>
        </div>
    );
};

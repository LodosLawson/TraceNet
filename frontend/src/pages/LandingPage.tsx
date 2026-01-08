
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { motion } from 'framer-motion';
import { NetworkGlobe } from '../components/3d/NetworkGlobe';
import { Cuboid, Activity, Globe2 } from 'lucide-react';

import { Suspense } from 'react';

// ... (in component)
                    <pointLight position={[-10, -10, -10]} intensity={0.5} color="#d90429" />
                    <Suspense fallback={null}>
                        <NetworkGlobe realNodes={nodes} />
                    </Suspense>
                    <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
import { api } from '../services/api';

interface PageProps {
    onNavigate: (page: string) => void;
}

export const LandingPage = ({ onNavigate }: PageProps) => {
    const [loading, setLoading] = useState(false);
    const [newWallet, setNewWallet] = useState<any>(null);

    const [nodes, setNodes] = useState<any[]>([]);
    const [stats, setStats] = useState({
        nodes: 0,
        height: 0,
        tps: 0
    });

    useEffect(() => {
        // Poll for nodes & Stats
        const fetchData = async () => {
            try {
                const peers = await api.getPeers();
                const networkStats = await api.getNetworkStats();

                // Manually add "Local Node" (You)
                // Defaulting to Turkey (User context) for visualization if unknown
                const localNode = {
                    id: 'local-node',
                    status: 'connected',
                    lat: 39.9334,
                    lng: 32.8597,
                    ip: '127.0.0.1',
                    city: 'Local Node'
                };

                // Combine: Local Node + Discovered Peers
                const allNodes = [localNode, ...peers];
                setNodes(allNodes);

                // Update Stats
                setStats({
                    nodes: allNodes.length,
                    height: networkStats?.blockchain?.blockCount || 0,
                    tps: networkStats?.blockchain?.currentTps || 0
                });

                // Debug
                console.log("Visualizing Nodes:", allNodes);
            } catch (e) {
                console.error("Failed to fetch data", e);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleCreateWallet = async () => {
        const nickname = prompt("Enter a nickname for your new wallet:");
        if (!nickname) return;

        setLoading(true);
        try {
            const res = await api.createUser(nickname);
            setNewWallet(res);
            // Auto-mine to confirm
            await api.mine(res.wallet.wallet_id);
            alert(`✅ Wallet Created!\n\nID: ${res.wallet.wallet_id}\n\nPlease check console for credentials if in dev mode.`);
        } catch (err: any) {
            alert("❌ Error creating wallet: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative w-full h-[100dvh] overflow-hidden bg-pomegranate-950">
            {/* 3D Background */}
            <div className="absolute inset-0 z-0">
                <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
                    <ambientLight intensity={0.5} />
                    <pointLight position={[10, 10, 10]} intensity={1} color="#ffb703" />
                    <pointLight position={[-10, -10, -10]} intensity={0.5} color="#d90429" />
                    <NetworkGlobe realNodes={nodes} />
                    <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
                    <Environment preset="city" />
                </Canvas>
            </div>

            {/* Glassmorphic Overlay */}
            <div className="relative z-10 flex flex-col items-center justify-center w-full h-full pointer-events-none">

                {/* Hero Content */}
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="text-center pointer-events-auto"
                >
                    {/* Logo Mockup */}
                    <div className="mb-6 inline-block relative px-4">
                        <div className="absolute inset-0 bg-pomegranate-500 blur-3xl opacity-20 rounded-full"></div>
                        {/* User Provided Logo */}
                        <img
                            src="/tracenet_logo.png"
                            alt="TraceNet Logo"
                            className="relative h-32 md:h-40 mx-auto rounded-2xl shadow-2xl shadow-pomegranate-900/50"
                        />
                        <p className="text-gold-500 tracking-[0.3em] text-xs md:text-sm mt-4 uppercase font-semibold">
                            Secure P2P Neural Network
                        </p>
                    </div>

                    {/* Stats Grid */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5, duration: 1 }}
                        className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mt-8 md:mt-12 px-6 w-full max-w-4xl"
                    >
                        <StatCard icon={<Globe2 />} label="Active Nodes" value={stats.nodes.toLocaleString()} />
                        <StatCard icon={<Cuboid />} label="Block Height" value={`#${stats.height.toLocaleString()}`} />
                        <StatCard icon={<Activity />} label="Network TPS" value={stats.tps.toLocaleString()} />
                    </motion.div>

                    {/* CTA Button */}
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="mt-12 md:mt-16 px-10 py-4 bg-gradient-to-r from-pomegranate-600 to-pomegranate-500 text-white rounded-full font-bold shadow-lg shadow-pomegranate-900/50 hover:shadow-pomegranate-500/30 transition-all border border-white/10"
                    >
                        Launch Visualizer
                    </motion.button>
                </motion.div>
            </div>

            {/* Floating Nav */}
            <motion.div
                initial={{ y: -100 }}
                animate={{ y: 0 }}
                className="absolute top-0 left-0 w-full p-4 md:p-6 flex justify-between items-center z-20 pointer-events-auto bg-gradient-to-b from-black/80 md:from-black/50 to-transparent backdrop-blur-md md:backdrop-blur-none"
            >
                <div className="text-xl md:text-2xl font-bold text-seed-100">Tn.</div>
                <div className="hidden md:flex gap-8 text-sm font-medium text-seed-200">
                    <button onClick={() => onNavigate('nodes')} className="hover:text-white transition-colors cursor-pointer">Nodes</button>
                    <button onClick={() => onNavigate('blocks')} className="hover:text-white transition-colors cursor-pointer">Blocks</button>
                    <button onClick={() => onNavigate('transactions')} className="hover:text-white transition-colors cursor-pointer">Transactions</button>
                </div>
                <button
                    onClick={handleCreateWallet}
                    disabled={loading}
                    className="px-4 py-2 md:px-6 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-sm backdrop-blur-md disabled:opacity-50"
                >
                    {loading ? 'Creating...' : 'Create Wallet'}
                </button>
            </motion.div>

            {/* New Wallet Popup */}
            {newWallet && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto p-4">
                    <div className="bg-pomegranate-950/90 border border-pomegranate-500/30 p-6 md:p-8 rounded-2xl max-w-md w-full text-left relative shadow-2xl">
                        <button onClick={() => setNewWallet(null)} className="absolute top-4 right-4 text-pomegranate-300 hover:text-white">✕</button>
                        <h3 className="text-xl md:text-2xl font-bold text-seed-100 mb-4">Wallet Created!</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs uppercase text-pomegranate-400 font-bold">Wallet ID</label>
                                <div className="bg-black/50 p-3 rounded font-mono text-xs md:text-sm text-seed-200 break-all select-all">
                                    {newWallet.wallet.wallet_id}
                                </div>
                            </div>

                            {newWallet.credentials && (
                                <div>
                                    <label className="text-xs uppercase text-pomegranate-400 font-bold flex items-center gap-2">
                                        Secret Mnemonic <span className="text-red-500 text-[10px]">(SAVE THIS SAFE!)</span>
                                    </label>
                                    <div className="bg-red-950/20 border border-red-500/20 p-3 rounded font-mono text-xs md:text-sm text-pomegranate-200 break-words select-all">
                                        {newWallet.credentials.mnemonic}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="text-xs uppercase text-pomegranate-400 font-bold">Public Key</label>
                                <div className="bg-black/50 p-3 rounded font-mono text-[10px] md:text-xs text-gray-400 break-all select-all">
                                    {newWallet.user.public_key}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setNewWallet(null)}
                            className="w-full mt-6 py-3 bg-pomegranate-600 text-white rounded-lg font-bold hover:bg-pomegranate-500 transition-colors"
                        >
                            I have saved my keys
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const StatCard = ({ icon, label, value }: { icon: any, label: string, value: string }) => (
    <motion.div
        whileHover={{ y: -5, scale: 1.02 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative group flex flex-col items-center p-6 bg-black/30 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
    >
        {/* Shine Effect */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

        {/* Glow Blob */}
        <div className="absolute -inset-1 bg-gradient-to-r from-pomegranate-500/0 via-pomegranate-500/10 to-pomegranate-500/0 blur-xl opacity-0 group-hover:opacity-100 transition-all duration-700" />

        <div className="relative z-10 text-pomegranate-500 mb-3 p-3 bg-white/5 rounded-full ring-1 ring-white/10 group-hover:ring-pomegranate-500/50 transition-all">
            {icon}
        </div>
        <div className="relative z-10 text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-seed-200 tracking-tight">
            {value}
        </div>
        <div className="relative z-10 text-xs text-seed-300 uppercase tracking-[0.2em] mt-2 font-medium">
            {label}
        </div>
    </motion.div>
);

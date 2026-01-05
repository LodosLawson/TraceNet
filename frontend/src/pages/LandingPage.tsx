
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { motion } from 'framer-motion';
import { NetworkGlobe } from '../components/3d/NetworkGlobe';
import { Cuboid, Activity, Globe2 } from 'lucide-react';

import { useState } from 'react';
import { api } from '../services/api';

export const LandingPage = () => {
    const [loading, setLoading] = useState(false);
    const [newWallet, setNewWallet] = useState<any>(null);

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
        <div className="relative w-full h-screen overflow-hidden bg-pomegranate-950">
            {/* 3D Background */}
            <div className="absolute inset-0 z-0">
                <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
                    <ambientLight intensity={0.5} />
                    <pointLight position={[10, 10, 10]} intensity={1} color="#ffb703" />
                    <pointLight position={[-10, -10, -10]} intensity={0.5} color="#d90429" />
                    <NetworkGlobe />
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
                    {/* Logo Mockup (Text for now, Image later) */}
                    <div className="mb-6 inline-block relative">
                        <div className="absolute inset-0 bg-pomegranate-500 blur-3xl opacity-20 rounded-full"></div>
                        <h1 className="relative text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-seed-100 to-pomegranate-500 tracking-tighter">
                            TraceNet
                        </h1>
                        <p className="text-gold-500 tracking-[0.3em] text-sm mt-2 uppercase font-semibold">
                            Secure P2P Neural Network
                        </p>
                    </div>

                    {/* Stats Grid */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5, duration: 1 }}
                        className="grid grid-cols-3 gap-6 mt-12"
                    >
                        <StatCard icon={<Globe2 />} label="Active Nodes" value="3,402" />
                        <StatCard icon={<Cuboid />} label="Block Height" value="#892,101" />
                        <StatCard icon={<Activity />} label="Network TPS" value="12,500" />
                    </motion.div>

                    {/* CTA Button */}
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="mt-16 px-10 py-4 bg-gradient-to-r from-pomegranate-600 to-pomegranate-500 text-white rounded-full font-bold shadow-lg shadow-pomegranate-900/50 hover:shadow-pomegranate-500/30 transition-all border border-white/10"
                    >
                        Launch Visualizer
                    </motion.button>
                </motion.div>
            </div>

            {/* Floating Nav */}
            <motion.div
                initial={{ y: -100 }}
                animate={{ y: 0 }}
                className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-20 pointer-events-auto bg-gradient-to-b from-black/50 to-transparent"
            >
                <div className="text-2xl font-bold text-seed-100">Tn.</div>
                <div className="flex gap-8 text-sm font-medium text-seed-200">
                    <a href="#" className="hover:text-white transition-colors">Nodes</a>
                    <a href="#" className="hover:text-white transition-colors">Blocks</a>
                    <a href="#" className="hover:text-white transition-colors">Transactions</a>
                </div>
                <button
                    onClick={handleCreateWallet}
                    disabled={loading}
                    className="px-6 py-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-sm backdrop-blur-md disabled:opacity-50"
                >
                    {loading ? 'Creating...' : 'Create Wallet'}
                </button>
            </motion.div>

            {/* New Wallet Popup */}
            {newWallet && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto">
                    <div className="bg-pomegranate-950/90 border border-pomegranate-500/30 p-8 rounded-2xl max-w-md w-full text-left relative">
                        <button onClick={() => setNewWallet(null)} className="absolute top-4 right-4 text-pomegranate-300 hover:text-white">✕</button>
                        <h3 className="text-2xl font-bold text-seed-100 mb-4">Wallet Created!</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs uppercase text-pomegranate-400 font-bold">Wallet ID</label>
                                <div className="bg-black/50 p-3 rounded font-mono text-sm text-seed-200 break-all select-all">
                                    {newWallet.wallet.wallet_id}
                                </div>
                            </div>

                            {newWallet.credentials && (
                                <div>
                                    <label className="text-xs uppercase text-pomegranate-400 font-bold flex items-center gap-2">
                                        Secret Mnemonic <span className="text-red-500 text-[10px]">(SAVE THIS SAFE!)</span>
                                    </label>
                                    <div className="bg-red-950/20 border border-red-500/20 p-3 rounded font-mono text-sm text-pomegranate-200 break-words select-all">
                                        {newWallet.credentials.mnemonic}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="text-xs uppercase text-pomegranate-400 font-bold">Public Key</label>
                                <div className="bg-black/50 p-3 rounded font-mono text-xs text-gray-400 break-all select-all">
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
    <div className="flex flex-col items-center p-6 bg-black/40 backdrop-blur-md rounded-2xl border border-white/5 shadow-xl min-w-[160px]">
        <div className="text-pomegranate-500 mb-3">{icon}</div>
        <div className="text-3xl font-bold text-seed-100">{value}</div>
        <div className="text-xs text-seed-200 uppercase tracking-wider mt-1">{label}</div>
    </div>
);

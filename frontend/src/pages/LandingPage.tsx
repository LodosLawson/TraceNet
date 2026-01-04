
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { motion } from 'framer-motion';
import { NetworkGlobe } from '../components/3d/NetworkGlobe';
import { Cuboid, Activity, Globe2 } from 'lucide-react';

export const LandingPage = () => {
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
                <button className="px-6 py-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-sm backdrop-blur-md">
                    Connect Wallet
                </button>
            </motion.div>
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

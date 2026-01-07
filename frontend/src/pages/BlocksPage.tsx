import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { motion } from 'framer-motion';
import { ArrowLeft, Box, Clock, Hash } from 'lucide-react';

interface PageProps {
    onNavigate: (page: string) => void;
}

export const BlocksPage = ({ onNavigate }: PageProps) => {
    const [blocks, setBlocks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBlocks = async () => {
            try {
                // Fetch recent blocks (limit 50)
                const recentBlocks = await api.getBlocks(50);
                setBlocks(recentBlocks);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchBlocks();
        const interval = setInterval(fetchBlocks, 10000); // 10s poll
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen bg-black text-seed-100 p-6 md:p-12 font-sans">
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
                        <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500">
                            Blockchain Ledger
                        </h1>
                        <p className="text-seed-400 text-sm">Immutable History</p>
                    </div>
                </div>

                {/* List */}
                <div className="space-y-4">
                    {blocks.map((block, i) => (
                        <motion.div
                            key={block.hash || i}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-blue-500/20 text-blue-400 rounded-lg">
                                    <Box />
                                </div>
                                <div>
                                    <div className="text-xl font-bold font-mono text-white">
                                        Block #{block.index}
                                    </div>
                                    <div className="text-xs text-seed-500 font-mono mt-1 break-all">
                                        Hash: {block.hash}
                                    </div>
                                    <div className="text-xs text-seed-500 font-mono break-all">
                                        Prev: {block.previousHash}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col md:items-end gap-2 text-sm text-seed-300">
                                <div className="flex items-center gap-2">
                                    <Clock size={16} />
                                    <span>{new Date(block.timestamp).toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Hash size={16} />
                                    <span className="font-bold text-white">{block.transactions?.length || 0} Txns</span>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {loading && (
                    <div className="flex justify-center mt-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                )}
            </div>
        </div>
    );
};

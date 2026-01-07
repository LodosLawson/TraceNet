import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRightLeft, Clock, DollarSign } from 'lucide-react';

interface PageProps {
    onNavigate: (page: string) => void;
}

export const TransactionsPage = ({ onNavigate }: PageProps) => {
    const [txs, setTxs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTxs = async () => {
            try {
                const recent = await api.getRecentTransactions(25);
                setTxs(recent);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchTxs();
        const interval = setInterval(fetchTxs, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen bg-black text-seed-100 p-6 md:p-12 font-sans">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => onNavigate('landing')}
                        className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-colors pointer-events-auto cursor-pointer"
                    >
                        <ArrowLeft className="text-seed-200" />
                    </button>
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-500">
                            Recent Transactions
                        </h1>
                        <p className="text-seed-400 text-sm">Live Value Flow</p>
                    </div>
                </div>

                {/* List */}
                <div className="space-y-4">
                    {txs.map((tx, i) => (
                        <motion.div
                            key={tx.tx_id || i}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-colors"
                        >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-green-500/20 text-green-400 rounded-lg">
                                        <ArrowRightLeft />
                                    </div>
                                    <div className="overflow-hidden">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-bold text-white uppercase px-2 py-0.5 rounded bg-white/10">{tx.type}</span>
                                            <span className="text-xs text-seed-500 font-mono hidden md:block">#{tx.blockHeight}</span>
                                        </div>
                                        <div className="text-xs text-seed-400 font-mono truncate w-48 md:w-auto">
                                            {tx.from_wallet?.substring(0, 16)}... → {tx.to_wallet?.substring(0, 16)}...
                                        </div>
                                        <div className="text-[10px] text-seed-600 font-mono mt-1 truncate">
                                            TxID: {tx.tx_id}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col md:items-end gap-1">
                                    <div className="flex items-center gap-2 text-xl font-bold text-white">
                                        <DollarSign size={20} className="text-green-500" />
                                        <span>{tx.amount?.toLocaleString()}</span>
                                        <span className="text-xs text-seed-500 font-normal">LT</span>
                                    </div>
                                    <div className="text-xs text-seed-500 flex items-center gap-1">
                                        <Clock size={12} />
                                        {new Date(tx.timestamp).toLocaleTimeString()}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}

                    {txs.length === 0 && !loading && (
                        <div className="text-center py-20 text-seed-500">
                            No recent transactions found.
                        </div>
                    )}
                </div>

                {loading && (
                    <div className="flex justify-center mt-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
                    </div>
                )}
            </div>
        </div>
    );
};

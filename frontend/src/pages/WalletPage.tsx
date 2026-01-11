
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../services/api';
import { ArrowLeft, RefreshCw, Wallet, Activity, Clock } from 'lucide-react';

interface PageProps {
    onNavigate: (page: string) => void;
}

export const WalletPage = ({ onNavigate }: PageProps) => {
    const [walletId, setWalletId] = useState('');
    const [loading, setLoading] = useState(false);
    const [walletInfo, setWalletInfo] = useState<any>(null);
    const [error, setError] = useState('');

    const fetchBalance = async () => {
        if (!walletId) return;
        setLoading(true);
        setError('');
        try {
            const info = await api.fetchWalletInfo(walletId);
            setWalletInfo(info);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch wallet info');
            setWalletInfo(null);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-pomegranate-950 text-seed-100 p-6 md:p-12 font-sans relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-pomegranate-600/20 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-gold-500/10 blur-[120px] rounded-full pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl mx-auto relative z-10"
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-12">
                    <button
                        onClick={() => onNavigate('landing')}
                        className="flex items-center gap-2 text-pomegranate-200 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={20} /> Back to Home
                    </button>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-amber-200">
                        Wallet Dashboard
                    </h1>
                </div>

                {/* Login / Search Section */}
                <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-8 mb-8 shadow-2xl">
                    <div className="flex flex-col md:flex-row gap-4">
                        <input
                            type="text"
                            placeholder="Enter Wallet ID (TRN...)"
                            value={walletId}
                            onChange={(e) => setWalletId(e.target.value)}
                            className="flex-1 bg-black/50 border border-white/10 rounded-lg px-6 py-4 text-white focus:outline-none focus:border-pomegranate-500 transition-colors font-mono"
                        />
                        <button
                            onClick={fetchBalance}
                            disabled={loading || !walletId}
                            className="px-8 py-4 bg-pomegranate-600 hover:bg-pomegranate-500 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? <RefreshCw className="animate-spin" /> : 'Check Balance'}
                        </button>
                    </div>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-4 text-red-400 bg-red-950/30 p-3 rounded-lg border border-red-500/20 text-sm"
                        >
                            {error}
                        </motion.div>
                    )}
                </div>

                {/* Wallet Info Display */}
                <AnimatePresence mode="wait">
                    {walletInfo && (
                        <motion.div
                            key="wallet-info"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="grid grid-cols-1 md:grid-cols-3 gap-6"
                        >
                            {/* Available Balance Card (Highlighted) */}
                            <div className="md:col-span-3 bg-gradient-to-br from-pomegranate-900/50 to-black/50 backdrop-blur-xl border border-pomegranate-500/30 rounded-2xl p-8 shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Wallet size={120} />
                                </div>
                                <div className="relative z-10">
                                    <h3 className="text-pomegranate-300 uppercase tracking-widest text-sm font-bold mb-2">Available Balance</h3>
                                    <div className="text-5xl md:text-6xl font-black text-white tracking-tight">
                                        {walletInfo.available_balance.toFixed(8)} <span className="text-2xl text-pomegranate-400 font-normal">TNN</span>
                                    </div>
                                    <div className="mt-4 flex items-center gap-2 text-sm text-pomegranate-200/60">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                        Ready to spend
                                    </div>
                                </div>
                            </div>

                            {/* Standard Balance */}
                            <div className="bg-black/30 backdrop-blur-md border border-white/5 rounded-2xl p-6">
                                <div className="flex items-center gap-3 mb-4 text-pomegranate-300">
                                    <Activity size={20} />
                                    <h3 className="uppercase tracking-wider text-xs font-bold">Confirmed Balance</h3>
                                </div>
                                <div className="text-2xl font-bold text-white">
                                    {walletInfo.balance.toFixed(8)} TNN
                                </div>
                                <p className="text-xs text-gray-500 mt-2">On-chain confirmed funds</p>
                            </div>

                            {/* Pending Deductions */}
                            <div className="bg-black/30 backdrop-blur-md border border-white/5 rounded-2xl p-6">
                                <div className="flex items-center gap-3 mb-4 text-amber-400">
                                    <Clock size={20} />
                                    <h3 className="uppercase tracking-wider text-xs font-bold">Pending Deductions</h3>
                                </div>
                                <div className="text-2xl font-bold text-amber-100">
                                    {walletInfo.pending_deductions.toFixed(8)} TNN
                                </div>
                                <p className="text-xs text-gray-500 mt-2">Used in mempool / social pool</p>
                            </div>

                            {/* Nonce */}
                            <div className="bg-black/30 backdrop-blur-md border border-white/5 rounded-2xl p-6">
                                <div className="flex items-center gap-3 mb-4 text-blue-400">
                                    <RefreshCw size={20} />
                                    <h3 className="uppercase tracking-wider text-xs font-bold">Nonce</h3>
                                </div>
                                <div className="text-2xl font-bold text-blue-100">
                                    {walletInfo.nonce}
                                </div>
                                <p className="text-xs text-gray-500 mt-2">Transaction count</p>
                            </div>

                        </motion.div>
                    )}
                </AnimatePresence>

            </motion.div>
        </div>
    );
};

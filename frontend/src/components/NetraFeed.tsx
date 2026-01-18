import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Share2, Zap, Clock } from 'lucide-react';
import { api } from '../services/api';

// Interface for Post
interface Post {
    content_id: string;
    wallet_id: string;
    content: {
        title?: string;
        description?: string;
        content_url?: string;
        nickname?: string;
    };
    likes_count: number;
    comments_count: number;
    timestamp: number;
}

export const NetraFeed = () => {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [instantMode, setInstantMode] = useState(false); // Toggle for Instant Actions
    const [processing, setProcessing] = useState<string | null>(null); // Track action in progress

    // Fetch Feed
    useEffect(() => {
        loadFeed();
    }, []);

    const loadFeed = async () => {
        try {
            const res = await api.getContentFeed(20, 0);
            if (res && res.contents) {
                setPosts(res.contents);
            }
        } catch (e) {
            console.error("Failed to load feed", e);
        } finally {
            setLoading(false);
        }
    };

    // --- Action Handlers ---

    const handleLike = async (post: Post) => {
        if (processing) return;

        // Mock User Credentials (In real app, get from Context/Storage)
        // ideally prompts user or Uses stored wallet
        const walletId = prompt("Enter your Wallet ID to LIKE:", "TRN...");
        // For demo simplicity using prompt. In production use Context.
        if (!walletId) return;

        setProcessing(post.content_id);

        try {
            // Mock Signature (In real app, use private key)
            const signature = "mock_signature_" + Date.now();
            const publicKey = "mock_public_key";

            console.log(`[NetraFeed] Processing LIKE. Instant Mode: ${instantMode}`);

            const res = await api.likeContent({
                wallet_id: walletId,
                content_id: post.content_id,
                timestamp: Date.now(),
                signature: signature,
                public_key: publicKey,
                instant: instantMode
            });

            if (res.success) {
                // Optimistic Update
                setPosts(current => current.map(p => {
                    if (p.content_id === post.content_id) {
                        return { ...p, likes_count: p.likes_count + 1 };
                    }
                    return p;
                }));

                alert(instantMode ? `⚡ INSTANT Like Sent! TX: ${res.tx_id}` : `🕒 Like Queued (Batch). ID: ${res.tx_id}`);
            }

        } catch (err: any) {
            alert("Error: " + err.message);
        } finally {
            setProcessing(null);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto p-4 space-y-6 pb-24">
            {/* Header / Config */}
            <div className="flex items-center justify-between bg-black/40 backdrop-blur-xl p-4 rounded-2xl border border-white/10 sticky top-4 z-20">
                <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pomegranate-400 to-amber-200">
                    Netra Feed
                </h2>

                {/* Instant Mode Toggle */}
                <button
                    onClick={() => setInstantMode(!instantMode)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all border ${instantMode
                        ? 'bg-amber-500/20 border-amber-500 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                        }`}
                >
                    {instantMode ? <Zap size={16} fill="currentColor" /> : <Clock size={16} />}
                    {instantMode ? 'INSTANT MODE' : 'BATCH MODE'}
                </button>
            </div>

            {/* Feed Content */}
            {loading ? (
                <div className="text-center text-gray-500 py-12">Loading Neural Stream...</div>
            ) : (
                <div className="space-y-6">
                    {posts.length === 0 ? (
                        <div className="text-center text-gray-500 py-12">No signals detected yet.</div>
                    ) : (
                        posts.map(post => (
                            <PostCard
                                key={post.content_id}
                                post={post}
                                onLike={() => handleLike(post)}
                                isInstant={instantMode}
                                isProcessing={processing === post.content_id}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

const PostCard = ({ post, onLike, isInstant, isProcessing }: { post: Post, onLike: () => void, isInstant: boolean, isProcessing: boolean }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="group relative bg-black/60 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-colors"
    >
        {/* Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-pomegranate-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

        <div className="p-6 relative z-10">
            {/* Author */}
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-black border border-white/10 flex items-center justify-center text-xs font-bold text-gray-400">
                    {post.content.nickname?.[0] || '?'}
                </div>
                <div>
                    <div className="text-sm font-bold text-gray-200">
                        {post.content.nickname || 'Anonymous Node'}
                    </div>
                    <div className="text-xs text-gray-500 font-mono">
                        {post.wallet_id.substring(0, 8)}...
                    </div>
                </div>
                <div className="ml-auto text-xs text-gray-600">
                    {new Date(post.timestamp).toLocaleTimeString()}
                </div>
            </div>

            {/* Content */}
            <div className="mb-6">
                <p className="text-gray-300 leading-relaxed text-sm">
                    {post.content.description || "No content data."}
                </p>
                {post.content.content_url && (
                    <div className="mt-4 rounded-lg overflow-hidden border border-white/5">
                        <img src={post.content.content_url} alt="Post content" className="w-full h-48 object-cover opacity-80 hover:opacity-100 transition-opacity" />
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-6 border-t border-white/5 pt-4">
                <button
                    onClick={onLike}
                    disabled={isProcessing}
                    className={`flex items-center gap-2 text-sm font-medium transition-colors ${isInstant ? 'hover:text-amber-400' : 'hover:text-pomegranate-400'
                        } ${isProcessing ? 'opacity-50 cursor-wait' : 'text-gray-400'}`}
                >
                    <Heart size={18} className={isProcessing ? 'animate-pulse' : ''} />
                    <span>{post.likes_count}</span>
                </button>

                <button className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-blue-400 transition-colors">
                    <MessageCircle size={18} />
                    <span>{post.comments_count}</span>
                </button>

                <button className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-green-400 transition-colors ml-auto">
                    <Share2 size={18} />
                </button>
            </div>
        </div>
    </motion.div>
);

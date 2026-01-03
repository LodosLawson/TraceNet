/**
 * Mining Pool System
 * 
 * Manages fair distribution of mining rewards among active nodes.
 * - Tracks active miners per 100-block window
 * - Accumulates transaction fees from blocks
 * - Distributes node share (25% of fees) equally among participants
 * - Anti-sybil: Only one node per IP (enforced at P2P layer)
 */

export interface MiningWindow {
    windowId: number;           // Window number (block 0-99 = window 0, 100-199 = window 1, etc.)
    startBlock: number;         // First block in window
    endBlock: number;           // Last block in window
    totalFeesCollected: number; // Total fees from all transactions in window
    nodeShare: number;          // 25% of fees reserved for nodes
    participants: Set<string>;  // Node IDs that were active in this window
    distributionComplete: boolean;
}

export interface NodeParticipation {
    nodeId: string;
    ip: string;
    walletAddress: string; // NEW: Wallet for reward distribution
    firstSeenBlock: number;
    lastSeenBlock: number;
    blocksActive: number;
}

export class MiningPool {
    private readonly WINDOW_SIZE = 100; // blocks
    private readonly NODE_SHARE_PERCENTAGE = 0.25; // 25% of fees go to nodes

    private currentWindow: MiningWindow;
    private windowHistory: Map<number, MiningWindow> = new Map();
    private activeNodes: Map<string, NodeParticipation> = new Map(); // Current window participants

    constructor() {
        // Initialize first window (blocks 0-99)
        this.currentWindow = {
            windowId: 0,
            startBlock: 0,
            endBlock: 99,
            totalFeesCollected: 0,
            nodeShare: 0,
            participants: new Set(),
            distributionComplete: false
        };

        console.log('[MiningPool] Initialized - Window 0 (Blocks 0-99)');
    }

    /**
     * Register an active node for the current mining window
     */
    addActiveNode(nodeId: string, ip: string, walletAddress: string, currentBlock: number): void {
        // Check if we're in a new window
        this.checkWindowRotation(currentBlock);

        if (!this.activeNodes.has(nodeId)) {
            this.activeNodes.set(nodeId, {
                nodeId,
                ip,
                walletAddress,
                firstSeenBlock: currentBlock,
                lastSeenBlock: currentBlock,
                blocksActive: 1
            });
            this.currentWindow.participants.add(nodeId);
            console.log(`[MiningPool] Node ${nodeId} (IP: ${ip}, Wallet: ${walletAddress}) joined window ${this.currentWindow.windowId}`);
        } else {
            // Update last seen
            const node = this.activeNodes.get(nodeId)!;
            node.lastSeenBlock = currentBlock;
            node.blocksActive++;
        }
    }

    /**
     * Accumulate fees from a block
     */
    accumulateFees(blockIndex: number, totalBlockFees: number): void {
        this.checkWindowRotation(blockIndex);

        this.currentWindow.totalFeesCollected += totalBlockFees;
        this.currentWindow.nodeShare = Math.floor(
            this.currentWindow.totalFeesCollected * this.NODE_SHARE_PERCENTAGE
        );

        console.log(`[MiningPool] Block ${blockIndex}: +${totalBlockFees} units (Total: ${this.currentWindow.totalFeesCollected}, Node Share: ${this.currentWindow.nodeShare})`);
    }

    /**
     * Calculate reward distribution for completed window
     * Returns: Map<walletAddress, rewardAmount>
     */
    calculateDistribution(): Map<string, number> {
        const distribution = new Map<string, number>();
        const participantCount = this.currentWindow.participants.size;

        if (participantCount === 0) {
            console.log('[MiningPool] No participants in window, no distribution');
            return distribution;
        }

        const rewardPerNode = Math.floor(this.currentWindow.nodeShare / participantCount);

        // Use wallet addresses for distribution
        this.activeNodes.forEach(node => {
            if (this.currentWindow.participants.has(node.nodeId)) {
                distribution.set(node.walletAddress, rewardPerNode);
            }
        });

        console.log(`[MiningPool] Distribution: ${this.currentWindow.nodeShare} units / ${participantCount} nodes = ${rewardPerNode} units each`);

        return distribution;
    }

    /**
     * Get current pool status
     */
    getStatus(): {
        currentWindow: number;
        windowProgress: string;
        participants: number;
        totalFees: number;
        nodeShare: number;
        estimatedRewardPerNode: number;
        nextDistribution: number;
    } {
        const participantCount = this.currentWindow.participants.size;
        const estimatedReward = participantCount > 0
            ? Math.floor(this.currentWindow.nodeShare / participantCount)
            : 0;

        return {
            currentWindow: this.currentWindow.windowId,
            windowProgress: `Blocks ${this.currentWindow.startBlock}-${this.currentWindow.endBlock}`,
            participants: participantCount,
            totalFees: this.currentWindow.totalFeesCollected,
            nodeShare: this.currentWindow.nodeShare,
            estimatedRewardPerNode: estimatedReward,
            nextDistribution: this.currentWindow.endBlock + 1
        };
    }

    /**
     * Get list of active participants
     */
    getParticipants(): NodeParticipation[] {
        return Array.from(this.activeNodes.values());
    }

    /**
     * Check if we need to rotate to next window
     */
    private checkWindowRotation(currentBlock: number): void {
        if (currentBlock > this.currentWindow.endBlock) {
            // Complete current window
            this.completeWindow();

            // Start new window
            const newWindowId = this.currentWindow.windowId + 1;
            const newStartBlock = newWindowId * this.WINDOW_SIZE;
            const newEndBlock = newStartBlock + this.WINDOW_SIZE - 1;

            this.currentWindow = {
                windowId: newWindowId,
                startBlock: newStartBlock,
                endBlock: newEndBlock,
                totalFeesCollected: 0,
                nodeShare: 0,
                participants: new Set(),
                distributionComplete: false
            };

            // Clear active nodes for new window
            this.activeNodes.clear();

            console.log(`[MiningPool] ⚡ Window Rotation! New Window ${newWindowId} (Blocks ${newStartBlock}-${newEndBlock})`);
        }
    }

    /**
     * Mark window as complete and save to history
     */
    private completeWindow(): void {
        this.currentWindow.distributionComplete = true;
        this.windowHistory.set(this.currentWindow.windowId, { ...this.currentWindow });

        console.log(`[MiningPool] ✅ Window ${this.currentWindow.windowId} completed:`);
        console.log(`  - Total Fees: ${this.currentWindow.totalFeesCollected} units`);
        console.log(`  - Node Share: ${this.currentWindow.nodeShare} units`);
        console.log(`  - Participants: ${this.currentWindow.participants.size}`);
    }

    /**
     * Get window history (for debugging/stats)
     */
    getWindowHistory(): MiningWindow[] {
        return Array.from(this.windowHistory.values());
    }

    /**
     * Check if distribution is due for current block
     */
    isDistributionDue(blockIndex: number): boolean {
        return (blockIndex + 1) % this.WINDOW_SIZE === 0 && this.currentWindow.participants.size > 0;
    }
}

import crypto from 'crypto';

/**
 * Merkle tree node
 */
interface MerkleNode {
    hash: string;
    left?: MerkleNode;
    right?: MerkleNode;
}

/**
 * Merkle proof for transaction verification
 */
export interface MerkleProof {
    hash: string;
    position: 'left' | 'right';
}

/**
 * Merkle Tree implementation for transaction verification
 */
export class MerkleTree {
    private leaves: string[];
    private root: MerkleNode | null;

    constructor(data: string[]) {
        this.leaves = data.map((item) => this.hashData(item));
        this.root = this.buildTree(this.leaves);
    }

    /**
     * Get Merkle root hash
     */
    getRoot(): string {
        if (!this.root) {
            return '0'.repeat(64);
        }
        return this.root.hash;
    }

    /**
     * Generate Merkle proof for a specific leaf
     */
    getProof(leafIndex: number): MerkleProof[] {
        if (leafIndex < 0 || leafIndex >= this.leaves.length) {
            throw new Error('Invalid leaf index');
        }

        const proof: MerkleProof[] = [];
        let currentIndex = leafIndex;
        let currentLevel = [...this.leaves];

        while (currentLevel.length > 1) {
            const newLevel: string[] = [];
            const levelProof: MerkleProof[] = [];

            for (let i = 0; i < currentLevel.length; i += 2) {
                if (i + 1 < currentLevel.length) {
                    // Pair exists
                    const left = currentLevel[i];
                    const right = currentLevel[i + 1];
                    const combined = this.hashPair(left, right);
                    newLevel.push(combined);

                    // Add to proof if this pair contains our target
                    if (i === currentIndex || i + 1 === currentIndex) {
                        const isLeft = i === currentIndex;
                        levelProof.push({
                            hash: isLeft ? right : left,
                            position: isLeft ? 'right' : 'left',
                        });
                    }
                } else {
                    // Odd node, duplicate it
                    const hash = this.hashPair(currentLevel[i], currentLevel[i]);
                    newLevel.push(hash);

                    if (i === currentIndex) {
                        levelProof.push({
                            hash: currentLevel[i],
                            position: 'right',
                        });
                    }
                }
            }

            proof.push(...levelProof);
            currentLevel = newLevel;
            currentIndex = Math.floor(currentIndex / 2);
        }

        return proof;
    }

    /**
     * Verify Merkle proof
     */
    static verifyProof(
        leaf: string,
        proof: MerkleProof[],
        root: string
    ): boolean {
        const leafHash = crypto.createHash('sha256').update(leaf).digest('hex');
        let currentHash = leafHash;

        for (const proofElement of proof) {
            if (proofElement.position === 'left') {
                currentHash = this.hashPairStatic(proofElement.hash, currentHash);
            } else {
                currentHash = this.hashPairStatic(currentHash, proofElement.hash);
            }
        }

        return currentHash === root;
    }

    /**
     * Build Merkle tree from leaves
     */
    private buildTree(leaves: string[]): MerkleNode | null {
        if (leaves.length === 0) {
            return null;
        }

        // Create leaf nodes
        let nodes: MerkleNode[] = leaves.map((hash) => ({ hash }));

        // Build tree bottom-up
        while (nodes.length > 1) {
            const newLevel: MerkleNode[] = [];

            for (let i = 0; i < nodes.length; i += 2) {
                if (i + 1 < nodes.length) {
                    // Pair exists
                    const left = nodes[i];
                    const right = nodes[i + 1];
                    const parentHash = this.hashPair(left.hash, right.hash);

                    newLevel.push({
                        hash: parentHash,
                        left,
                        right,
                    });
                } else {
                    // Odd node, duplicate it
                    const left = nodes[i];
                    const right = nodes[i];
                    const parentHash = this.hashPair(left.hash, right.hash);

                    newLevel.push({
                        hash: parentHash,
                        left,
                        right,
                    });
                }
            }

            nodes = newLevel;
        }

        return nodes[0];
    }

    /**
     * Hash a single data item
     */
    private hashData(data: string): string {
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    /**
     * Hash a pair of hashes
     */
    private hashPair(left: string, right: string): string {
        const combined = left + right;
        return crypto.createHash('sha256').update(combined).digest('hex');
    }

    /**
     * Static version of hashPair for verification
     */
    private static hashPairStatic(left: string, right: string): string {
        const combined = left + right;
        return crypto.createHash('sha256').update(combined).digest('hex');
    }

    /**
     * Get all leaves
     */
    getLeaves(): string[] {
        return [...this.leaves];
    }

    /**
     * Get tree depth
     */
    getDepth(): number {
        if (!this.root) return 0;

        let depth = 0;
        let nodeCount = this.leaves.length;

        while (nodeCount > 1) {
            nodeCount = Math.ceil(nodeCount / 2);
            depth++;
        }

        return depth;
    }
}

import fs from 'fs';
import path from 'path';
import { Block } from '../blockchain/models/Block';

export class LocalDatabase {
    private dataPath: string;
    private chainFile: string;

    constructor(dataDir: string = './data') {
        this.dataPath = path.resolve(dataDir);
        this.chainFile = path.join(this.dataPath, 'chain.json');

        // Ensure data directory exists
        if (!fs.existsSync(this.dataPath)) {
            fs.mkdirSync(this.dataPath, { recursive: true });
        }
    }

    /**
     * Save chain to disk
     */
    saveChain(chain: Block[]): void {
        try {
            // In a real app we'd append or use LevelDB. 
            // For simple bug fix/prototype, full JSON write is okay for small chains.
            fs.writeFileSync(this.chainFile, JSON.stringify(chain, null, 2));
            console.log(`[Database] Chain saved. Height: ${chain.length}`);
        } catch (error) {
            console.error('[Database] Failed to save chain:', error);
        }
    }

    /**
     * Load chain from disk
     */
    loadChain(): Block[] | null {
        try {
            if (!fs.existsSync(this.chainFile)) {
                return null;
            }

            const data = fs.readFileSync(this.chainFile, 'utf-8');
            const rawChain = JSON.parse(data);

            // Rehydrate Blocks (convert raw objects to Block instances if needed)
            // Or usually Blockchain can accept raw objects if they match interface.
            // But Block methods won't exist on raw objects.
            // We should map them.
            return rawChain.map((b: any) => new Block(b));
        } catch (error) {
            console.error('[Database] Failed to load chain:', error);
            return null;
        }
    }
}

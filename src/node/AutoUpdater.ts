import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class AutoUpdater {
    private checkInterval: NodeJS.Timeout | null = null;
    private readonly CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

    constructor() { }

    public start() {
        // Check if .git directory exists
        const fs = require('fs'); // Dynamic import to avoid top-level require if possible
        if (!fs.existsSync('.git')) {
            console.warn('[AutoUpdater] ⚠️  .git directory not found. Auto-update disabled (Running in Docker/Production?).');
            return;
        }

        console.log('[AutoUpdater] Service started. Checking for updates every 5 minutes.');
        // Initial check after 10 seconds
        setTimeout(() => this.checkForUpdates(), 10000);

        this.checkInterval = setInterval(() => {
            this.checkForUpdates();
        }, this.CHECK_INTERVAL_MS);
    }

    public stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
    }

    private async checkForUpdates() {
        try {
            console.log('[AutoUpdater] Checking for updates...');

            // 1. Fetch remote info
            await execAsync('git fetch');

            // 2. Get local and remote hashes
            const { stdout: localHash } = await execAsync('git rev-parse HEAD');
            const { stdout: remoteHash } = await execAsync('git rev-parse @{u}');

            if (localHash.trim() !== remoteHash.trim()) {
                console.log(`[AutoUpdater] 🚨 New update detected!`);
                console.log(`[AutoUpdater] Local: ${localHash.trim().substring(0, 7)}`);
                console.log(`[AutoUpdater] Remote: ${remoteHash.trim().substring(0, 7)}`);
                console.log('[AutoUpdater] Initiating update sequence...');

                await this.applyUpdate();
            } else {
                console.log('[AutoUpdater] System is up to date.');
            }
        } catch (error) {
            console.error('[AutoUpdater] Failed to check for updates:', error);
            // Don't crash the node just because git check failed
        }
    }

    private async applyUpdate() {
        try {
            console.log('[AutoUpdater] Step 1: Pulling latest code from GitHub...');
            await execAsync('git pull');

            console.log('[AutoUpdater] Step 2: Installing dependencies...');
            await execAsync('npm install');

            console.log('[AutoUpdater] Step 3: Rebuilding application...');
            await execAsync('npm run build');

            console.log('[AutoUpdater] ✅ Update applied successfully!');
            console.log('[AutoUpdater] Restarting node in 3 seconds...');

            setTimeout(() => {
                console.log('[AutoUpdater] 🔄 Restarting...');
                process.exit(0); // Clean exit - process manager (pm2/systemd) will restart
            }, 3000);
        } catch (error) {
            console.error('[AutoUpdater] ❌ Update failed:', error);
            console.log('[AutoUpdater] Continuing with current version...');
        }
    }
}

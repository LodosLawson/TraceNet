/**
 * Bootstrap Nodes Configuration
 * These are trusted, always-on nodes that new nodes connect to automatically
 */
export const BOOTSTRAP_NODES = [
    // Cloud Run Production Node
    'https://tracenet-blockchain-136028201808.us-central1.run.app',

    // Ngrok Development Node (when available)
    'https://rotundly-symphysial-sharonda.ngrok-free.dev',
];

/**
 * Get bootstrap nodes, filtering out self
 */
export function getBootstrapNodes(excludeSelf?: string): string[] {
    return BOOTSTRAP_NODES.filter(node => node !== excludeSelf);
}

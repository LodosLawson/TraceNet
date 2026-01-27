# Node Discovery System

TraceNet V3 uses a hybrid discovery system to ensure nodes can always find each other.

1.  **Gossip Protocol**: Connected nodes share their peer lists with each other automatically.
2.  **Bootstrap Nodes**: Hardcoded nodes in `NetworkConfig.ts`.
3.  **HTTP Seeding (DNS Seeds)**: A fallback system for when all else fails.

## How HTTP Seeding Works

If your node is isolated (0 peers) for more than a few minutes, it will fetch the list of active nodes from a public URL (the "Seed List").

### Setting up a Seed List

1.  Edit `active_nodes.json` in the root of the project with a list of stable, public node URLs.
2.  Push this file to your GitHub repository.
3.  Get the **Raw** URL of that file (e.g., `https://raw.githubusercontent.com/USER/REPO/main/active_nodes.json`).
4.  Update `src/blockchain/config/NetworkConfig.ts` and add this URL to the `DNS_SEEDS` array.

```typescript
DNS_SEEDS: [
    'https://raw.githubusercontent.com/LodosLawson/TraceNet-V3-Clean/main/active_nodes.json',
    'https://your-backup-seed-url.com/nodes.json'
]
```

### Why is this needed?
Nodes that don't know about each other need a "Meeting Point". Since we don't have a central server, a public text file on GitHub acts as the meeting point where nodes can find the IP addresses of other active nodes.

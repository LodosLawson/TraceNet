import requests
import time
import threading

class MinerClient:
    def __init__(self, node_url="http://localhost:3000"):
        self.node_url = node_url
        self.keep_mining = False
        self.mining_thread = None

    def get_status(self):
        try:
            # Try /api/network/stats or similar. Or /rpc/status
            # Based on RPCServer, likely standard endpoints exist.
            # Assuming GET /explorer/stats or similar json
            # Let's try to hit the root or a known endpoint
            response = requests.get(f"{self.node_url}/api/node/stats") 
            if response.status_code == 200:
                return response.json()
            else:
                return {"error": f"Status code: {response.status_code}"}
        except Exception as e:
            return {"error": str(e)}

    def trigger_mine(self, wallet_address):
        """Request the node to mine a block immediately"""
        payload = {
            "method": "mine",
            "params": {
                "miner_wallet": wallet_address
            }
        }
        try:
            response = requests.post(f"{self.node_url}/rpc", json=payload)
            return response.json()
        except Exception as e:
            return {"error": str(e)}

    def start_loop(self, wallet_address, interval=5):
        if self.keep_mining:
            return
        
        self.keep_mining = True
        self.mining_thread = threading.Thread(target=self._mining_loop, args=(wallet_address, interval))
        self.mining_thread.daemon = True
        self.mining_thread.start()

    def stop_loop(self):
        self.keep_mining = False
        if self.mining_thread:
            self.mining_thread.join(timeout=1)

    def _mining_loop(self, wallet_address, interval):
        while self.keep_mining:
            print(f"Triggering mine for {wallet_address}...")
            res = self.trigger_mine(wallet_address)
            print(f"Mine Result: {res}")
            time.sleep(interval)

if __name__ == "__main__":
    client = MinerClient()
    print("Status:", client.get_status())

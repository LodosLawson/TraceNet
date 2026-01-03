import requests

class ExplorerClient:
    def __init__(self, node_url="http://localhost:3000"):
        self.node_url = node_url

    def get_stats(self):
        """Fetch node stats which includes blockchain info"""
        try:
            # Based on RPCServer.ts: router.get('/stats', ...) is likely mounted at /api/node/stats or /rpc/stats
            # Wait, RPCServer usually mounts general routes. 
            # Let's try /api/stats based on standard practice or the code I might have seen.
            # If not found, main.py can allow user to change URL.
            response = requests.get(f"{self.node_url}/api/node/stats")
            if response.status_code == 200:
                return response.json()
            else:
                return {"error": f"Status: {response.status_code}"}
        except Exception as e:
            return {"error": str(e)}

    def get_latest_blocks(self, limit=10):
        """Fetch latest blocks"""
        try:
            response = requests.get(f"{self.node_url}/api/blocks?limit={limit}")
            if response.status_code == 200:
                return response.json()
            return []
        except:
            return []

    def get_balance(self, wallet_address):
        """Fetch wallet balance"""
        try:
            # Endpoint based on RPCServer.ts: router.get('/rpc/balance/:walletId', ...)
            response = requests.get(f"{self.node_url}/rpc/balance/{wallet_address}")
            if response.status_code == 200:
                return response.json()
            return {"error": f"Status: {response.status_code}"}
        except Exception as e:
            return {"error": str(e)}

    def get_feed(self):
        """Fetch content feed"""
        try:
            response = requests.get(f"{self.node_url}/api/content/feed")
            if response.status_code == 200:
                return response.json()
            return []
        except:
            return []

    def post_content(self, payload):
        """Submit new content transaction"""
        try:
            response = requests.post(f"{self.node_url}/api/content/create", json=payload)
            return response.json()
        except Exception as e:
            return {"error": str(e)}

    def send_transfer(self, payload):
        """Submit coin transfer transaction"""
        try:
            # Using the frontend alias endpoint or /rpc/transfer
            response = requests.post(f"{self.node_url}/api/users/transaction", json=payload)
            return response.json()
        except Exception as e:
            return {"error": str(e)}

if __name__ == "__main__":
    client = ExplorerClient()
    print(client.get_stats())

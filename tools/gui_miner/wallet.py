import os
import json
import nacl.signing
import nacl.encoding

class WalletManager:
    def __init__(self, keyfile="wallet.json"):
        self.keyfile = keyfile
        self.private_key = None
        self.public_key = None
        self.load_wallet()

    def generate_wallet(self):
        """Generate a new Ed25519 keypair"""
        signing_key = nacl.signing.SigningKey.generate()
        self.private_key = signing_key.encode(encoder=nacl.encoding.HexEncoder).decode('utf-8')
        self.public_key = signing_key.verify_key.encode(encoder=nacl.encoding.HexEncoder).decode('utf-8')
        self.save_wallet()
        print(f"New wallet generated: {self.public_key}")
        return self.public_key

    def save_wallet(self):
        """Save keys to file"""
        data = {
            "private_key": self.private_key,
            "public_key": self.public_key
        }
        with open(self.keyfile, 'w') as f:
            json.dump(data, f, indent=4)

    def load_wallet(self):
        """Load keys from file if exists"""
        if os.path.exists(self.keyfile):
            try:
                with open(self.keyfile, 'r') as f:
                    data = json.load(f)
                    self.private_key = data.get("private_key")
                    self.public_key = data.get("public_key")
            except Exception as e:
                print(f"Error loading wallet: {e}")

    def get_keys(self):
        return self.public_key, self.private_key

    def sign(self, message):
        """Sign a string message"""
        if not self.private_key:
            return None
        
        try:
            # Decode hex private key to bytes
            priv_bytes = nacl.encoding.HexEncoder.decode(self.private_key)
            signing_key = nacl.signing.SigningKey(priv_bytes)
            
            # Sign the message (bytes)
            signed = signing_key.sign(message.encode('utf-8'))
            
            # Return signature in hex
            return nacl.encoding.HexEncoder.encode(signed.signature).decode('utf-8')
        except Exception as e:
            print(f"Signing error: {e}")
            return None


if __name__ == "__main__":
    wm = WalletManager()
    if not wm.public_key:
        wm.generate_wallet()
    print(f"Current Wallet: {wm.public_key}")

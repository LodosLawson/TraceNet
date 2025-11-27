# TraceNet Messaging & Blockchain Integration Guide

This guide provides specific code examples for the core messaging lifecycle: Sending (Encryption + Blockchain Submission) and Receiving (Inbox + Decryption).

## 1. Sending a Message (Encryption + Add to Blockchain)

This process involves 3 steps:
1.  **Encrypt** the message client-side (using Recipient's Public Key).
2.  **Sign** the transaction (using Sender's Private Key).
3.  **Send** to the Blockchain Node (via API).

### JavaScript Example
```javascript
const { box, randomBytes } = require('tweetnacl');
const { decodeUTF8, encodeBase64, decodeBase64 } = require('tweetnacl-util');

// Configuration
const NODE_URL = 'http://localhost:3000';
const myWallet = {
    address: 'TRN_SENDER...',
    privateKey: '...', // Transaction Signing Key
    encryptionPrivateKey: '...' // Message Decryption Key
};
const recipient = {
    address: 'TRN_RECIPIENT...',
    encryptionPublicKey: '...' // Recipient's Encryption Key
};

async function sendMessage(messageContent) {
    // --- STEP 1: ENCRYPTION (Client-Side) ---
    // Generate a one-time nonce
    const nonce = randomBytes(box.nonceLength);
    
    // Encrypt message using: Message + Nonce + Recipient's Public Key + My Private Key
    const encryptedRaw = box(
        decodeUTF8(messageContent),
        nonce,
        decodeBase64(recipient.encryptionPublicKey),
        decodeBase64(myWallet.encryptionPrivateKey)
    );

    // Pack nonce + message together
    const fullEncryptedMessage = encodeBase64(nonce) + ':' + encodeBase64(encryptedRaw);
    console.log('🔒 Message Encrypted:', fullEncryptedMessage);

    // --- STEP 2: PREPARE & SIGN TRANSACTION ---
    // Note: The actual signing happens inside the SDK or manually with Ed25519
    // Here we assume we have a helper or SDK for signing
    // For raw API usage, we send the encrypted message and the node validates the signature
    
    const payload = {
        from_wallet: myWallet.address,
        to_wallet: recipient.address,
        encrypted_message: fullEncryptedMessage,
        sender_public_key: '...', // My Public Key
        sender_signature: '...'   // Signature of the transaction data
    };

    // --- STEP 3: ADD TO BLOCKCHAIN (Send to Node) ---
    try {
        const response = await fetch(`${NODE_URL}/api/messaging/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (result.success) {
            console.log('✅ Message added to Blockchain!');
            console.log('Transaction ID:', result.tx_id);
        } else {
            console.error('❌ Failed:', result.error);
        }
    } catch (error) {
        console.error('Network Error:', error);
    }
}

sendMessage("Hello TraceNet! 🚀");
```

### Python Example
```python
import requests
import nacl.utils
from nacl.public import PrivateKey, PublicKey, Box
from base64 import b64encode, b64decode

# Configuration
NODE_URL = 'http://localhost:3000'
my_private_key = PrivateKey(b64decode('...')) # My Encryption Private Key
recipient_public_key = PublicKey(b64decode('...')) # Recipient Encryption Public Key

def send_message(message_content):
    # --- STEP 1: ENCRYPTION (Client-Side) ---
    # Create a Box for encryption
    box = Box(my_private_key, recipient_public_key)
    
    # Encrypt
    encrypted = box.encrypt(message_content.encode('utf-8'))
    
    # Format: Nonce:Message (Base64 encoded)
    # PyNaCl handles nonce automatically in the encrypted output object, 
    # but we usually need to separate them for our specific protocol format if needed.
    # For simplicity here, we assume standard base64 output.
    encrypted_message_str = b64encode(encrypted).decode('utf-8')
    
    print(f"🔒 Encrypted: {encrypted_message_str}")

    # --- STEP 2: ADD TO BLOCKCHAIN ---
    payload = {
        'from_wallet': 'TRN_SENDER...',
        'to_wallet': 'TRN_RECIPIENT...',
        'encrypted_message': encrypted_message_str,
        'sender_public_key': '...',
        'sender_signature': '...' # Sign transaction here
    }

    response = requests.post(f'{NODE_URL}/api/messaging/send', json=payload)
    result = response.json()

    if result.get('success'):
        print(f"✅ Message added to Blockchain! TX ID: {result['tx_id']}")
    else:
        print(f"❌ Failed: {result.get('error')}")

send_message("Hello from Python! 🐍")
```

---

## 2. Receiving Messages (Inbox + Decryption)

This process involves 2 steps:
1.  **Fetch** encrypted messages from the Blockchain Node.
2.  **Decrypt** them client-side (using My Private Key).

### JavaScript Example
```javascript
async function checkInbox() {
    // --- STEP 1: FETCH FROM BLOCKCHAIN ---
    const walletId = 'TRN_MY_WALLET...';
    const response = await fetch(`${NODE_URL}/api/messaging/inbox/${walletId}`);
    const data = await response.json();

    console.log(`📬 Found ${data.messages.length} messages`);

    // --- STEP 2: DECRYPT (Client-Side) ---
    data.messages.forEach(msg => {
        try {
            // Parse Nonce:Message format
            const [nonceBase64, contentBase64] = msg.encrypted_content.split(':');
            const nonce = decodeBase64(nonceBase64);
            const content = decodeBase64(contentBase64);
            const senderPubKey = decodeBase64(msg.sender_public_key); // Need sender's key to open box

            // Open the Box
            const decryptedRaw = box.open(
                content,
                nonce,
                senderPubKey,
                decodeBase64(myWallet.encryptionPrivateKey)
            );

            if (!decryptedRaw) throw new Error('Decryption failed');

            const decryptedText = decodeUTF8(decryptedRaw);
            console.log(`[${msg.from}]: ${decryptedText}`);

        } catch (err) {
            console.error('Failed to decrypt message:', err);
        }
    });
}
```

### Python Example
```python
def check_inbox():
    # --- STEP 1: FETCH FROM BLOCKCHAIN ---
    wallet_id = 'TRN_MY_WALLET...'
    response = requests.get(f'{NODE_URL}/api/messaging/inbox/{wallet_id}')
    data = response.json()

    print(f"📬 Found {len(data['messages'])} messages")

    # --- STEP 2: DECRYPT (Client-Side) ---
    for msg in data['messages']:
        try:
            encrypted_content = b64decode(msg['encrypted_content'])
            sender_pub_key = PublicKey(b64decode(msg['sender_public_key']))
            
            # Create Box with Sender's Public Key and My Private Key
            box = Box(my_private_key, sender_pub_key)
            
            # Decrypt
            decrypted_text = box.decrypt(encrypted_content).decode('utf-8')
            print(f"[{msg['from']}]: {decrypted_text}")
            
        except Exception as e:
            print(f"Failed to decrypt: {e}")
```

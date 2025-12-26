
import { KeyManager } from '../src/blockchain/crypto/KeyManager';
import { InnerTransaction } from '../src/blockchain/models/Transaction';
// import fetch from 'node-fetch'; // Global fetch in Node 20

const API_URL = 'https://tracenet-blockchain-136028201808.us-central1.run.app';

// Helper to sort object keys
function sortObject(obj: any): any {
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
        return obj;
    }
    return Object.keys(obj)
        .sort()
        .reduce((result: any, key) => {
            result[key] = sortObject(obj[key]);
            return result;
        }, {});
}

async function verifyAutoMiner() {
    console.log(`Testing Auto-Miner against ${API_URL}`);

    // 1. Generate Identity
    const senderKeys = KeyManager.generateKeyPair();
    const senderAddress = KeyManager.deriveAddress(senderKeys.publicKey);
    console.log(`Sender: ${senderAddress}`);

    // 2. Create FAST Message (Should be mined in ~10s by Auto-Miner)
    const fastMsg: InnerTransaction = {
        type: 'PRIVATE_MESSAGE' as any,
        from_wallet: senderAddress,
        to_wallet: senderAddress, // Self send
        amount: 0.00002, // FAST FEE
        timestamp: Date.now(),
        nonce: 1,
        payload: { content: "Auto-Miner Delivery Verification" },
        sender_public_key: senderKeys.publicKey,
        signature: ''
    };

    // 3. Sign
    const signable = sortObject({
        amount: fastMsg.amount,
        from_wallet: fastMsg.from_wallet,
        max_wait_time: fastMsg.max_wait_time,
        nonce: fastMsg.nonce,
        payload: fastMsg.payload,
        sender_public_key: fastMsg.sender_public_key,
        timestamp: fastMsg.timestamp,
        to_wallet: fastMsg.to_wallet,
        type: fastMsg.type
    });
    fastMsg.signature = KeyManager.sign(JSON.stringify(signable), senderKeys.privateKey);

    // 4. Send
    console.log("Sending FAST message...");
    const sendRes = await fetch(`${API_URL}/api/messaging/pool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fastMsg)
    });
    const sendJson = await sendRes.json();
    console.log("Send Result:", sendJson);

    console.log("Message sent. Waiting 25 seconds for Auto-Miner...");
    await new Promise(r => setTimeout(r, 25000));

    // 5. Check Pool
    console.log("Checking pool dump...");
    const res = await fetch(`${API_URL}/api/debug/pool-dump`);
    const dump: any = await res.json();

    // Find our message
    const myMsg = dump.messages.find((m: any) => m.id === `${senderAddress}:1`);

    if (myMsg) {
        console.error("FAILURE: Message IS STILL IN POOL. Auto-Miner did not pick it up.");
        console.log("Pool State:", JSON.stringify(dump, null, 2));
    } else {
        console.log("SUCCESS: Message is GONE from pool.");

        // 6. Verify Delivery (Check Inbox)
        console.log("Verifying delivery in Inbox...");
        // Wait a bit more for indexing
        await new Promise(r => setTimeout(r, 5000));

        const inboxRes = await fetch(`${API_URL}/api/messaging/inbox/${senderAddress}`);
        const inboxData: any = await inboxRes.json();
        const delivered = inboxData.messages.find((m: any) => m.id === `${senderAddress}:1`);

        if (delivered) {
            console.log("✅ VERIFICATION PASSED: Message Delivered to Inbox.");
        } else {
            console.error("❌ CRITICAL FAILURE: Message left pool but NOT found in Inbox (Black Hole!).");
            console.log("Inbox Data:", JSON.stringify(inboxData, null, 2));
        }
    }
}

verifyAutoMiner().catch(console.error);


import { SocialPool } from '../src/node/SocialPool';
import { Mempool } from '../src/node/Mempool';
import { SocialService } from '../src/services/SocialService';
import { Blockchain } from '../src/blockchain/core/Blockchain';
import { ContentService } from '../src/services/ContentService';
import { TransactionType } from '../src/blockchain/models/Transaction';

// Mock classes
class MockBlockchain extends Blockchain {
    constructor() {
        super('SYSTEM', {} as any);
    }
    getChain() { return []; }
}

class MockContentService extends ContentService {
    getContent(id: string) {
        return {
            id,
            owner_wallet: 'CREATOR_WALLET',
            content_hash: 'hash',
            timestamp: Date.now()
        } as any;
    }
}

async function runTest() {
    console.log('🧪 Starting Social Batching Test...');

    // 1. Setup
    const mempool = new Mempool();
    const socialPool = new SocialPool(mempool);
    const blockchain = new MockBlockchain();
    const socialService = new SocialService(blockchain, mempool, socialPool);
    const contentService = new MockContentService(blockchain, mempool);

    socialService.setContentService(contentService);

    // 2. Perform Actions
    console.log('\n[Action] User A likes Content X');
    const likeResult = socialService.likeContent({
        wallet_id: 'USER_A',
        content_id: 'CONTENT_X'
    });
    console.log('Like Result:', likeResult.status);

    console.log('\n[Action] User B comments on Content X');
    const commentResult = socialService.commentOnContent({
        wallet_id: 'USER_B',
        content_id: 'CONTENT_X',
        comment_text: 'Nice!'
    });
    console.log('Comment Result:', commentResult.status);

    // 3. Verify Mempool is Empty (Transactions are queued in SocialPool)
    const pendingTxV1 = mempool.getTransactions();
    console.log(`\nMempool Size (Immediate): ${pendingTxV1.length}`);
    if (pendingTxV1.length === 0) {
        console.log('✅ PASS: Mempool is empty immediately (as expected).');
    } else {
        console.error('❌ FAIL: Mempool should be empty!');
    }

    // 4. Force Flush SocialPool (Simulate 10 mins)
    console.log('\n[System] Forcing SocialPool Flush...');
    socialPool.forceFlush();

    // 5. Verify Mempool has BATCH transaction
    const pendingTxV2 = mempool.getTransactions();
    console.log(`Mempool Size (After Flush): ${pendingTxV2.length}`);

    if (pendingTxV2.length === 1 && pendingTxV2[0].type === TransactionType.BATCH) {
        console.log('✅ PASS: Mempool contains 1 BATCH transaction.');

        const batchTx = pendingTxV2[0];
        const innerTxs = batchTx.payload.transactions;
        console.log(`Batch contains ${innerTxs.length} inner transactions.`);

        // We expect 4 inner transactions:
        // 1. Like (User A -> Creator)
        // 2. Like Fee (User A -> Treasury)
        // 3. Comment (User B -> Creator)
        // 4. Comment Fee (User B -> Treasury)

        if (innerTxs.length === 4) {
            console.log('✅ PASS: Batch contains correct number of inner transactions (4).');

            // Check types
            const types = innerTxs.map((t: any) => t.type);
            console.log('Inner Types:', types);
            if (types.includes('LIKE') && types.includes('COMMENT')) {
                console.log('✅ PASS: Batch contains LIKE and COMMENT types.');
            } else {
                console.error('❌ FAIL: Missing inner types.');
            }
        } else {
            console.error(`❌ FAIL: Expected 4 inner txs, got ${innerTxs.length}`);
        }

    } else {
        console.error('❌ FAIL: Mempool does not contain BATCH transaction or has extra items.', pendingTxV2);
    }

    console.log('\nTest Complete.');
    process.exit(0);
}

runTest().catch(console.error);

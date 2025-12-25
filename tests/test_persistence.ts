
import { Blockchain } from '../src/blockchain/core/Blockchain';
import { LocalDatabase } from '../src/database/LocalDatabase';
import { ValidatorPool } from '../src/consensus/ValidatorPool';
import { Block } from '../src/blockchain/models/Block';
import fs from 'fs';
import path from 'path';

async function runTest() {
    console.log('--- Testing Persistence ---');

    const dbPath = './test_data';
    const dbFile = path.resolve(dbPath, 'chain.json');
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    if (fs.existsSync(dbPath)) fs.rmdirSync(dbPath);

    const db = new LocalDatabase(dbPath);
    const validatorPool = new ValidatorPool();
    const blockchain = new Blockchain('SYSTEM', validatorPool);

    // Check Genesis
    if (blockchain.getLatestBlock().index !== 0) {
        throw new Error('Genesis not created');
    }
    console.log('Genesis created.');

    // Create a fake block 1
    const genesis = blockchain.getLatestBlock();
    const block1 = Block.create(
        1,
        genesis.hash,
        [],
        'SYSTEM',
        'root',
        undefined,
        Date.now() + 1000
    );

    // Forcefully push block to chain to bypass validation for persistence test
    (blockchain as any).chain.push(block1);
    console.log('Block 1 forcefully added for persistence test.');

    // Save
    const chainToSave = blockchain.getChain();
    console.log(`Saving chain of length ${chainToSave.length}`);
    db.saveChain(chainToSave);

    // RESTORE
    console.log('Restoring from new instance...');
    const blockchain2 = new Blockchain('SYSTEM', new ValidatorPool());
    const loaded = db.loadChain();

    if (!loaded) throw new Error('Failed to load chain');
    console.log(`Loaded chain length: ${loaded.length}`);

    // Restore
    const success = blockchain2.restoreChain(loaded);
    if (!success) throw new Error('Restore failed');

    const head2 = blockchain2.getLatestBlock();
    console.log(`Restored head index: ${head2.index}`);

    if (head2.index !== 1) throw new Error(`Restored head index mismatch. Expected 1, got ${head2.index}`);
    if (head2.hash !== block1.hash) throw new Error('Restored hash mismatch');

    console.log('✅ Persistence verification PASSED.');

    // Cleanup
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    if (fs.existsSync(dbPath)) fs.rmdirSync(dbPath);
}

runTest().catch(console.error);

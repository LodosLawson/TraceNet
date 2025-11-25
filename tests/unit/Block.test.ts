import { Block } from '../../src/blockchain/models/Block';
import { Transaction, TransactionType } from '../../src/blockchain/models/Transaction';

describe('Block', () => {
    describe('Genesis Block', () => {
        it('should create a valid genesis block', () => {
            const genesisBlock = Block.createGenesis('SYSTEM');

            expect(genesisBlock.index).toBe(0);
            expect(genesisBlock.previous_hash).toBe('0'.repeat(64));
            expect(genesisBlock.transactions).toHaveLength(0);
            expect(genesisBlock.validator_id).toBe('SYSTEM');
            expect(genesisBlock.hash).toBeDefined();
        });

        it('should have valid merkle root for empty transactions', () => {
            const genesisBlock = Block.createGenesis('SYSTEM');

            expect(genesisBlock.merkle_root).toBe('0'.repeat(64));
        });
    });

    describe('Block Creation', () => {
        it('should create a new block with transactions', () => {
            const transactions: Transaction[] = [
                {
                    tx_id: 'tx1',
                    from_wallet: 'wallet1',
                    to_wallet: 'wallet2',
                    type: TransactionType.TRANSFER,
                    payload: {},
                    amount: 1000,
                    fee: 10,
                    timestamp: Date.now(),
                    signatures: [],
                },
            ];

            const block = Block.create(1, 'previous_hash', transactions, 'validator1', 'state_root');

            expect(block.index).toBe(1);
            expect(block.previous_hash).toBe('previous_hash');
            expect(block.transactions).toHaveLength(1);
            expect(block.validator_id).toBe('validator1');
            expect(block.merkle_root).not.toBe('0'.repeat(64));
        });

        it('should calculate correct merkle root', () => {
            const transactions: Transaction[] = [
                {
                    tx_id: 'tx1',
                    from_wallet: 'wallet1',
                    to_wallet: 'wallet2',
                    type: TransactionType.TRANSFER,
                    payload: {},
                    amount: 1000,
                    fee: 10,
                    timestamp: Date.now(),
                    signatures: [],
                },
                {
                    tx_id: 'tx2',
                    from_wallet: 'wallet2',
                    to_wallet: 'wallet3',
                    type: TransactionType.TRANSFER,
                    payload: {},
                    amount: 500,
                    fee: 5,
                    timestamp: Date.now(),
                    signatures: [],
                },
            ];

            const block = Block.create(1, 'previous_hash', transactions, 'validator1', 'state_root');
            const calculatedRoot = Block.calculateMerkleRoot(transactions);

            expect(block.merkle_root).toBe(calculatedRoot);
        });
    });

    describe('Block Validation', () => {
        it('should validate a correct block', () => {
            const block = Block.createGenesis('SYSTEM');
            const validation = block.validate();

            expect(validation.valid).toBe(true);
            expect(validation.error).toBeUndefined();
        });

        it('should reject block with invalid index', () => {
            const block = Block.createGenesis('SYSTEM');
            block.index = -1;

            const validation = block.validate();

            expect(validation.valid).toBe(false);
            expect(validation.error).toContain('index');
        });

        it('should reject block with invalid previous_hash format', () => {
            const block = Block.createGenesis('SYSTEM');
            block.previous_hash = 'invalid_hash';

            const validation = block.validate();

            expect(validation.valid).toBe(false);
            expect(validation.error).toContain('previous_hash');
        });

        it('should reject block with merkle root mismatch', () => {
            const transactions: Transaction[] = [
                {
                    tx_id: 'tx1',
                    from_wallet: 'wallet1',
                    to_wallet: 'wallet2',
                    type: TransactionType.TRANSFER,
                    payload: {},
                    amount: 1000,
                    fee: 10,
                    timestamp: Date.now(),
                    signatures: [],
                },
            ];

            const block = Block.create(1, '0'.repeat(64), transactions, 'validator1', 'state_root');
            block.merkle_root = 'wrong_merkle_root';

            const validation = block.validate();

            expect(validation.valid).toBe(false);
            expect(validation.error).toContain('Merkle root');
        });
    });

    describe('Block Hashing', () => {
        it('should calculate consistent hash', () => {
            const block = Block.createGenesis('SYSTEM');
            const hash1 = block.calculateHash();
            const hash2 = block.calculateHash();

            expect(hash1).toBe(hash2);
        });

        it('should produce different hashes for different blocks', () => {
            const block1 = Block.createGenesis('SYSTEM');
            const block2 = Block.create(1, block1.hash!, [], 'validator1', 'state_root');

            expect(block1.hash).not.toBe(block2.calculateHash());
        });

        it('should update hash when signature is set', () => {
            const block = Block.createGenesis('SYSTEM');
            const originalHash = block.hash;

            block.setSignature('new_signature');

            expect(block.hash).not.toBe(originalHash);
            expect(block.signature).toBe('new_signature');
        });
    });

    describe('Serialization', () => {
        it('should serialize to JSON correctly', () => {
            const block = Block.createGenesis('SYSTEM');
            const json = block.toJSON();

            expect(json.index).toBe(block.index);
            expect(json.previous_hash).toBe(block.previous_hash);
            expect(json.hash).toBe(block.hash);
            expect(json.validator_id).toBe(block.validator_id);
        });

        it('should deserialize from JSON correctly', () => {
            const originalBlock = Block.createGenesis('SYSTEM');
            const json = originalBlock.toJSON();
            const deserializedBlock = new Block(json);

            expect(deserializedBlock.index).toBe(originalBlock.index);
            expect(deserializedBlock.hash).toBe(originalBlock.hash);
            expect(deserializedBlock.merkle_root).toBe(originalBlock.merkle_root);
        });
    });
});

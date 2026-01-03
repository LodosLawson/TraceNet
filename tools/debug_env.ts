
import dotenv from 'dotenv';
import { KeyManager } from '../src/blockchain/crypto/KeyManager';

dotenv.config();

console.log('--- DEBUG ENV ---');
console.log('GENESIS_VALIDATOR_PUBLIC_KEY:', `"${process.env.GENESIS_VALIDATOR_PUBLIC_KEY}"`);
console.log('VALIDATOR_PRIVATE_KEY:', `"${process.env.VALIDATOR_PRIVATE_KEY}"`);

if (process.env.VALIDATOR_PRIVATE_KEY) {
    const keyPair = KeyManager.getKeyPairFromPrivate(process.env.VALIDATOR_PRIVATE_KEY);
    console.log('Derived Public Key from Private Key:', keyPair.publicKey);
}

console.log('--- END DEBUG ---');

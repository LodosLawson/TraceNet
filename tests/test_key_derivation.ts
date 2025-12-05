import * as bip39 from 'bip39';
import { HDKey } from '@scure/bip32';
import * as nacl from 'tweetnacl';

console.log('=== Testing Backend Key Derivation (Updated) ===\n');

// Test mnemonic
const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';

console.log('Mnemonic:', testMnemonic.substring(0, 50) + '...\n');

// Backend derivation (NEW METHOD - @scure/bip32)
const seed = bip39.mnemonicToSeedSync(testMnemonic);
console.log('Seed (first 32 bytes):', Buffer.from(seed.slice(0, 32)).toString('hex'));

const encryptionPath = "m/44'/0'/0'/1'/0'";
const hdkey = HDKey.fromMasterSeed(seed);
const derived = hdkey.derive(encryptionPath);

if (!derived.privateKey) {
    throw new Error('Failed to derive encryption private key');
}

const boxKeyPair = nacl.box.keyPair.fromSecretKey(derived.privateKey.slice(0, 32));

const encryptionPublicKey = Buffer.from(boxKeyPair.publicKey).toString('hex');
const encryptionPrivateKey = Buffer.from(boxKeyPair.secretKey).toString('hex');

console.log('\n--- Backend Encryption Keys (@scure/bip32) ---');
console.log('Public Key:', encryptionPublicKey);
console.log('Private Key:', encryptionPrivateKey.substring(0, 32) + '...');

console.log('\n✅ Backend now uses @scure/bip32 - should match frontend!');
console.log('\nFrontend should use the EXACT same code:');
console.log('```typescript');
console.log('const seed = bip39.mnemonicToSeedSync(mnemonic);');
console.log('const hdkey = HDKey.fromMasterSeed(seed);');
console.log('const derived = hdkey.derive("m/44\'/0\'/0\'/1\'/0\'");');
console.log('const boxKeyPair = nacl.box.keyPair.fromSecretKey(derived.privateKey.slice(0, 32));');
console.log('```');

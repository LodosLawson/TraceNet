import { KeyManager } from '../blockchain/crypto/KeyManager';

console.log('\n🔐 TraceNet Validator Setup Tool');
console.log('================================');

// Generate new keypair
const keyPair = KeyManager.generateKeyPair();

console.log('\n✅ New Validator Identity Generated:\n');
console.log(`Validator Private Key: ${keyPair.privateKey}`);
console.log(`Validator Public Key:  ${keyPair.publicKey}`);
console.log(`Validator ID:          validator_${keyPair.publicKey.substring(0, 8)}`);

console.log('\n📝 Instructions:');
console.log('1. Copy the "Validator Private Key" above.');
console.log('2. Open your .env file.');
console.log('3. Add or Update the following lines:');
console.log('\n   NODE_ROLE=validator');
console.log(`   VALIDATOR_PRIVATE_KEY=${keyPair.privateKey}`);
console.log(`   VALIDATOR_ID=validator_${keyPair.publicKey.substring(0, 8)}`);
console.log('\n4. Restart your node.');
console.log('================================\n');

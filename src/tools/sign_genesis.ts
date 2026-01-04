
import { KeyManager } from '../blockchain/crypto/KeyManager';

const privateKey = 'e8fbde3f1da3390f47cbf940c510bd16bdb25cac999e15a74027d76716cf525425b86a85774d69db8af2a782f7fbf9c062054c48d4c2c3fac9ec4b10c54f43d7';
const genesisHash = '69beb187c9383d9016ef61f0640d5722b07f022fbf41085586a45b2e9cd8e1bc';

const signature = KeyManager.sign(genesisHash, privateKey);
console.log(`New Signature: ${signature}`);

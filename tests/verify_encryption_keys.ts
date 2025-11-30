import { WalletService } from '../src/wallet/WalletService';
import { UserService } from '../src/services/user/UserService';
import { AuthService } from '../src/services/auth/AuthService';
import { AirdropService } from '../src/wallet/AirdropService';
import { KeyManager } from '../src/blockchain/crypto/KeyManager';

console.log('=== Testing Encryption Key Infrastructure ===\n');

// Test 1: Wallet creation includes encryption public key
console.log('Test 1: Wallet Creation with Encryption Key');
const walletService = new WalletService('test_encryption_key');
const walletResult = walletService.createWallet('test_user_1');

console.log('✓ Wallet created');
console.log(`  - Public Key (Ed25519): ${walletResult.wallet.public_key.substring(0, 20)}...`);
console.log(`  - Encryption Public Key (Curve25519): ${walletResult.wallet.encryption_public_key.substring(0, 20)}...`);
console.log(`  - Keys are different: ${walletResult.wallet.public_key !== walletResult.wallet.encryption_public_key}`);

if (walletResult.wallet.public_key === walletResult.wallet.encryption_public_key) {
    console.log('❌ FAIL: Signing and encryption keys should be different!');
    process.exit(1);
}
console.log('✅ PASS: Encryption key is separate from signing key\n');

// Test 2: User registration stores encryption key
console.log('Test 2: User Registration with Encryption Key');
const authService = new AuthService();
const airdropService = new AirdropService();
const userService = new UserService(authService, walletService, airdropService);

const userResult = await userService.createUser({
    nickname: 'alice_test',
    email: 'alice@test.com',
    password: 'password123',
    first_name: 'Alice',
    last_name: 'Test'
});

console.log('✓ User created');
console.log(`  - User ID: ${userResult.user.system_id}`);
console.log(`  - Encryption Public Key: ${userResult.user.encryption_public_key?.substring(0, 20)}...`);
console.log(`  - Messaging Privacy: ${userResult.user.messaging_privacy}`);

if (!userResult.user.encryption_public_key) {
    console.log('❌ FAIL: User should have encryption public key!');
    process.exit(1);
}

if (userResult.user.messaging_privacy !== 'followers') {
    console.log('❌ FAIL: Default privacy should be "followers"!');
    process.exit(1);
}
console.log('✅ PASS: User has encryption key with correct default privacy\n');

// Test 3: Get encryption key by different identifiers
console.log('Test 3: Get Encryption Key by Identifier');

// By user ID
const keyByUserId = userService.getEncryptionPublicKey(userResult.user.system_id);
console.log(`✓ Retrieved by User ID: ${keyByUserId?.encryption_public_key.substring(0, 20)}...`);

// By nickname
const keyByNickname = userService.getEncryptionPublicKey('alice_test');
console.log(`✓ Retrieved by Nickname: ${keyByNickname?.encryption_public_key.substring(0, 20)}...`);

// By wallet ID
const keyByWallet = userService.getEncryptionPublicKey(userResult.user.wallet_ids[0]);
console.log(`✓ Retrieved by Wallet ID: ${keyByWallet?.encryption_public_key.substring(0, 20)}...`);

if (!keyByUserId || !keyByNickname || !keyByWallet) {
    console.log('❌ FAIL: Should be able to retrieve key by all identifiers!');
    process.exit(1);
}

if (keyByUserId.encryption_public_key !== keyByNickname.encryption_public_key ||
    keyByNickname.encryption_public_key !== keyByWallet.encryption_public_key) {
    console.log('❌ FAIL: All methods should return the same key!');
    process.exit(1);
}
console.log('✅ PASS: Can retrieve encryption key by user ID, nickname, and wallet ID\n');

// Test 4: Update messaging privacy
console.log('Test 4: Update Messaging Privacy');
const privacyUpdated = userService.updateMessagingPrivacy(userResult.user.system_id, 'public');
console.log(`✓ Privacy updated to "public": ${privacyUpdated}`);

const updatedUser = userService.getUser(userResult.user.system_id);
console.log(`✓ Verified privacy setting: ${updatedUser?.messaging_privacy}`);

if (!privacyUpdated || updatedUser?.messaging_privacy !== 'public') {
    console.log('❌ FAIL: Privacy should be updated to "public"!');
    process.exit(1);
}
console.log('✅ PASS: Messaging privacy can be updated\n');

// Test 5: QR Code generation
console.log('Test 5: QR Code Data Generation');
const qrData = userService.generateQRCodeData(userResult.user.system_id);
console.log('✓ QR Data generated:');
console.log(`  - Type: ${qrData?.type}`);
console.log(`  - Nickname: ${qrData?.nickname}`);
console.log(`  - Wallet: ${qrData?.wallet_id.substring(0, 15)}...`);
console.log(`  - Encryption Key: ${qrData?.encryption_public_key.substring(0, 20)}...`);
console.log(`  - Privacy: ${qrData?.messaging_privacy}`);

if (!qrData || qrData.type !== 'tracenet_messaging') {
    console.log('❌ FAIL: QR data should be generated correctly!');
    process.exit(1);
}
console.log('✅ PASS: QR code data generated successfully\n');

// Test 6: Message encryption/decryption with new keys
console.log('Test 6: Message Encryption/Decryption');
const bobResult = await userService.createUser({
    nickname: 'bob_test',
    email: 'bob@test.com',
    password: 'password123',
    first_name: 'Bob'
});

const bobWallet = walletService.getWallet(bobResult.user.wallet_ids[0]);
const bobMnemonic = walletService.getMnemonic(bobWallet!.wallet_id);
const bobKeys = KeyManager.generateWalletFromMnemonic(bobMnemonic!);

const aliceWallet = walletService.getWallet(userResult.user.wallet_ids[0]);
const aliceMnemonic = walletService.getMnemonic(aliceWallet!.wallet_id);
const aliceKeys = KeyManager.generateWalletFromMnemonic(aliceMnemonic!);

const testMessage = "Hello Bob! This is an encrypted message 🔐";
const encrypted = KeyManager.encryptForUser(
    testMessage,
    aliceKeys.encryptionPrivateKey,
    bobKeys.encryptionPublicKey
);

console.log(`✓ Alice encrypted message: ${encrypted.substring(0, 40)}...`);

const decrypted = KeyManager.decryptFromUser(
    encrypted,
    bobKeys.encryptionPrivateKey,
    aliceKeys.encryptionPublicKey
);

console.log(`✓ Bob decrypted message: "${decrypted}"`);

if (decrypted !== testMessage) {
    console.log('❌ FAIL: Decrypted message should match original!');
    process.exit(1);
}
console.log('✅ PASS: Message encryption/decryption works correctly\n');

// Test 7: Verify encryption keys != signing keys
console.log('Test 7: Verify Key Separation');
console.log(`✓ Alice signing key: ${aliceKeys.publicKey.substring(0, 20)}...`);
console.log(`✓ Alice encryption key: ${aliceKeys.encryptionPublicKey.substring(0, 20)}...`);
console.log(`✓ Keys are different: ${aliceKeys.publicKey !== aliceKeys.encryptionPublicKey}`);

if (aliceKeys.publicKey === aliceKeys.encryptionPublicKey) {
    console.log('❌ FAIL: Signing and encryption keys must be different!');
    process.exit(1);
}

if (aliceKeys.privateKey === aliceKeys.encryptionPrivateKey) {
    console.log('❌ FAIL: Private keys must be different!');
    process.exit(1);
}
console.log('✅ PASS: Encryption keys are properly separated from signing keys\n');

console.log('='.repeat(70));
console.log('✅ ALL TESTS PASSED!');
console.log('='.repeat(70));
console.log('\nEncryption Key Infrastructure is working correctly:');
console.log('  ✓ Wallets store encryption public keys');
console.log('  ✓ Users have encryption keys and privacy settings');
console.log('  ✓ Encryption keys can be retrieved by multiple identifiers');
console.log('  ✓ Messaging privacy can be updated');
console.log('  ✓ QR code data can be generated');
console.log('  ✓ Message encryption/decryption works');
console.log('  ✓ Encryption keys are separate from signing keys');

process.exit(0);

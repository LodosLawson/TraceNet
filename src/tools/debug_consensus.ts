
import { Blockchain } from '../blockchain/core/Blockchain';
import { ValidatorPool } from '../consensus/ValidatorPool';
import { NETWORK_CONFIG } from '../blockchain/config/NetworkConfig';
import { KeyManager } from '../blockchain/crypto/KeyManager';

async function diagnose() {
    console.log("🔍 Starting Consensus Diagnosis...");

    // 1. Initialize Components
    const validatorPool = new ValidatorPool();
    // Assuming the first validator in the list is the system one
    const systemValidatorId = NETWORK_CONFIG.initialValidators[0];
    const blockchain = new Blockchain(systemValidatorId, validatorPool);

    console.log(`\n📊 Network Config:`);
    console.log(`- Genesis Validator ID: ${systemValidatorId ? systemValidatorId.substring(0, 10) + '...' : 'UNDEFINED'}`);
    console.log(`- Initial Validators: ${NETWORK_CONFIG.initialValidators.length}`);
    NETWORK_CONFIG.initialValidators.forEach((v, idx) => {
        console.log(`  > Validator ${idx}: ${v.substring(0, 10)}...`);
    });

    console.log(`\n🛡️  Validator Pool State (Fresh):`);
    // Manually register initial validators
    for (const v of NETWORK_CONFIG.initialValidators) {
        // ID is the Public Key
        validatorPool.registerValidator(v, 'genesis', v);
    }

    console.log(`- Registered Validators: ${validatorPool.getAllValidators().length}`);

    // Check who is online (Should be 0 initially)
    let online = validatorPool.getOnlineValidators();
    console.log(`- Online Validators (Pre-Heartbeat): ${online.length}`);

    // TEST 1: If I am SYSTEM, and I send a heartbeat, do I become online?
    console.log(`\n❤️  Sending Heartbeat for '${systemValidatorId}' at Height 1...`);
    // NOTE: Heartbeat now takes (id, height)
    validatorPool.updateHeartbeat(systemValidatorId, 1);

    online = validatorPool.getOnlineValidators();
    console.log(`- Online Validators (Post-Heartbeat): ${online.length}`);
    if (online.length > 0) {
        console.log(`  > ${online[0].validator_id} is ONLINE.`);
    } else {
        console.error(`  ❌ FAILED: Validator not online after heartbeat!`);
    }

    // TEST 2: Selection Logic
    const latestBlock = { index: 1, hash: '00000abc', timestamp: Date.now() };
    const nextIndex = latestBlock.index + 1;
    console.log(`\n🎲 Simulating Selection for Block ${nextIndex}...`);

    const producer = validatorPool.selectBlockProducer(nextIndex, latestBlock.hash, 0); // Round 0
    if (producer) {
        console.log(`  ✅ Selected Producer: ${producer.validator_id}`);
        console.log(`  > Is it us? ${producer.validator_id === systemValidatorId ? 'YES' : 'NO'}`);
    } else {
        console.log(`  ❌ NO PRODUCER SELECTED. (Active count: ${validatorPool.getOnlineCount()})`);
    }

    // TEST 3: Round Rotation
    console.log(`\n🔄 Simulating Rounds 0-3...`);
    for (let r = 0; r < 4; r++) {
        const p = validatorPool.selectBlockProducer(nextIndex, latestBlock.hash, r);
        console.log(`  Round ${r}: ${p ? p.validator_id.substring(0, 10) : 'null'}`);
    }

}

diagnose().catch(console.error);

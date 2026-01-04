
import { GenesisValidator } from '../blockchain/core/GenesisValidator';
import { GENESIS_BLOCK_DATA } from '../blockchain/config/GenesisBlock';

import { Block } from '../blockchain/models/Block';

console.log('Verifying Genesis Block...');

const genesisBlock = new Block(GENESIS_BLOCK_DATA);
const result = GenesisValidator.validate(genesisBlock);

GenesisValidator.displayValidation(result);

if (result.valid) {
    console.log('SUCCESS: Genesis Block is valid.');
    process.exit(0);
} else {
    console.log('FAILURE: Genesis Block is invalid.');
    process.exit(1);
}

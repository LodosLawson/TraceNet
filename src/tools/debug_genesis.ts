
const { Blockchain } = require('../blockchain/core/Blockchain');

console.log('--- Genesis Debugger ---');

// Mock dependencies if Blockchain requires them
// Looking at Blockchain.ts might be needed, but usually it has defaults or simple constructor
const blockchain = new Blockchain();
const genesis = blockchain.getChain()[0];

console.log('Genesis Block Details:');
console.log('Index:', genesis.index);
console.log('Timestamp:', genesis.timestamp);
console.log('PreviousHash:', genesis.previousHash);
console.log('Hash:', genesis.hash);
console.log('Validator:', genesis.validator);
console.log('Transactions Length:', genesis.transactions.length);
console.log('------------------------');

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const https_1 = __importDefault(require("https"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Mainnet URL from BootstrapNodes.ts and previous context
const MAINNET_URL = 'https://tracenet-blockchain-136028201808.us-central1.run.app';
function fetchAccounts() {
    return new Promise((resolve, reject) => {
        console.log(`Connecting to Mainnet: ${MAINNET_URL}...`);
        https_1.default.get(`${MAINNET_URL}/rpc/accounts`, (res) => {
            let data = '';
            // A chunk of data has been received.
            res.on('data', (chunk) => {
                data += chunk;
            });
            // The whole response has been received.
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed && Array.isArray(parsed.accounts)) {
                        resolve(parsed.accounts);
                    }
                    else {
                        reject(new Error('Invalid response format from Mainnet'));
                    }
                }
                catch (e) {
                    reject(e);
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}
async function generateBalanceReport() {
    var _a;
    try {
        const accounts = await fetchAccounts();
        console.log(`Successfully fetched ${accounts.length} active accounts from Mainnet.`);
        // 1. Group by Balance
        const balanceGroups = new Map(); // Balance -> Count
        const balanceDetails = new Map(); // Balance -> Addresses[]
        for (const account of accounts) {
            const bal = account.balance;
            balanceGroups.set(bal, (balanceGroups.get(bal) || 0) + 1);
            if (!balanceDetails.has(bal)) {
                balanceDetails.set(bal, []);
            }
            (_a = balanceDetails.get(bal)) === null || _a === void 0 ? void 0 : _a.push(account.address);
        }
        // 2. Sort decending by Balance
        const sortedBalances = Array.from(balanceGroups.entries()).sort((a, b) => b[0] - a[0]);
        // 3. Generate Markdown Report
        let report = `# TraceNet User Balance Report (Mainnet)\n\n`;
        report += `**Source:** [TraceNet Mainnet](${MAINNET_URL})\n`;
        report += `**Total Users:** ${accounts.length}\n`;
        report += `**Generated:** ${new Date().toISOString()}\n\n`;
        report += `## Balance Distribution\n\n`;
        report += `| Balance (TNN) | User Count |\n`;
        report += `|--------------:|:-----------|\n`;
        for (const [balance, count] of sortedBalances) {
            report += `| ${balance.toLocaleString()} | ${count} |\n`;
        }
        report += `\n## Detailed Breakdown\n\n`;
        for (const [balance, count] of sortedBalances) {
            report += `### ${balance.toLocaleString()} TNN (${count} Users)\n`;
            const addresses = balanceDetails.get(balance) || [];
            // Show limited list if huge
            if (addresses.length > 50) {
                report += `- ${addresses.slice(0, 50).join('\n- ')}\n- ... and ${addresses.length - 50} more\n`;
            }
            else {
                report += `- ${addresses.join('\n- ')}\n`;
            }
            report += '\n';
        }
        const reportPath = path_1.default.resolve('BALANCE_REPORT.md');
        fs_1.default.writeFileSync(reportPath, report);
        console.log(`Report generated at: ${reportPath}`);
    }
    catch (error) {
        console.error("Failed to generate report:", error);
        process.exit(1);
    }
}
generateBalanceReport();

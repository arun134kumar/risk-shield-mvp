const fs = require('fs');
const path = require('path');

const generateDataset = () => {
    const transactions = [];
    const types = ['CREDIT', 'DEBIT'];
    const now = Date.now();
    
    // Normal Profile (Salary, Groceries, Rent, Utilities)
    for (let i = 1; i <= 150; i++) {
        const isDebit = Math.random() > 0.3;
        transactions.push({
            id: 'TXN-NORM-' + now + i,
            timestamp: new Date(now - i * 86400000).toISOString(),
            description: isDebit ? 'POS/Amazon' : 'UPI/Salary',
            amount: isDebit ? Math.floor(Math.random() * 5000) + 100 : Math.floor(Math.random() * 100000) + 5000,
            type: isDebit ? 'DEBIT' : 'CREDIT',
            sourceAccount: isDebit ? 'Uploaded Account' : 'Employer Inc',
            destAccount: isDebit ? 'Retailer XYZ' : 'Uploaded Account',
            balance: 100000,
            riskScore: 0,
            signals: []
        });
    }

    // Suspicious Multi-Hop Profile (Planted)
    // A -> B -> C -> Mule (ATM)
    const suspicionDate = new Date(now - 10000000).toISOString();
    transactions.push({ id: 'DEMO-S1', timestamp: suspicionDate, description: 'UPI/Unknown Sender', amount: 49999, type: 'CREDIT', sourceAccount: 'Suspicious A', destAccount: 'Uploaded Account', balance: 150000, riskScore: 85, signals: [{type: 'high_value', score: 30}] });
    transactions.push({ id: 'DEMO-S2', timestamp: suspicionDate, description: 'UPI/To Mule', amount: 49999, type: 'DEBIT', sourceAccount: 'Uploaded Account', destAccount: 'Suspicious B', balance: 100001, riskScore: 85, signals: [{type: 'rapid_transfer', score: 40}] });
    
    // Suspicious ATM Cash Out
    transactions.push({ id: 'DEMO-ATM1', timestamp: suspicionDate, description: 'ATM CASH WITHDRAWAL - KORAMANGALA', amount: 10000, type: 'DEBIT', sourceAccount: 'Uploaded Account', destAccount: 'ATM / Cash', balance: 90001, riskScore: 65, signals: [{type: 'atm_hotspot', score: 30}] });
    transactions.push({ id: 'DEMO-ATM2', timestamp: suspicionDate, description: 'ATM WDL HSR LAYOUT', amount: 39900, type: 'DEBIT', sourceAccount: 'Uploaded Account', destAccount: 'ATM / Cash', balance: 50101, riskScore: 90, signals: [{type: 'atm_hotspot', score: 50}] });

    const data = {
        transactions,
        metadata: { generatedAt: new Date().toISOString() }
    };
    
    const outPath = path.join(__dirname, 'synthetic_dataset.json');
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
    console.log(`Dataset generated at ${outPath}`);
};

generateDataset();

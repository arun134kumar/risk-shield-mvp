// syntheticGenerator.js
// Simulates transaction chains and complaints for demo purposes

const generateTransactions = (count = 50) => {
    const transactions = [];
    const baseLat = 28.7041; // Delhi
    const baseLng = 77.1025;
    
    for (let i = 0; i < count; i++) {
        const isFraud = Math.random() < 0.2; // 20% likely to be fraud
        const amount = isFraud ? (Math.random() * 1000 + 49000).toFixed(2) : (Math.random() * 5000 + 100).toFixed(2);
        // Fraudsters often use numbers close to whole like 49,999.00
        
        transactions.push({
            id: `txn_${i}`,
            sourceAccount: `acc_${Math.floor(Math.random() * 10)}`,
            destAccount: `acc_${Math.floor(Math.random() * 20) + 10}`,
            amount: parseFloat(amount),
            timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
            isFraudFlag: isFraud,
            location: {
                lat: baseLat + (Math.random() - 0.5) * 0.1,
                lng: baseLng + (Math.random() - 0.5) * 0.1,
            }
        });
    }
    return transactions;
};

const generateComplaints = () => {
    return [
        { id: 'c1', type: 'UPI Fraud', amountLost: 50000, account: 'acc_12' },
        { id: 'c2', type: 'Phishing', amountLost: 10000, account: 'acc_15' }
    ];
};

module.exports = {
    generateTransactions,
    generateComplaints
};

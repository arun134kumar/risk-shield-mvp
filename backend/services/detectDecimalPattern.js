// detectDecimalPattern.js
// Identifies transactions ending in .00 or just below whole numbers like 49,999

const detectDecimalPattern = (transactions) => {
    const flaggedIds = [];
    transactions.forEach(txn => {
        const amountStr = txn.amount.toString();
        // Flag if amount is large and ends in .00 or is close to a round number (e.g., 49999, 9999)
        if (txn.amount >= 10000) {
            if (amountStr.endsWith('.00') || amountStr.match(/999$/)) {
                flaggedIds.push(txn.id);
            }
        }
    });
    return flaggedIds;
};

module.exports = detectDecimalPattern;

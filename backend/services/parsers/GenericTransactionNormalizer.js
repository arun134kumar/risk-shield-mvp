const { normalizeDate } = require('../../utils/dateUtils');

class GenericTransactionNormalizer {
    /**
     * Normalizes bank-specific transaction objects into the generic format used by the dashboard.
     * @param {Array} transactions Array of rich transaction objects from a BankParser
     * @returns {Array} Array of normalized transactions
     */
    static normalize(transactions) {
        return transactions.map(txn => {
            const isDebit = txn.debit > 0;
            const type = isDebit ? 'DEBIT' : 'CREDIT';
            const amount = isDebit ? txn.debit : txn.credit;
            
            // For DEBIT: source is the Uploaded Account, dest is Counterparty
            // For CREDIT: source is Counterparty, dest is Uploaded Account
            let sourceAccount = 'Uploaded Account';
            let destAccount = 'Uploaded Account';
            
            if (isDebit) {
                destAccount = txn.counterparty || 'Unknown Counterparty';
            } else {
                sourceAccount = txn.counterparty || 'Unknown Counterparty';
            }
            
            // Format description to be compatible with existing ATM parsing rules
            // If it's a UPI transaction, we ensure it doesn't get flagged as ATM just because WDL is present
            let description = txn.narration;
            
            // Extract UTR/RRN if available
            let utr = txn.transactionId || null;
            if (!utr) {
                const utrMatch = description.match(/(?:UTR|REF|RRN)[\s\-\:]*([A-Za-z0-9]{8,20})/i);
                if (utrMatch) utr = utrMatch[1];
            }

            return {
                id: txn.id || 'TXN-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                caseId: null, // to be populated later
                sender: sourceAccount,
                receiver: destAccount,
                UTR: utr,
                RRN: utr, // often interchangeable in statements
                amount: amount,
                timestamp: normalizeDate(txn.valueDate) || txn.valueDate,
                type: type,
                narration: description,
                bank: 'SBI', // known in this parser
                location: null,
                atmId: null,
                // Extra context kept for backward compatibility with frontend
                description: description,
                sourceAccount: sourceAccount,
                destAccount: destAccount,
                balance: txn.balance,
                paymentMode: txn.paymentMode,
                transactionType: txn.transactionType,
                riskScore: 0
            };
        });

    }
}

module.exports = GenericTransactionNormalizer;

const { normalizeDate } = require('../../utils/dateUtils');
const { Transaction } = require('../../models/DataModels');

class GenericTransactionNormalizer {
    /**
     * Normalizes bank-specific transaction objects into the generic format used by the dashboard.
     * @param {Array} transactions Array of rich transaction objects from a BankParser
     * @returns {Array} Array of normalized transactions
     */
    static normalize(transactions) {
        return transactions.map(txn => {
            const isDebit = txn.debit > 0;
            const direction = isDebit ? 'DEBIT' : 'CREDIT';
            const amount = isDebit ? txn.debit : txn.credit;
            
            // For DEBIT: source is the Uploaded Account, dest is Counterparty
            // For CREDIT: source is Counterparty, dest is Uploaded Account
            let sourceAccountId = 'Uploaded Account';
            let counterpartyAccountId = 'Unknown Counterparty';
            
            if (isDebit) {
                counterpartyAccountId = txn.counterparty || 'Unknown Counterparty';
            } else {
                sourceAccountId = txn.counterparty || 'Unknown Counterparty';
                counterpartyAccountId = 'Uploaded Account';
            }
            
            // Format description to be compatible with existing ATM parsing rules
            // If it's a UPI transaction, we ensure it doesn't get flagged as ATM just because WDL is present
            let description = txn.narration || '';
            
            // Extract UTR/RRN if available
            let referenceId = txn.transactionId || null;
            if (!referenceId) {
                const utrMatch = description.match(/(?:UTR|REF|RRN)[\s\-\:]*([A-Za-z0-9]{8,20})/i);
                if (utrMatch) referenceId = utrMatch[1];
            }

            const date = normalizeDate(txn.valueDate) || txn.valueDate;

            return new Transaction({
                id: txn.id || 'TXN-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                statementId: null,
                sourceAccountId: sourceAccountId,
                counterpartyAccountId: counterpartyAccountId,
                date: date,
                valueDate: txn.valueDate || null,
                postDate: txn.postDate || null,
                amount: amount,
                debit: txn.debit || 0,
                credit: txn.credit || 0,
                direction: direction,
                transactionType: txn.transactionType || null,
                paymentMode: txn.paymentMode || null,
                referenceId: referenceId,
                transactionReference: referenceId,
                description: description,
                narration: txn.narration || '',
                sender: direction === 'DEBIT' ? sourceAccountId : (txn.sender || sourceAccountId),
                receiver: direction === 'CREDIT' ? sourceAccountId : (txn.receiver || counterpartyAccountId),
                counterparty: txn.counterparty || 'Unknown Counterparty',
                bankCode: txn.bankCode || 'SBI', // known in this parser
                upiId: txn.upiId || null,
                balance: txn.balance !== undefined ? txn.balance : null,
                balanceAfter: txn.balance !== undefined ? txn.balance : null,
                location: txn.location || null,
                parserConfidence: txn.parserConfidence || 1.0
            });
        });

    }
}

module.exports = GenericTransactionNormalizer;

class SBIParser {
    static parse(text) {
        console.log(`[RiskShield] SBIParser started`);
        const accountInfo = this.extractAccountInfo(text);
        const statementSummary = this.extractStatementSummary(text);
        
        const { transactions, validation } = this.extractTransactions(text, statementSummary);
        
        return {
            accountInfo,
            transactions,
            statementSummary,
            validation,
            metadata: {
                parserUsed: 'SBIParser',
                transactionsParsed: transactions.length,
                debitParsed: transactions.filter(t => t.debit > 0).length,
                creditParsed: transactions.filter(t => t.credit > 0).length
            }
        };
    }

    static extractField(text, labelRegex) {
        // Matches the label, optional spaces/colons/dashes, optional newline, then captures the rest of the line
        const regex = new RegExp(`(?:${labelRegex})[\\s\\-:]*(?:[\\r\\n]+)?([^\\r\\n]+)`, 'i');
        const match = text.match(regex);
        if (match && match[1]) {
            let val = match[1].trim();
            if (val.length < 2 || /^(?:Account|Address|Bank|Branch|IFSC|MICR|Customer|CIF|Statement|Opening|Closing)/i.test(val)) {
                return null;
            }
            return val;
        }
        return null;
    }

    static extractAccountInfo(text) {
        const info = {
            name: 'Not available in statement',
            address: 'Not available in statement',
            bank: 'Not available in statement',
            branch: 'Not available in statement',
            branchCode: 'Not available in statement',
            accountNumber: 'Not available in statement',
            ifsc: 'Not available in statement',
            statementPeriod: 'Not available in statement',
            openingBalance: null,
            closingBalance: null
        };

        const nameVal = this.extractField(text, 'Welcome|Account Name|Account Holder Name|Customer Name');
        if (nameVal) info.name = nameVal;

        const addressMatch = text.match(/Not Available[\s\r\n]+([\s\S]+?)Date of Statement/i);
        if (addressMatch) {
            info.address = addressMatch[1].replace(/[\r\n]+/g, ' ').trim();
        } else {
            const addrVal = this.extractField(text, 'Address');
            if (addrVal) info.address = addrVal;
        }

        if (/State Bank of India/i.test(text)) {
            info.bank = "State Bank of India";
        } else {
            const bankVal = this.extractField(text, 'Bank Name|Bank');
            if (bankVal) info.bank = bankVal;
        }

        const branchNameMatch = text.match(/Branch Name[\s\S]{1,50}?\b([A-Z]{3,20})\b/i);
        if (branchNameMatch) {
            info.branch = branchNameMatch[1];
        } else {
            const branchVal = this.extractField(text, 'Branch Name|Branch');
            if (branchVal) info.branch = branchVal;
        }
        
        const branchCodeMatch = text.match(/Branch Code[\s\S]{1,50}?\b(\d{3,5})\b/i);
        if (branchCodeMatch) {
            info.branchCode = branchCodeMatch[1];
        }

        const accMatch = text.match(/Account Number[\s\S]{1,200}?\b(\d{11,18})\b[\s\S]{1,50}?\b(\d{11,18})\b/i);
        if (accMatch) {
            info.accountNumber = '••••••' + accMatch[2].slice(-4);
        } else {
            const fallbackAccMatch = text.match(/(?:Account Number|Account No)[\s\-\:]*(?:[\r\n]+)?([A-Z0-9]{6,18})/i);
            if (fallbackAccMatch) info.accountNumber = '••••••' + fallbackAccMatch[1].slice(-4);
        }

        const ifscMatch = text.match(/\b(SBIN[A-Z0-9]{7})\b/i);
        if (ifscMatch) {
            info.ifsc = ifscMatch[1].toUpperCase();
        } else {
            const fallbackIfscMatch = text.match(/(?:IFSC Code|IFSC)[\s\-\:]*(?:[\r\n]+)?([A-Z]{4}0[A-Z0-9]{6})/i);
            if (fallbackIfscMatch) info.ifsc = fallbackIfscMatch[1];
        }

        const periodVal = this.extractField(text, 'Statement From|Statement Period');
        if (periodVal) {
            info.statementPeriod = periodVal.replace(/to/i, 'to');
            info.statementPeriod = info.statementPeriod.replace(/-/g, '/');
        }

        let openBalStr = null;
        const openBalVal = this.extractField(text, 'Brought Forward|Opening Balance');
        if (openBalVal && !/Dr Count/i.test(openBalVal)) {
            openBalStr = openBalVal;
        } else {
            const fusedMatch = text.match(/([0-9,]+\.\d{2}\s*C?R?)([0-9,]+\.\d{2})([0-9,]+\.\d{2})/i);
            if (fusedMatch) {
                openBalStr = fusedMatch[1];
            }
        }
        if (openBalStr) {
            const numMatch = openBalStr.replace(/,/g, '').match(/([0-9]+\.\d{2})/);
            if (numMatch) info.openingBalance = parseFloat(numMatch[1]);
        }

        let closeBalStr = null;
        const closeBalVal = this.extractField(text, 'Closing Balance');
        if (closeBalVal && closeBalVal.match(/^[0-9,]+\.\d{2}\s*C?R?$/i)) {
            closeBalStr = closeBalVal;
        } else {
            const fusedMatch = text.match(/[0-9,]+\.\d{2}\s*C?R?[0-9,]+\.\d{2}[0-9,]+\.\d{2}[\r\n]+([0-9,]+\.\d{2}\s*C?R?)/i);
            if (fusedMatch) {
                closeBalStr = fusedMatch[1];
            }
        }
        if (closeBalStr) {
            const numMatch = closeBalStr.replace(/,/g, '').match(/([0-9]+\.\d{2})/);
            if (numMatch) info.closingBalance = parseFloat(numMatch[1]);
        }

        return info;
    }

    static extractStatementSummary(text) {
        const summary = {
            debitCount: null,
            creditCount: null,
            totalDebits: null,
            totalCredits: null
        };
        
        const dCountMatch = text.match(/Debit Count[\s\-\:]*(?:[\r\n]+)?(\d+)/i);
        if (dCountMatch) summary.debitCount = parseInt(dCountMatch[1], 10);
        
        const cCountMatch = text.match(/Credit Count[\s\-\:]*(?:[\r\n]+)?(\d+)/i);
        if (cCountMatch) summary.creditCount = parseInt(cCountMatch[1], 10);
        
        const totalDMatch = text.match(/Total Debits[\s\-\:]*(?:[\r\n]+)?(?:₹|Rs\.?)?\s*([0-9,]+\.\d{2})/i);
        if (totalDMatch) summary.totalDebits = parseFloat(totalDMatch[1].replace(/,/g, ''));
        
        const totalCMatch = text.match(/Total Credits[\s\-\:]*(?:[\r\n]+)?(?:₹|Rs\.?)?\s*([0-9,]+\.\d{2})/i);
        if (totalCMatch) summary.totalCredits = parseFloat(totalCMatch[1].replace(/,/g, ''));

        // Fallback for fused text from pdf-parse: "10,117.56CR30,069.9019,975.00"
        if (!summary.totalDebits) {
            const fusedMatch = text.match(/([0-9,]+\.\d{2}C?R?)([0-9,]+\.\d{2})([0-9,]+\.\d{2})/);
            if (fusedMatch) {
                summary.totalDebits = parseFloat(fusedMatch[2].replace(/,/g, ''));
                summary.totalCredits = parseFloat(fusedMatch[3].replace(/,/g, ''));
            }
        }
        
        return summary;
    }

    static extractTransactions(text, summary) {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const transactions = [];
        
        let inTransaction = false;
        let currentTransaction = null;
        let idCounter = 1;
        
        // Matches dates like 01/08/2026 01/08/2026 or 01/08/202601/08/2026 (no space)
        const dateRegex = /^(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/;
        
        // Matches amounts/balances like "-30.00-10,087.56" or "--200.00314.46" or "- - 200.00 314.46"
        const amountRegex = /(?:-\s*|(\d{1,9}(?:,\d{3})*\.\d{2})\s*)(?:-\s*|(\d{1,9}(?:,\d{3})*\.\d{2})\s*)(\d{1,9}(?:,\d{3})*\.\d{2})(?:\s*CR)?$/i;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Check for transaction start
            const dateMatch = line.match(dateRegex);
            if (dateMatch && !inTransaction) {
                // Any line starting with two dates in an SBI statement is a transaction block start
                inTransaction = true;
                currentTransaction = {
                    id: 'TXN-SBI-' + Date.now() + '-' + idCounter++,
                    valueDate: dateMatch[1],
                    postDate: dateMatch[2],
                    lines: [],
                    debit: 0,
                    credit: 0,
                    balance: 0
                };
                
                const remainder = line.replace(dateRegex, '').trim();
                if (remainder) currentTransaction.lines.push(remainder);
                continue;
            }
            
            if (inTransaction) {
                // Check if this line is the end of the transaction (amount line)
                // Need to distinguish from regular lines. Amount lines typically end with numbers and have dashes.
                const isAmountLine = /^(-\s*|[\d,\.]+\s+){2}[\d,\.]+(?:\s*CR)?$/i.test(line) || amountRegex.test(line);
                
                if (isAmountLine) {
                    const match = line.match(amountRegex);
                    if (match) {
                        const debitStr = match[1];
                        const creditStr = match[2];
                        const balanceStr = match[3];
                        
                        currentTransaction.debit = debitStr ? parseFloat(debitStr.replace(/,/g, '')) : 0;
                        currentTransaction.credit = creditStr ? parseFloat(creditStr.replace(/,/g, '')) : 0;
                        currentTransaction.balance = balanceStr ? parseFloat(balanceStr.replace(/,/g, '')) : 0;
                        
                        // Parse narration and UPI details
                        this.enrichTransactionDetails(currentTransaction);
                        
                        transactions.push(currentTransaction);
                    }
                    inTransaction = false;
                    currentTransaction = null;
                } else {
                    currentTransaction.lines.push(line);
                }
            }
        }
        
        const validation = this.validateTransactions(transactions, summary);
        
        return { transactions, validation };
    }
    
    static enrichTransactionDetails(txn) {
        txn.narration = txn.lines.join(' ');
        
        // Find transaction type (WDL TFR, DEP TFR, etc)
        const typeMatch = txn.narration.match(/(WDL TFR|DEP TFR|WDL|DEP|UPI|NEFT|RTGS|IMPS)/i);
        txn.transactionType = typeMatch ? typeMatch[1] : 'UNKNOWN';
        
        txn.paymentMode = 'OTHER';
        txn.counterparty = 'Unknown Counterparty';
        
        // UPI Parsing
        if (txn.narration.includes('UPI/')) {
            txn.paymentMode = 'UPI';
            // Example: UPI/DR/621307626337/Google A/utib/playstoreg/UPI 0097695162091
            const upiParts = txn.narration.match(/UPI\/(DR|CR)\/([0-9]{12})\/([^\/]+)\/([^\/]+)\/([^\/]+)/i);
            if (upiParts) {
                txn.direction = upiParts[1].toUpperCase();
                txn.transactionId = upiParts[2];
                txn.counterparty = upiParts[3].trim();
                txn.bankCode = upiParts[4].trim();
                txn.upiId = upiParts[5].trim();
            } else {
                // Fallback for slightly different UPI formats
                const altMatch = txn.narration.match(/(?:UPI|VPA)[\/\-]([a-zA-Z0-9\.\-_]+@[a-zA-Z]+)/i);
                if (altMatch) {
                    txn.counterparty = altMatch[1];
                }
            }
        } else if (txn.narration.match(/ATM|CASH WITHDRAWAL|ATM WDL/i)) {
            txn.paymentMode = 'ATM';
            txn.counterparty = 'ATM / Cash';
        }
        
        delete txn.lines; // Cleanup temporary array
    }

    static validateTransactions(transactions, summary) {
        let parsedDebits = 0;
        let parsedCredits = 0;
        let totalDebitAmt = 0;
        let totalCreditAmt = 0;
        
        transactions.forEach(t => {
            if (t.debit > 0) {
                parsedDebits++;
                totalDebitAmt += t.debit;
            }
            if (t.credit > 0) {
                parsedCredits++;
                totalCreditAmt += t.credit;
            }
        });
        
        const errors = [];
        
        if (summary.debitCount !== null && parsedDebits !== summary.debitCount) {
            errors.push(`Debit count mismatch: Parsed ${parsedDebits}, Expected ${summary.debitCount}`);
        }
        if (summary.creditCount !== null && parsedCredits !== summary.creditCount) {
            errors.push(`Credit count mismatch: Parsed ${parsedCredits}, Expected ${summary.creditCount}`);
        }
        
        // Adding small tolerance for floating point issues
        if (summary.totalDebits !== null && Math.abs(totalDebitAmt - summary.totalDebits) > 1.0) {
            errors.push(`Total debit mismatch: Parsed ${totalDebitAmt}, Expected ${summary.totalDebits}`);
        }
        if (summary.totalCredits !== null && Math.abs(totalCreditAmt - summary.totalCredits) > 1.0) {
            errors.push(`Total credit mismatch: Parsed ${totalCreditAmt}, Expected ${summary.totalCredits}`);
        }
        
        return {
            status: errors.length === 0 ? 'PASS' : 'FAIL',
            errors
        };
    }
}

module.exports = SBIParser;

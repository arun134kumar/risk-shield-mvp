const pdfParse = require('pdf-parse');
const xlsx = require('xlsx');
const OcrSpaceService = require('./ocrSpaceService');
const BankDetector = require('./parsers/BankDetector');
const SBIParser = require('./parsers/SBIParser');
const GenericTransactionNormalizer = require('./parsers/GenericTransactionNormalizer');

class StatementParser {
    static async parse(buffer, mimetype, originalName) {
        let text = '';
        let rows = [];
        let metadata = {
            pagesProcessed: 0,
            ocrUsed: false,
            transactionsFound: 0,
            accountInfoDetected: false,
            transactionTableDetected: false,
            // Debug metrics
            pdfSizeKb: Math.round(buffer.length / 1024),
            extractedTextLength: 0,
            textLayerDetected: false,
            ocrRequired: false,
            ocrRequestsCount: 0
        };
        
        if (mimetype === 'application/pdf' || originalName.toLowerCase().endsWith('.pdf')) {
            console.log(`[RiskShield] File received: ${originalName}`);
            console.log(`[RiskShield] File type: PDF`);
            
            // 1. Attempt standard Text Extraction
            try {
                console.log(`[RiskShield] Text extraction started`);
                const data = await pdfParse(buffer);
                text = data.text || '';
                metadata.pagesProcessed = data.numpages || 1;
                metadata.extractedTextLength = text.trim().length;
                
                // If we extract a reasonable amount of text, assume this is a text-based PDF
                if (metadata.extractedTextLength > 500) {
                    metadata.textLayerDetected = true;
                    console.log(`[RiskShield] Text layer detected (${metadata.extractedTextLength} chars)`);
                } else {
                    console.log(`[RiskShield] No significant text layer detected (${metadata.extractedTextLength} chars)`);
                }
                
                console.log(`[RiskShield] PDF pages: ${metadata.pagesProcessed}`);
            } catch (err) {
                console.log(`[RiskShield] Standard text extraction failed: ${err.message}`);
            }

            // 2. OCR Fallback if it's NOT a text-based PDF
            if (!metadata.textLayerDetected) {
                console.log(`[RiskShield] OCR required: YES`);
                metadata.ocrRequired = true;
                metadata.ocrUsed = true;
                
                try {
                    // Use batching for scanned PDFs
                    const ocrResult = await OcrSpaceService.parseImageWithBatching(buffer, mimetype, originalName);
                    console.log(`[RiskShield] OCR completed with ${ocrResult.requestsCount} requests`);
                    text = this.cleanOcrText(ocrResult.text);
                    metadata.extractedTextLength = text.length;
                    metadata.ocrRequestsCount = ocrResult.requestsCount;
                } catch (ocrErr) {
                    if (ocrErr.message.startsWith('OCR_')) {
                        throw ocrErr;
                    }
                    console.error(`[RiskShield] OCR failed:`, ocrErr.message);
                }
            } else {
                console.log(`[RiskShield] OCR required: NO (Text layer used)`);
                metadata.ocrRequired = false;
            }

            // 3. Detect Bank and Parse
            const bank = BankDetector.detect(text);
            console.log(`[RiskShield] Bank Detected: ${bank}`);
            metadata.bankDetected = bank;

            let accountInfo = null;
            let validationInfo = null;

            if (bank === 'SBI') {
                const sbiResult = SBIParser.parse(text);
                accountInfo = sbiResult.accountInfo;
                const rawTransactions = sbiResult.transactions;
                validationInfo = sbiResult.validation;
                
                Object.assign(metadata, sbiResult.metadata);
                metadata.validationStatus = validationInfo.status;
                metadata.validationErrors = validationInfo.errors;
                
                rows = GenericTransactionNormalizer.normalize(rawTransactions);
            } else {
                // Fallback to generic parsing
                accountInfo = this.extractAccountInfo(text);
                rows = this.genericTableExtract(text);
            }

            if (rows.length === 0) {
                console.warn("[RiskShield] Unable to identify transaction rows from this statement. Returning empty array for graceful handling.");
            }

            metadata.transactionsFound = rows.length;
            metadata.accountInfoDetected = accountInfo.accountNumber !== 'Not available in statement';
            metadata.transactionTableDetected = true;
            
            console.log(`[RiskShield] Account information detected`);
            console.log(`[RiskShield] Transaction rows detected: ${rows.length}`);
            console.log(`[RiskShield] Analysis started`);

            return { accountInfo, transactions: rows, metadata };

        } else if (mimetype === 'text/csv' || originalName.toLowerCase().endsWith('.csv') || originalName.toLowerCase().endsWith('.xlsx')) {
            console.log(`[RiskShield] File received: ${originalName}`);
            console.log(`[RiskShield] File type: Spreadsheet`);
            
            const workbook = xlsx.read(buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            rows = xlsx.utils.sheet_to_json(sheet);
            
            const normalizedRows = this.normalizeExcelRows(rows);
            
            metadata.pagesProcessed = 1;
            metadata.ocrUsed = false;
            metadata.transactionsFound = normalizedRows.length;
            metadata.accountInfoDetected = false;
            metadata.transactionTableDetected = true;
            metadata.bankDetected = 'UNKNOWN';

            console.log(`[RiskShield] Transaction rows detected: ${normalizedRows.length}`);
            console.log(`[RiskShield] Analysis started`);
            
            return {
                accountInfo: {
                    name: 'Not available in statement',
                    bank: 'Not available in statement',
                    accountNumber: 'Not available in statement',
                    ifsc: 'Not available in statement',
                    statementPeriod: 'Not available in statement',
                    openingBalance: 'Not available in statement',
                    closingBalance: 'Not available in statement'
                },
                transactions: normalizedRows,
                metadata
            };
        } else {
            throw new Error('Unsupported file format. Please upload PDF, CSV or XLSX.');
        }
    }

    static cleanOcrText(text) {
        return text
            .replace(/UPl/g, 'UPI')
            .replace(/93A2/g, '9342')
            // Fix common date OCR errors where '0' becomes 'O'
            .replace(/([0-3]?[O0-9])[\/\-\.]([01]?[O0-9])[\/\-\.](2O[0-9]{2}|20[0-9]{2})/g, (match) => {
                return match.replace(/O/g, '0');
            });
    }

    // Generic methods (kept as fallback)
    static extractField(text, labelRegex) {
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
            accountNumber: 'Not available in statement',
            ifsc: 'Not available in statement',
            statementPeriod: 'Not available in statement',
            openingBalance: 'Not available in statement',
            closingBalance: 'Not available in statement'
        };
        
        const accMatch = text.match(/(?:Account Number|Account No|A\/C No|A\/C Number|Account\s*No)[\s\-\:]*(?:[\r\n]+)?([A-Z0-9]{6,18})/i);
        if (accMatch) info.accountNumber = '••••••' + accMatch[1].slice(-4);

        const nameVal = this.extractField(text, 'Account Holder Name|Account Holder|Customer Name|A\\\\/C Holder Name|Account Name|Name(?: of the Customer)?');
        if (nameVal) info.name = nameVal;
        
        const addrVal = this.extractField(text, 'Customer Address|Registered Address|Communication Address|Address');
        if (addrVal) info.address = addrVal;

        const bankVal = this.extractField(text, 'Bank Name|Banking Institution|Bank');
        if (bankVal) info.bank = bankVal;

        const branchVal = this.extractField(text, 'Branch Name|Branch Address|Branch');
        if (branchVal) info.branch = branchVal;

        const ifscMatch = text.match(/(?:IFSC Code|IFSC)[\s\-\:]*(?:[\r\n]+)?([A-Z]{4}0[A-Z0-9]{6})/i);
        if (ifscMatch) info.ifsc = ifscMatch[1];

        const periodVal = this.extractField(text, 'Statement Period|Statement From|Statement To|From Date|To Date');
        if (periodVal) info.statementPeriod = periodVal;
        
        const openBalVal = this.extractField(text, 'Opening Balance|Opening Bal');
        if (openBalVal) info.openingBalance = openBalVal;

        const closeBalVal = this.extractField(text, 'Closing Balance|Closing Bal');
        if (closeBalVal) info.closingBalance = closeBalVal;

        return info;
    }

    static genericTableExtract(text) {
        const lines = text.split('\n');
        const transactions = [];
        let idCounter = 1;
        
        const genericRowRegex = /^(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+(.*?)\s+((?:\d{1,3}(?:,\d{3})*|\d+)\.\d{2})\s*((?:\d{1,3}(?:,\d{3})*|\d+)\.\d{2})?\s*((?:\d{1,3}(?:,\d{3})*|\d+)\.\d{2})?$/;
        
        for (let line of lines) {
            line = line.trim();
            const match = line.match(genericRowRegex);
            
            if (match) {
                const date = match[1];
                const description = match[2].trim();
                
                const col1 = match[3] ? parseFloat(match[3].replace(/,/g, '')) : null;
                const col2 = match[4] ? parseFloat(match[4].replace(/,/g, '')) : null;
                const col3 = match[5] ? parseFloat(match[5].replace(/,/g, '')) : null;
                
                let debit = 0, credit = 0, balance = 0;
                
                if (col1 && col2 && col3) {
                    debit = col1;
                    credit = col2;
                    balance = col3;
                } else if (col1 && col2) {
                    if (description.toLowerCase().includes('cr') || description.toLowerCase().includes('deposit')) {
                        credit = col1;
                    } else {
                        debit = col1;
                    }
                    balance = col2;
                } else if (col1) {
                    if (description.toLowerCase().includes('cr') || description.toLowerCase().includes('deposit')) {
                        credit = col1;
                    } else {
                        debit = col1;
                    }
                }
                
                const amount = debit > 0 ? debit : credit;
                const type = credit > 0 ? 'CREDIT' : 'DEBIT';

                if (amount > 0) {
                    transactions.push({
                        id: 'TXN-PDF-' + Date.now() + '-' + idCounter++,
                        timestamp: date,
                        description: description || 'Needs verification',
                        amount: amount,
                        type: type,
                        sourceAccount: type === 'DEBIT' ? 'Uploaded Account' : this.guessCounterparty(description),
                        destAccount: type === 'CREDIT' ? 'Uploaded Account' : this.guessCounterparty(description),
                        balance: balance || 0
                    });
                }
            }
        }
        
        return transactions;
    }
    
    static guessCounterparty(description) {
        if (!description) return 'Unknown Counterparty';
        
        const upiMatch = description.match(/(?:UPI|VPA)[\/\-]([^\/]+)/i);
        if (upiMatch) return upiMatch[1].trim();
        
        const lowerDesc = description.toLowerCase();
        if (lowerDesc.includes('atm') || lowerDesc.includes('cash')) {
            return 'ATM / Cash';
        }
        
        if (description.length > 5) {
            const words = description.split(/\s+/);
            if (words.length > 1) {
                return words.slice(0, 3).join(' ').replace(/[^a-zA-Z0-9\s]/g, '').trim() || 'Unknown Counterparty';
            }
        }
        
        return 'Unknown Counterparty';
    }

    static normalizeExcelRows(rows) {
        const normalized = [];
        let idCounter = 1;
        
        rows.forEach(row => {
            const dateStr = row.Date || row.date || row.DATE || row['Txn Date'] || row['Transaction Date'] || row['Value Date'];
            const desc = row.Description || row.description || row.Narration || row.Remarks || row.Particulars || '';
            const debit = parseFloat(row.Debit || row.Withdrawal || 0);
            const credit = parseFloat(row.Credit || row.Deposit || 0);
            const amount = parseFloat(row.Amount || row.amount || row.txn_amount || debit || credit || 0);
            
            if (dateStr && (amount > 0 || debit > 0 || credit > 0)) {
                let type = 'DEBIT';
                if (credit > 0 || (row.type && String(row.type).toLowerCase().includes('cr'))) {
                    type = 'CREDIT';
                }
                
                normalized.push({
                    id: row['Ref No'] || row['Reference'] || row['Txn Id'] || 'TXN-CSV-' + Date.now() + '-' + idCounter++,
                    timestamp: dateStr,
                    description: desc,
                    amount: amount,
                    type: type,
                    sourceAccount: type === 'DEBIT' ? 'Uploaded Account' : (row.Sender || this.guessCounterparty(desc)),
                    destAccount: type === 'CREDIT' ? 'Uploaded Account' : (row.Receiver || this.guessCounterparty(desc)),
                    balance: parseFloat(row.Balance || row.balance || 0)
                });
            }
        });
        
        if (normalized.length === 0) {
            console.warn("[RiskShield] Unable to identify transaction rows from this statement. Returning empty array for graceful handling.");
        }
        
        return normalized;
    }
}

module.exports = StatementParser;

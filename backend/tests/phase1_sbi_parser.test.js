const fs = require('fs');
const path = require('path');
const SBIParser = require('../services/parsers/SBIParser');

describe('Phase 1: SBI Parser Regression', () => {
    let result;
    
    beforeAll(() => {
        const text = fs.readFileSync(path.join(__dirname, '../debug-raw-pdf.txt'), 'utf8');
        result = SBIParser.parse(text);
    });

    test('should extract exact 70 transactions', () => {
        expect(result.transactions).toBeDefined();
        expect(result.transactions.length).toBe(70);
    });

    test('should extract exactly 59 debits and 11 credits', () => {
        const debits = result.transactions.filter(t => t.debit > 0);
        const credits = result.transactions.filter(t => t.credit > 0);
        
        expect(debits.length).toBe(59);
        expect(credits.length).toBe(11);
    });

    test('should reconcile totals correctly', () => {
        let totalDebit = 0;
        let totalCredit = 0;
        
        result.transactions.forEach(t => {
            totalDebit += t.debit;
            totalCredit += t.credit;
        });

        expect(totalDebit).toBeCloseTo(30069.90, 2);
        expect(totalCredit).toBeCloseTo(19975.00, 2);
        
        expect(result.statementSummary.totalDebits).toBeCloseTo(30069.90, 2);
        expect(result.statementSummary.totalCredits).toBeCloseTo(19975.00, 2);
    });

    test('should extract opening and closing balance', () => {
        expect(result.accountInfo.openingBalance).toBeCloseTo(10117.56, 2);
        expect(result.accountInfo.closingBalance).toBeCloseTo(22.66, 2);
    });

    test('should successfully reconcile: opening + credits - debits = closing', () => {
        let calculatedClosing = result.accountInfo.openingBalance;
        
        result.transactions.forEach(t => {
            calculatedClosing -= t.debit;
            calculatedClosing += t.credit;
        });

        expect(calculatedClosing).toBeCloseTo(result.accountInfo.closingBalance, 2);
    });

    test('validation status should be PASS', () => {
        expect(result.validation.status).toBe('PASS');
    });
});

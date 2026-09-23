const { Transaction, Statement, Account, Case, MoneyTrailEdge, Finding } = require('../models/DataModels');
const GenericTransactionNormalizer = require('../services/parsers/GenericTransactionNormalizer');
const StatementParser = require('../services/StatementParser');

describe('Phase 2: Unified Schema and Normalization', () => {
    test('Transaction model enforces strict schema and compatibility layer', () => {
        const txn = new Transaction({
            id: '123',
            statementId: 's1',
            sourceAccountId: 'acc1',
            counterpartyAccountId: 'acc2',
            date: '2026-09-01T00:00:00.000Z',
            amount: 1000,
            debit: 1000,
            credit: 0,
            direction: 'DEBIT',
            narration: 'Test Transfer'
        });

        // Strict schema fields
        expect(txn.id).toBe('123');
        expect(txn.statementId).toBe('s1');
        expect(txn.sourceAccountId).toBe('acc1');
        expect(txn.counterpartyAccountId).toBe('acc2');
        expect(txn.amount).toBe(1000);
        
        // Compatibility layer fields
        expect(txn.timestamp).toBe('2026-09-01T00:00:00.000Z');
        expect(txn.type).toBe('DEBIT');
        expect(txn.sourceAccount).toBe('acc1');
        expect(txn.destAccount).toBe('acc2');
    });

    test('Missing optional fields remain null/undefined rather than fabricated', () => {
        const txn = new Transaction({
            id: '123',
            sourceAccountId: 'acc1',
            date: '2026-09-01T00:00:00.000Z',
            amount: 100,
            direction: 'CREDIT',
            narration: 'Deposit'
        });

        expect(txn.upiId).toBeNull();
        expect(txn.referenceId).toBeNull();
        expect(txn.location).toBeNull();
    });

    test('StatementParser CSV normalizer returns proper Transaction objects', () => {
        const rows = [{
            Date: '01/08/2026',
            Description: 'Test Transfer',
            Debit: '30.00',
            Balance: '100'
        }];
        const normalized = StatementParser.normalizeExcelRows(rows);
        expect(normalized[0]).toBeInstanceOf(Transaction);
        expect(normalized[0].amount).toBe(30);
        expect(normalized[0].debit).toBe(30);
        expect(normalized[0].balance).toBe(100);
        expect(normalized[0].sourceAccount).toBe('Uploaded Account');
        expect(normalized[0].destAccount).toBe('Test Transfer');
    });

    test('GenericTransactionNormalizer returns proper Transaction objects', () => {
        const rawTxns = [{
            id: 'r1',
            valueDate: '01/08/2026',
            debit: 50,
            credit: 0,
            counterparty: 'John',
            narration: 'To John'
        }];
        
        const normalized = GenericTransactionNormalizer.normalize(rawTxns);
        expect(normalized[0]).toBeInstanceOf(Transaction);
        expect(normalized[0].amount).toBe(50);
        expect(normalized[0].direction).toBe('DEBIT');
        expect(normalized[0].counterpartyAccountId).toBe('John');
        expect(normalized[0].destAccount).toBe('John'); // Legacy alias
    });
});

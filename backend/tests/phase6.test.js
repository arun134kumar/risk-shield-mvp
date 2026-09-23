const MoneyTrailEngine = require('../services/MoneyTrailEngine');
const { Transaction } = require('../models/DataModels');

describe('Phase 6: Recursive Money-Trail Investigation', () => {
    test('Identifies linear cash-out paths', () => {
        const txns = [
            new Transaction({ id: 't1', direction: 'DEBIT', accountId: 'A', counterpartyAccountId: 'B', amount: 10000, timestamp: '2026-09-01T10:00:00Z', description: 'UPI/B' }),
            new Transaction({ id: 't2', direction: 'DEBIT', accountId: 'B', counterpartyAccountId: 'C', amount: 10000, timestamp: '2026-09-01T10:05:00Z', description: 'UPI/C' }),
            new Transaction({ id: 't3', direction: 'DEBIT', accountId: 'C', counterpartyAccountId: 'Unknown', amount: 10000, timestamp: '2026-09-01T10:10:00Z', description: 'ATM CASH WITHDRAWAL' })
        ];

        const engine = new MoneyTrailEngine(txns);
        const result = engine.investigate('A');

        expect(result.summary.cashOutFound).toBe(true);
        expect(result.summary.merchantFound).toBe(false);
        expect(result.paths.length).toBeGreaterThan(0);
        
        const cashOutPath = result.paths.find(p => p.status === 'CASH_OUT');
        expect(cashOutPath).toBeDefined();
        expect(cashOutPath.depth).toBe(3); // A -> B -> C -> Unknown(ATM)
    });

    test('Detects cycles and prevents infinite loops', () => {
        const txns = [
            new Transaction({ id: 't1', direction: 'DEBIT', accountId: 'A', counterpartyAccountId: 'B', amount: 10000, timestamp: '2026-09-01T10:00:00Z' }),
            new Transaction({ id: 't2', direction: 'DEBIT', accountId: 'B', counterpartyAccountId: 'C', amount: 10000, timestamp: '2026-09-01T10:05:00Z' }),
            new Transaction({ id: 't3', direction: 'DEBIT', accountId: 'C', counterpartyAccountId: 'A', amount: 10000, timestamp: '2026-09-01T10:10:00Z' }) // Loop back to A
        ];

        const engine = new MoneyTrailEngine(txns);
        const result = engine.investigate('A');

        expect(result.summary.totalCycles).toBe(1);
        expect(result.cycles[0].path).toEqual(['A', 'B', 'C', 'A']);
    });

    test('Stops at merchant payment', () => {
        const txns = [
            new Transaction({ id: 't1', direction: 'DEBIT', accountId: 'A', counterpartyAccountId: 'B', amount: 5000, timestamp: '2026-09-01T10:00:00Z' }),
            new Transaction({ id: 't2', direction: 'DEBIT', accountId: 'B', counterpartyAccountId: 'Amazon', amount: 5000, timestamp: '2026-09-01T10:05:00Z', description: 'POS/AMAZON' }),
        ];

        const engine = new MoneyTrailEngine(txns);
        const result = engine.investigate('A');

        expect(result.summary.merchantFound).toBe(true);
        const merchantPath = result.paths.find(p => p.status === 'MERCHANT');
        expect(merchantPath.path[merchantPath.path.length - 1]).toBe('Amazon');
    });
});

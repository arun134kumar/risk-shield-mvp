const CounterpartyRanker = require('../services/CounterpartyRanker');
const { Transaction, Finding } = require('../models/DataModels');

// Mock ComplaintProvider
jest.mock('../services/ComplaintProvider', () => {
    return {
        checkStatus: jest.fn().mockImplementation(async (account) => {
            if (account === 'Known Bad') return { status: 'KNOWN_CASE' };
            return { status: 'NO_KNOWN_CASE' };
        })
    };
});

describe('Phase 4: Counterparty Ranking', () => {
    test('Counterparties are aggregated and ranked by Investigation Priority', async () => {
        const txns = [
            new Transaction({ id: 't1', direction: 'DEBIT', amount: 40000, counterpartyAccountId: 'A' }),
            new Transaction({ id: 't2', direction: 'DEBIT', amount: 20000, counterpartyAccountId: 'A' }),
            new Transaction({ id: 't3', direction: 'DEBIT', amount: 10000, counterpartyAccountId: 'B' }),
            new Transaction({ id: 't4', direction: 'DEBIT', amount: 5000, counterpartyAccountId: 'Known Bad' }),
        ];

        // A receives 60000, B receives 10000, Known Bad receives 5000
        // 'A' should trigger the High Volume rule and High Share rule.
        // 'Known Bad' should trigger the KNOWN_CASE rule.

        const patterns = [
            new Finding({
                id: 'F1',
                type: 'P01',
                severity: 'HIGH',
                priorityScore: 25,
                title: 'Concentration Risk',
                explanation: 'A is highly concentrated',
                supportingTransactionIds: ['t1', 't2']
            })
        ];

        const ranked = await CounterpartyRanker.rank(txns, patterns);

        expect(ranked.length).toBe(3);

        const aRank = ranked.find(c => c.account === 'A');
        expect(aRank.totalValue).toBe(60000);
        expect(aRank.transactionCount).toBe(2);
        
        // Priority logic checks:
        // A: High Share (>50% of 75000) = 30 points
        // A: High Volume (>50k) = 20 points
        // A: Pattern F1 = 25 points
        // Total for A = 75 points (MEDIUM/HIGH)
        expect(aRank.investigationPriority).toBe(75);
        expect(aRank.priorityLabel).toBe('MEDIUM/HIGH');
        
        const badRank = ranked.find(c => c.account === 'Known Bad');
        // Known Bad: 40 points from ComplaintProvider
        expect(badRank.investigationPriority).toBe(40);
        expect(badRank.priorityLabel).toBe('MEDIUM');
    });
});

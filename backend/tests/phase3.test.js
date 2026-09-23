const { parseDate, normalizeDate } = require('../utils/dateUtils');
const PatternAnalyzer = require('../services/PatternAnalyzer');
const calculateRiskScore = require('../services/riskScoring');
const StatementParser = require('../services/StatementParser');

describe('Phase 3 Correctness Fixes', () => {
    test('Dates are parsed explicitly and correctly', () => {
        // DD/MM/YYYY
        expect(normalizeDate('15/09/2026')).toBe(new Date(2026, 8, 15).toISOString());
        // Excel serial date bug compensation
        // Jan 1 1970 is 25569 in Excel serial (assuming 1900 date system)
        expect(normalizeDate(25569)).toBe("1970-01-01T00:00:00.000Z");
    });

    test('CSV UPI counterparty extracted correctly without DR/CR', () => {
        const desc1 = 'UPI/DR/12345/JohnDoe/Axis';
        const desc2 = 'UPI-john@okhdfcbank';
        
        expect(StatementParser.guessCounterparty(desc1)).toBe('JohnDoe');
        expect(StatementParser.guessCounterparty(desc2)).toBe('john@okhdfcbank');
    });

    test('Circular flow requires amount similarity and time window', () => {
        const txns = [
            { id: '1', date: new Date(2026, 8, 15).toISOString(), amount: 1000, direction: 'CREDIT', sourceAccountId: 'A', counterpartyAccountId: 'B' },
            { id: '2', date: new Date(2026, 8, 16).toISOString(), amount: 1000, direction: 'DEBIT', sourceAccountId: 'A', counterpartyAccountId: 'B' },
            // Not a circular flow due to amount diff > 5%
            { id: '3', date: new Date(2026, 8, 17).toISOString(), amount: 1000, direction: 'CREDIT', sourceAccountId: 'A', counterpartyAccountId: 'D' },
            { id: '4', date: new Date(2026, 8, 18).toISOString(), amount: 800, direction: 'DEBIT', sourceAccountId: 'A', counterpartyAccountId: 'D' },
            // Not a circular flow due to time diff > 7 days
            { id: '5', date: new Date(2026, 8, 1).toISOString(), amount: 1000, direction: 'CREDIT', sourceAccountId: 'A', counterpartyAccountId: 'F' },
            { id: '6', date: new Date(2026, 8, 10).toISOString(), amount: 1000, direction: 'DEBIT', sourceAccountId: 'A', counterpartyAccountId: 'F' }
        ];
        
        const analyzer = new PatternAnalyzer(txns);
        const patterns = analyzer.analyze();
        
        const circularFlows = patterns.filter(p => p.type === 'P12');
        // Only txns 1 and 2 should trigger it (1 finding containing both txns)
        expect(circularFlows.length).toBe(1);
        expect(circularFlows[0].supportingTransactionIds.includes('1')).toBe(true);
        expect(circularFlows[0].supportingTransactionIds.includes('2')).toBe(true);
    });

    test('Risk scaling uses rate instead of raw counts', () => {
        // Create 100 transactions, 5 are high risk
        const txns = [];
        for (let i = 0; i < 95; i++) {
            txns.push({ id: `ok-${i}`, signals: [] });
        }
        for (let i = 0; i < 5; i++) {
            txns.push({ id: `bad-${i}`, signals: [{ score: 80 }] });
        }
        
        const result = calculateRiskScore(txns);
        // maxRisk is 80, highRiskRatio is 5/100 = 0.05
        // caseRiskScore = floor(80*0.5 + (0.05*100)*0.5) = floor(40 + 2.5) = 42
        expect(result.overallRiskScore).toBe(42);
    });
});

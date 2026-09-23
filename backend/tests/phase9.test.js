const ReportBuilder = require('../services/ReportBuilder');
const { Finding } = require('../models/DataModels');

describe('Phase 9: Complete Investigation Report', () => {
    test('Generates Master Report correctly', () => {
        const mockCaseData = {
            caseInfo: { id: 'c1', description: 'Test Case', status: 'OPEN', createdAt: '2026-09-01T10:00:00Z' },
            statements: [
                { id: 's1', accountId: 'A', analysisResult: { atmMarkers: [{ id: 'atm1', location: 'GORAKHPUR', withdrawalsCount: 3, totalWithdrawn: 30000, maxRisk: 0.9, resolved: true, lat: 26.7, lng: 83.3 }] } }
            ],
            transactions: [
                { direction: 'DEBIT', accountId: 'A', counterpartyAccountId: 'B', amount: 10000 },
                { direction: 'DEBIT', accountId: 'A', counterpartyAccountId: 'B', amount: 5000 },
                { direction: 'DEBIT', accountId: 'A', counterpartyAccountId: 'C', amount: 8000 }
            ],
            findings: [
                new Finding({ title: 'Smurfing Detected', type: 'PATTERN', severity: 'CRITICAL', confidence: 0.9, entityId: 'A' }),
                new Finding({ title: 'Low Balance', type: 'BEHAVIOR', severity: 'LOW', confidence: 0.8, entityId: 'A' })
            ]
        };

        const report = ReportBuilder.generateCaseReport(mockCaseData);

        expect(report.caseId).toBe('c1');
        
        // Check Counterparties aggregation
        expect(report.topCounterparties.length).toBe(2);
        expect(report.topCounterparties[0].account).toBe('B');
        expect(report.topCounterparties[0].volume).toBe(15000);

        // Check findings sorting (Critical first)
        expect(report.criticalFindings.length).toBe(2);
        expect(report.criticalFindings[0].severity).toBe('CRITICAL');

        // Check ATM / Cash Out
        expect(report.cashOutLocations.length).toBe(1);
        expect(report.cashOutLocations[0].totalWithdrawn).toBe(30000);
    });
});

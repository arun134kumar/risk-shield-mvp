const request = require('supertest');
const app = require('../server');
const InvestigationCaseManager = require('../services/InvestigationCaseManager');

describe('Integration: Large Report Generation', () => {
    let caseId;
    let authHeader = 'Bearer mock-token-investigator';

    beforeAll(() => {
        // Create a mock case with 200 transactions
        const c = InvestigationCaseManager.createCase('Large Case 200', 'System');
        caseId = c.id;

        const mockTransactions = [];
        for (let i = 0; i < 200; i++) {
            mockTransactions.push({
                id: `TXN-${i}`,
                amount: Math.random() * 10000,
                direction: i % 2 === 0 ? 'DEBIT' : 'CREDIT',
                counterpartyAccountId: `ACC-${i % 10}`
            });
        }

        InvestigationCaseManager.addStatementToCase(caseId, { accountId: 'TEST-ACC' }, { transactions: mockTransactions, patterns: [] });
    });

    it('should successfully generate report using caseId without Payload Too Large error', async () => {
        const res = await request(app)
            .post('/api/report/generate')
            .set('Authorization', authHeader)
            .send({ caseId });

        expect(res.status).toBe(200);
        expect(res.body.caseId).toBe(caseId);
        expect(res.body.summary).toBeDefined();
        expect(res.body.summary.totalTransactions).toBe(200);
    });
});

const request = require('supertest');
const app = require('../server');
const fs = require('fs');
const path = require('path');

describe('Integration: Upload to Report Generation', () => {
    let caseData;
    let authHeader = 'Bearer mock-token-investigator';

    it('should successfully upload CSV and generate caseData', async () => {
        const csvPath = path.join(__dirname, '../test_upload.csv');
        
        const res = await request(app)
            .post('/api/upload')
            .set('Authorization', authHeader)
            .attach('file', csvPath);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.caseData).toBeDefined();
        
        caseData = res.body.caseData;
    });

    it('should successfully generate report statelessly using POST /api/report/generate', async () => {
        expect(caseData).toBeDefined();

        const res = await request(app)
            .post('/api/report/generate')
            .set('Authorization', authHeader)
            .send({ caseId: caseData.caseInfo.id });

        expect(res.status).toBe(200);
        expect(res.body.caseId).toBe(caseData.caseInfo.id);
        expect(res.body.summary).toBeDefined();
        expect(res.body.topCounterparties).toBeDefined();
    });
});

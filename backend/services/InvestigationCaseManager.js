const { Case } = require('../models/DataModels');
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');

class InvestigationCaseManager {
    constructor() {
        this.isVercel = !!process.env.VERCEL;
        this.storageDir = this.isVercel ? path.join(os.tmpdir(), 'riskshield-cases') : path.join(__dirname, '../data/cases');
        
        if (!fs.existsSync(this.storageDir)) {
            fs.mkdirSync(this.storageDir, { recursive: true });
        }
    }

    _getFilePath(caseId) {
        return path.join(this.storageDir, `${caseId}.json`);
    }

    async _saveCase(caseData) {
        // Always save locally to /tmp or data/cases
        try {
            fs.writeFileSync(this._getFilePath(caseData.id), JSON.stringify(caseData, null, 2));
        } catch (err) {
            console.error(`[InvestigationCaseManager] Failed to save case locally ${caseData.id}:`, err);
        }

        // If on Vercel, also sync to durable remote store
        if (this.isVercel && caseData.id.startsWith('rs-')) {
            try {
                const apiId = caseData.id.replace('rs-', '');
                const compressed = zlib.gzipSync(JSON.stringify(caseData)).toString('base64');
                await fetch(`https://api.restful-api.dev/objects/${apiId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'RiskShieldCase', data: { payload: compressed } })
                });
            } catch (err) {
                console.error(`[InvestigationCaseManager] Failed to sync to remote:`, err);
            }
        }
    }

    async _loadCase(caseId) {
        // Try local first
        try {
            const filePath = this._getFilePath(caseId);
            if (fs.existsSync(filePath)) {
                return JSON.parse(fs.readFileSync(filePath, 'utf8'));
            }
        } catch (err) {
            console.error(`[InvestigationCaseManager] Failed to load case locally ${caseId}:`, err);
        }

        // If on Vercel and local failed, fetch from remote
        if (this.isVercel && caseId.startsWith('rs-')) {
            try {
                const apiId = caseId.replace('rs-', '');
                const res = await fetch(`https://api.restful-api.dev/objects/${apiId}`);
                if (res.ok) {
                    const obj = await res.json();
                    if (obj && obj.data && obj.data.payload) {
                        const decompressed = zlib.gunzipSync(Buffer.from(obj.data.payload, 'base64')).toString('utf8');
                        const caseData = JSON.parse(decompressed);
                        // Cache locally for next time in this invocation
                        try { fs.writeFileSync(this._getFilePath(caseId), JSON.stringify(caseData, null, 2)); } catch(e){}
                        return caseData;
                    }
                }
            } catch (err) {
                console.error(`[InvestigationCaseManager] Failed to load case from remote:`, err);
            }
        }
        return null;
    }

    async createCase(description, createdBy = 'System') {
        let id = 'CASE-' + Date.now().toString().slice(-6) + '-' + Math.floor(Math.random() * 1000);
        
        if (this.isVercel) {
            try {
                const emptyCase = { placeholder: true };
                const compressed = zlib.gzipSync(JSON.stringify(emptyCase)).toString('base64');
                const res = await fetch('https://api.restful-api.dev/objects', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'RiskShieldCase', data: { payload: compressed } })
                });
                const obj = await res.json();
                if (obj.id) id = 'rs-' + obj.id;
            } catch(e) {
                console.error("Failed to create remote case id", e);
            }
        }

        const newCase = new Case({
            id,
            description,
            status: 'OPEN',
            createdBy
        });
        
        await this._saveCase(newCase);
        return newCase;
    }

    async getCase(id) {
        return await this._loadCase(id);
    }

    async getAllCases() {
        const cases = [];
        try {
            const files = fs.readdirSync(this.storageDir);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const caseData = JSON.parse(fs.readFileSync(path.join(this.storageDir, file), 'utf8'));
                    cases.push(caseData);
                }
            }
        } catch (err) {
            console.error(`[InvestigationCaseManager] Failed to get all cases:`, err);
        }
        return cases;
    }

    async addStatementToCase(caseId, statement, analysisResult) {
        let caseData = await this._loadCase(caseId);
        
        if (!caseData) {
            // Auto-create case if it doesn't exist (for single statement uploads that initiate a case)
            caseData = await this.createCase(`Investigation for ${statement.accountId}`);
            caseId = caseData.id;
        }

        const compactAnalysisResult = { ...analysisResult };
        if (compactAnalysisResult.transactions) compactAnalysisResult.transactions = undefined;
        if (compactAnalysisResult.patterns) compactAnalysisResult.patterns = undefined;
        if (compactAnalysisResult.atmMarkers) compactAnalysisResult.atmMarkers = undefined;
        if (compactAnalysisResult.predictedHotspots) compactAnalysisResult.predictedHotspots = undefined;

        // Add statement with compact analysisResult for the frontend Tab view
        caseData.statements.push({
            ...statement,
            analysisResult: compactAnalysisResult
        });
        
        // Add transactions
        if (analysisResult && analysisResult.transactions) {
            const mappedTxns = analysisResult.transactions.map(t => ({
                ...t,
                statementId: statement.id
            }));
            caseData.transactions.push(...mappedTxns);
        }

        // Add findings
        if (analysisResult && analysisResult.patterns) {
            caseData.findings.push(...analysisResult.patterns);
        }

        // Add atmMarkers
        if (!caseData.atmMarkers) caseData.atmMarkers = [];
        if (analysisResult && analysisResult.atmMarkers) {
            caseData.atmMarkers.push(...analysisResult.atmMarkers);
        }

        // Add to timeline
        caseData.timeline.push({
            timestamp: new Date().toISOString(),
            event: `Statement added for account ${statement.accountId} (${analysisResult?.transactions?.length || 0} transactions)`,
            user: 'Investigator'
        });
        
        await this._saveCase(caseData);
        return caseData;
    }

    async aggregateCaseData(caseId) {
        const caseData = await this._loadCase(caseId);
        if (!caseData) return null;

        // In a real application, we would recalculate the graph, findings, and rankings
        // based on the UNION of all statements in the case.
        // For Phase 5, we will simply return the case object which holds all merged txns.

        return {
            caseInfo: {
                id: caseData.id,
                status: caseData.status,
                description: caseData.description,
                createdAt: caseData.createdAt
            },
            statements: caseData.statements,
            transactions: caseData.transactions,
            findings: caseData.findings,
            atmMarkers: caseData.atmMarkers || [],
            timeline: caseData.timeline
        };
    }
}

// Singleton
const instance = new InvestigationCaseManager();
module.exports = instance;

const { Case } = require('../models/DataModels');
const fs = require('fs');
const path = require('path');
const os = require('os');

class InvestigationCaseManager {
    constructor() {
        // Use /tmp/riskshield-cases for Vercel, else data/cases
        this.storageDir = process.env.VERCEL ? path.join(os.tmpdir(), 'riskshield-cases') : path.join(__dirname, '../data/cases');
        
        // Ensure directory exists
        if (!fs.existsSync(this.storageDir)) {
            fs.mkdirSync(this.storageDir, { recursive: true });
        }
    }

    _getFilePath(caseId) {
        return path.join(this.storageDir, `${caseId}.json`);
    }

    _saveCase(caseData) {
        try {
            fs.writeFileSync(this._getFilePath(caseData.id), JSON.stringify(caseData, null, 2));
        } catch (err) {
            console.error(`[InvestigationCaseManager] Failed to save case ${caseData.id}:`, err);
        }
    }

    _loadCase(caseId) {
        try {
            const filePath = this._getFilePath(caseId);
            if (fs.existsSync(filePath)) {
                return JSON.parse(fs.readFileSync(filePath, 'utf8'));
            }
        } catch (err) {
            console.error(`[InvestigationCaseManager] Failed to load case ${caseId}:`, err);
        }
        return null;
    }

    createCase(description, createdBy = 'System') {
        const id = 'CASE-' + Date.now().toString().slice(-6) + '-' + Math.floor(Math.random() * 1000);
        const newCase = new Case({
            id,
            description,
            status: 'OPEN',
            createdBy
        });
        
        this._saveCase(newCase);
        return newCase;
    }

    getCase(id) {
        return this._loadCase(id);
    }

    getAllCases() {
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

    addStatementToCase(caseId, statement, analysisResult) {
        let caseData = this._loadCase(caseId);
        
        if (!caseData) {
            // Auto-create case if it doesn't exist (for single statement uploads that initiate a case)
            caseData = this.createCase(`Investigation for ${statement.accountId}`);
            caseData.id = caseId;
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
            caseData.transactions.push(...analysisResult.transactions);
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
        
        this._saveCase(caseData);
        return caseData;
    }

    aggregateCaseData(caseId) {
        const caseData = this._loadCase(caseId);
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

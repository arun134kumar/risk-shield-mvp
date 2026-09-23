const { Case } = require('../models/DataModels');

class InvestigationCaseManager {
    constructor() {
        this.cases = new Map();
    }

    createCase(description, createdBy = 'System') {
        const id = 'CASE-' + Date.now().toString().slice(-6) + '-' + Math.floor(Math.random() * 1000);
        const newCase = new Case({
            id,
            description,
            status: 'OPEN',
            createdBy
        });
        this.cases.set(id, newCase);
        return newCase;
    }

    getCase(id) {
        return this.cases.get(id);
    }

    getAllCases() {
        return Array.from(this.cases.values());
    }

    addStatementToCase(caseId, statement, analysisResult) {
        let caseData = this.cases.get(caseId);
        if (!caseData) {
            // Auto-create case if it doesn't exist (for single statement uploads that initiate a case)
            caseData = this.createCase(`Investigation for ${statement.accountId}`);
            caseData.id = caseId;
            this.cases.set(caseId, caseData);
        }

        // Add statement with its raw analysisResult for the frontend Tab view
        caseData.statements.push({
            ...statement,
            analysisResult
        });
        
        // Add transactions
        if (analysisResult && analysisResult.transactions) {
            caseData.transactions.push(...analysisResult.transactions);
        }

        // Add findings
        if (analysisResult && analysisResult.patterns) {
            caseData.findings.push(...analysisResult.patterns);
        }

        // Add to timeline
        caseData.timeline.push({
            timestamp: new Date().toISOString(),
            event: `Statement added for account ${statement.accountId} (${analysisResult?.transactions?.length || 0} transactions)`,
            user: 'Investigator'
        });
        
        return caseData;
    }

    aggregateCaseData(caseId) {
        const caseData = this.cases.get(caseId);
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
            timeline: caseData.timeline
        };
    }
}

// Singleton
const instance = new InvestigationCaseManager();
module.exports = instance;

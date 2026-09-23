const crypto = require('crypto');

class CaseManager {
    constructor() {
        this.cases = new Map();
        // Seed a demo case
        this.createCase({
            complaintNumber: 'NCRP-2026-99120',
            victimName: 'S*** M***',
            victimAccount: 'XXXXXXXX1234',
            description: 'Fraudulent UPI transfer after malicious app installation',
            status: 'OPEN'
        });
    }

    createCase(data) {
        const id = 'CASE-' + Date.now().toString().slice(-6) + '-' + Math.floor(Math.random() * 1000);
        const newCase = {
            id,
            complaintNumber: data.complaintNumber,
            victimName: this.maskName(data.victimName),
            victimAccount: this.maskAccount(data.victimAccount),
            description: data.description,
            status: data.status || 'OPEN',
            createdAt: new Date().toISOString(),
            transactions: [],
            evidenceFiles: [],
            alerts: [],
            predictions: null,
            timeline: [{
                timestamp: new Date().toISOString(),
                event: 'Case created via NCRP integration',
                user: data.createdBy || 'System'
            }],
            createdBy: data.createdBy || 'System'

        };
        this.cases.set(id, newCase);
        return newCase;
    }

    getCase(id, userId, role) {
        const c = this.cases.get(id);
        if (!c) return null;
        if (role === 'Admin') return c;
        if (c.createdBy === userId || c.createdBy === 'System') return c;
        return null; // Deny access
    }

    getAllCases(userId, role) {
        const all = Array.from(this.cases.values());
        if (role === 'Admin') return all;
        return all.filter(c => c.createdBy === userId || c.createdBy === 'System');
    }

    addEvidence(caseId, fileName, fileBuffer, analysisResult) {
        const caseData = this.cases.get(caseId);
        if (!caseData) throw new Error('Case not found');

        const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        
        caseData.evidenceFiles.push({
            fileName,
            hash: fileHash,
            uploadedAt: new Date().toISOString()
        });

        if (analysisResult && analysisResult.transactions) {
            // Append transactions to the case
            caseData.transactions.push(...analysisResult.transactions);
            caseData.timeline.push({
                timestamp: new Date().toISOString(),
                event: `Evidence attached: ${fileName} (${analysisResult.transactions.length} transactions)`,
                user: 'Investigator'
            });
        }
        
        return caseData;
    }

    updateCasePredictions(caseId, predictions) {
        const caseData = this.cases.get(caseId);
        if (caseData) {
            caseData.predictions = predictions;
            caseData.timeline.push({
                timestamp: new Date().toISOString(),
                event: `AI prediction generated (Top-3 hotspots)`,
                user: 'System'
            });
        }
    }

    addAlert(caseId, alert) {
        const caseData = this.cases.get(caseId);
        if (caseData) {
            // Prevent duplicate spam
            const exists = caseData.alerts.find(a => a.reason === alert.reason && a.hotspot === alert.hotspot);
            if (!exists) {
                caseData.alerts.push({
                    ...alert,
                    id: 'ALT-' + Date.now(),
                    timestamp: new Date().toISOString()
                });
            }
        }
    }

    maskName(name) {
        if (!name) return 'Unknown';
        if (name.includes('*')) return name; // Already masked
        const parts = name.split(' ');
        return parts.map(p => p[0] + '***').join(' ');
    }

    maskAccount(account) {
        if (!account) return 'Unknown';
        if (account.includes('X')) return account;
        if (account.length <= 4) return 'XXXX' + account;
        return 'XXXXX' + account.slice(-4);
    }
}

// Singleton
const instance = new CaseManager();
module.exports = instance;

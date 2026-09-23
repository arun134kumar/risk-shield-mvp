class ReportBuilder {
    static generateCaseReport(caseData) {
        if (!caseData) return null;

        const report = {
            caseId: caseData.caseInfo.id,
            description: caseData.caseInfo.description,
            status: caseData.caseInfo.status,
            createdAt: caseData.caseInfo.createdAt,
            
            summary: {
                totalStatements: caseData.statements.length,
                totalTransactions: caseData.transactions.length,
                totalFindings: caseData.findings.length
            },
            
            topCounterparties: [],
            criticalFindings: [],
            cashOutLocations: []
        };

        // 1. Top Counterparties (By Debit Volume)
        const cpMap = {};
        caseData.transactions.forEach(t => {
            if (t.direction === 'DEBIT' && t.counterpartyAccountId && t.counterpartyAccountId !== 'Unknown Counterparty') {
                if (!cpMap[t.counterpartyAccountId]) cpMap[t.counterpartyAccountId] = 0;
                cpMap[t.counterpartyAccountId] += t.amount;
            }
        });
        report.topCounterparties = Object.entries(cpMap)
            .map(([account, volume]) => ({ account, volume }))
            .sort((a, b) => b.volume - a.volume)
            .slice(0, 5);

        // 2. Suspicious Patterns Found (Findings)
        report.criticalFindings = caseData.findings.map(f => ({
            type: f.type,
            title: f.title,
            severity: f.severity,
            confidence: f.confidence,
            evidenceCount: f.evidenceIds ? f.evidenceIds.length : 0
        })).sort((a, b) => {
            const sevMap = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
            return (sevMap[b.severity] || 0) - (sevMap[a.severity] || 0);
        });

        // 3. Cash-out / ATM Locations
        // Get all ATM markers from the statements' analysisResult
        const atmMap = new Map();
        caseData.statements.forEach(stmt => {
            if (stmt.analysisResult && stmt.analysisResult.atmMarkers) {
                stmt.analysisResult.atmMarkers.forEach(atm => {
                    if (atm.resolved && atm.lat && atm.lng) {
                        if (!atmMap.has(atm.id)) {
                            atmMap.set(atm.id, {
                                location: atm.displayName || atm.originalLocationStr,
                                withdrawalsCount: atm.withdrawalsCount,
                                totalWithdrawn: atm.totalWithdrawn,
                                maxRisk: atm.maxRisk
                            });
                        } else {
                            const existing = atmMap.get(atm.id);
                            existing.withdrawalsCount += atm.withdrawalsCount;
                            existing.totalWithdrawn += atm.totalWithdrawn;
                            existing.maxRisk = Math.max(existing.maxRisk, atm.maxRisk);
                        }
                    }
                });
            }
        });
        report.cashOutLocations = Array.from(atmMap.values()).sort((a, b) => b.totalWithdrawn - a.totalWithdrawn);

        return report;
    }
}

module.exports = ReportBuilder;

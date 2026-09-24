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
                totalFindings: caseData.findings.length,
                totalAccounts: 0, // Placeholder, computed below
                totalMoneyFlow: 0 // Placeholder, computed below
            },
            
            topCounterparties: [],
            criticalFindings: [],
            cashOutLocations: [],
            moneyTrail: [],
            timeline: caseData.timeline || []
        };

        // 1. Compute totals
        const uniqueAccounts = new Set();
        let totalMoneyFlow = 0;
        caseData.transactions.forEach(t => {
            totalMoneyFlow += t.amount;
            if (t.sourceAccount) uniqueAccounts.add(t.sourceAccount);
            if (t.destAccount) uniqueAccounts.add(t.destAccount);
        });
        report.summary.totalAccounts = uniqueAccounts.size;
        report.summary.totalMoneyFlow = totalMoneyFlow;

        // 2. Top Counterparties (By Debit Volume)
        const cpMap = {};
        caseData.transactions.forEach(t => {
            if (t.type === 'DEBIT' && t.counterpartyAccountId && t.counterpartyAccountId !== 'Unknown Counterparty') {
                if (!cpMap[t.counterpartyAccountId]) cpMap[t.counterpartyAccountId] = 0;
                cpMap[t.counterpartyAccountId] += t.amount;
            }
        });
        
        const maskIdentifier = (idStr) => {
            if (!idStr || typeof idStr !== 'string') return idStr;
            // Mask all but last 4 digits if length > 6
            if (idStr.length > 6) return 'X'.repeat(idStr.length - 4) + idStr.slice(-4);
            return idStr; // Return as is for short IDs or names
        };

        report.topCounterparties = Object.entries(cpMap)
            .map(([account, volume]) => ({ account: maskIdentifier(account), volume }))
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
        const atmMap = new Map();
        if (caseData.atmMarkers) {
            caseData.atmMarkers.forEach(atm => {
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
        report.cashOutLocations = Array.from(atmMap.values()).sort((a, b) => b.totalWithdrawn - a.totalWithdrawn);

        // 4. Money Trail Summary (Significant flows)
        const flows = new Map();
        caseData.transactions.forEach(t => {
            if (t.counterpartyAccountId && t.counterpartyAccountId !== 'Unknown Counterparty') {
                const source = t.type === 'DEBIT' ? t.sourceAccount : t.counterpartyAccountId;
                const dest = t.type === 'DEBIT' ? t.counterpartyAccountId : t.sourceAccount;
                const key = `${source} -> ${dest}`;
                if (!flows.has(key)) flows.set(key, 0);
                flows.set(key, flows.get(key) + t.amount);
            }
        });
        report.moneyTrail = Array.from(flows.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([path, amount]) => `${path} (₹${amount.toLocaleString()})`);

        return report;
    }
}

module.exports = ReportBuilder;

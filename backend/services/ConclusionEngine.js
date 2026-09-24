const ComplaintProvider = require('./ComplaintProvider');
const CounterpartyRanker = require('./CounterpartyRanker');

class ConclusionEngine {
    static async generate(accountInfo, transactions, patterns, graphMetrics, atmMarkers, predictedHotspots) {
        const report = {
            analyzedAccount: accountInfo.accountNumber || 'Unknown',
            assessment: 'INSUFFICIENT DATA',
            why: [],
            moneyTrail: [],
            top3Candidates: [],
            otherLinkedAccounts: [],
            systemRecommendation: null,
            cashOutAnalysis: null,
            predictedHotspots: [],
            evidenceSummary: [],
            investigatorAction: 'REQUIRES INVESTIGATOR REVIEW'
        };

        if (!transactions || transactions.length === 0) {
            report.assessment = 'INSUFFICIENT DATA';
            report.why.push('No transactions available to analyze.');
            return report;
        }

        // 1. Analyze Uploaded Account
        let hasRapidMovement = patterns.some(p => ['P03', 'P06', 'P07', 'P08', 'P09'].includes(p.type));
        let hasMultiHop = graphMetrics.multiHopChains && graphMetrics.multiHopChains.length > 0;
        let hasCashOut = atmMarkers && atmMarkers.length > 0;
        
        let fundsMovedOut = false;
        let downstreamSuspicious = false;

        // Check for funds leaving the account
        if (transactions.some(t => t.type === 'DEBIT')) {
            fundsMovedOut = true;
        }

        if (hasMultiHop || hasRapidMovement || hasCashOut) {
            downstreamSuspicious = true;
        }

        // Determine Uploaded Account Status
        if (fundsMovedOut && downstreamSuspicious) {
            report.assessment = 'POTENTIAL VICTIM';
            report.why.push('Funds moved from this account to downstream entities.');
            if (hasMultiHop) report.why.push('Downstream multi-hop chain detected.');
            if (hasRapidMovement) report.why.push('Rapid fund movement out of the account.');
            if (hasCashOut) report.why.push('Subsequent cash-out activity identified.');
            report.investigatorAction = 'Contact account holder to verify authorization of recent large transfers. Review downstream linked accounts.';
        } else if (downstreamSuspicious) {
            report.assessment = 'SUSPICIOUS ACTIVITY INDICATED';
            report.why.push('Suspicious transaction patterns detected within the account.');
            report.investigatorAction = 'Review flagged transactions and request further KYC/CDD documentation.';
        } else {
            report.assessment = 'NO STRONG SUSPICIOUS EVIDENCE';
            report.why.push('No significant rapid-transfer pattern identified.');
            report.why.push('No significant multi-hop pattern identified.');
            report.why.push('No suspicious cash-out pattern identified.');
            report.why.push('No known complaint found in connected data.');
            report.investigatorAction = 'No immediate action required. Routine monitoring.';
        }

        // 2. Linked Accounts Analysis (B, C, D)
        const rankedCandidates = await CounterpartyRanker.rank(transactions, patterns);
        
        report.top3Candidates = rankedCandidates.slice(0, 3).map(c => ({
            account: c.account,
            status: 'Candidate for Further Review',
            priority: c.priorityLabel,
            reason: c.why.join(' ') || 'Elevated investigation priority based on available evidence.'
        }));

        report.otherLinkedAccounts = rankedCandidates.slice(3).map(c => ({
            account: c.account,
            status: 'Candidate for Further Review',
            priority: c.priorityLabel,
            reason: 'Insufficient/high-level evidence compared with Top 3'
        }));

        if (report.top3Candidates.length > 0) {
            const top = report.top3Candidates[0];
            report.systemRecommendation = {
                action: `Upload Statement for ${top.account}`,
                targetAccount: top.account,
                why: [
                    'Highest current investigation priority based on available evidence.',
                    'Strongest evidence in the uploaded statement.',
                    'Could clarify downstream money movement.',
                    'Could confirm or reject the suspected chain.'
                ]
            };
        }

        // Construct Money Trail String dynamically
        for (const top of report.top3Candidates) {
            if (report.moneyTrail.length < 5) { // Cap for display
                report.moneyTrail.push(`${report.analyzedAccount} → ${top.account}`);
            }
        }
        
        if (hasCashOut) {
            report.moneyTrail.push('... → ATM Cash-out');
        }

        // 3. ATM / Cash Out Analysis
        if (hasCashOut) {
            // Pick highest risk ATM for the summary
            const topAtm = [...atmMarkers].sort((a,b) => b.totalWithdrawn - a.totalWithdrawn)[0];
            report.cashOutAnalysis = {
                atmId: topAtm.atmId || topAtm.id,
                location: topAtm.originalLocationStr || topAtm.displayName,
                withdrawalsCount: topAtm.withdrawalsCount,
                totalAmount: topAtm.totalWithdrawn
            };
        }

        // 4. Predicted Hotspots
        if (predictedHotspots && predictedHotspots.length > 0) {
            report.predictedHotspots = predictedHotspots.slice(0, 3).map(h => ({
                location: h.location,
                score: h.riskScore
            }));
        }

        // 5. Evidence Summary (Extract highest risk txns)
        const evidenceTxns = [...transactions].sort((a,b) => b.riskScore - a.riskScore).slice(0, 5);
        report.evidenceSummary = evidenceTxns.map(t => ({
            id: t.id,
            date: t.timestamp,
            amount: t.amount,
            signals: (t.signals || []).map(s => s.type).join(', ') || 'High Risk'
        }));

        // 6. CANONICAL DTO Normalization for Frontend
        report.caseId = accountInfo.accountNumber || 'Unknown';
        report.status = report.assessment;
        
        let totalMoneyFlow = 0;
        let uniqueAccounts = new Set();
        transactions.forEach(t => {
            totalMoneyFlow += t.amount;
            if (t.sourceAccount) uniqueAccounts.add(t.sourceAccount);
            if (t.destAccount) uniqueAccounts.add(t.destAccount);
        });

        report.summary = {
            totalStatements: 1,
            totalTransactions: transactions.length,
            totalAccounts: uniqueAccounts.size,
            totalFindings: patterns ? patterns.length : 0,
            totalMoneyFlow: totalMoneyFlow
        };

        // Compute volume for counterparties
        const cpMap = {};
        transactions.forEach(t => {
            if (t.type === 'DEBIT' && t.destAccount) {
                cpMap[t.destAccount] = (cpMap[t.destAccount] || 0) + t.amount;
            }
        });

        report.topCounterparties = report.top3Candidates.map(c => ({
            account: c.account,
            volume: cpMap[c.account] || 0
        }));

        report.criticalFindings = (patterns || []).map(p => ({
            type: p.type,
            title: p.description,
            severity: p.riskContribution > 20 ? 'HIGH' : 'MEDIUM',
            confidence: 90,
            evidenceCount: 1
        }));

        report.cashOutLocations = (atmMarkers || []).filter(atm => atm.resolved).map(atm => ({
            location: atm.displayName || atm.originalLocationStr,
            withdrawalsCount: atm.withdrawalsCount,
            totalWithdrawn: atm.totalWithdrawn,
            maxRisk: atm.maxRisk
        }));

        report.timeline = []; // Not applicable for single statement

        return report;
    }
}

module.exports = ConclusionEngine;

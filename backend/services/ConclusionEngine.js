const ComplaintProvider = require('./ComplaintProvider');

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
        let hasRapidMovement = patterns.some(p => p.type === 'rapid_transfer');
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
        const linkedMap = new Map();
        
        // Extract unique downstream counterparties
        transactions.forEach(t => {
            if (t.type === 'DEBIT' && t.destAccount && t.destAccount !== 'Uploaded Account' && t.destAccount !== 'Unknown Counterparty') {
                if (!linkedMap.has(t.destAccount)) {
                    linkedMap.set(t.destAccount, { 
                        account: t.destAccount,
                        fundsReceived: 0,
                        txnCount: 0,
                        role: 'Possible intermediary / cash-out account',
                        riskSignals: []
                    });
                }
                const entry = linkedMap.get(t.destAccount);
                entry.fundsReceived += t.amount;
                entry.txnCount += 1;
                if (t.signals && t.signals.length > 0) {
                    t.signals.forEach(s => {
                        if (!entry.riskSignals.includes(s.type)) entry.riskSignals.push(s.type);
                    });
                }
            }
        });

        // Resolve Complaint Status and calculate Priority Score
        const candidates = [];
        for (const [key, linked] of linkedMap.entries()) {
            const complaintRes = await ComplaintProvider.checkStatus(linked.account);
            linked.complaintStatus = complaintRes.status;
            
            let priorityScore = 0;

            // Score based on funds received (e.g. 1 point per 1k)
            priorityScore += Math.min(50, Math.floor(linked.fundsReceived / 1000));
            // Score based on velocity/frequency
            priorityScore += linked.txnCount * 5;
            
            // Add risk signals
            if (complaintRes.status === 'KNOWN_CASE') {
                linked.riskSignals.push('Linked to a known complaint/case');
                priorityScore += 40;
            } 
            if (linked.fundsReceived > 50000) {
                linked.riskSignals.push(`High volume of funds received: ₹${linked.fundsReceived.toLocaleString()}`);
            }
            if (hasRapidMovement) {
                linked.riskSignals.push('Involved in rapid transfer chain');
                priorityScore += 20;
            }

            linked.priorityScore = Math.min(100, priorityScore);
            
            let priorityLabel = 'LOW';
            if (linked.priorityScore >= 80) priorityLabel = 'HIGH';
            else if (linked.priorityScore >= 60) priorityLabel = 'MEDIUM/HIGH';
            else if (linked.priorityScore >= 40) priorityLabel = 'MEDIUM';

            linked.priority = priorityLabel;
            linked.status = 'Candidate for Further Review';
            
            // Formulate actual reasons
            linked.reasons = [
                `Received ₹${linked.fundsReceived.toLocaleString()} across ${linked.txnCount} transactions.`
            ];
            if (linked.riskSignals.length > 0) {
                linked.reasons.push(...linked.riskSignals);
            }

            candidates.push(linked);
        }
        
        // Rank candidates
        candidates.sort((a, b) => b.priorityScore - a.priorityScore);
        
        report.top3Candidates = candidates.slice(0, 3);
        report.otherLinkedAccounts = candidates.slice(3).map(c => ({
            account: c.account,
            status: c.status,
            priority: c.priority,
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

        return report;
    }
}

module.exports = ConclusionEngine;

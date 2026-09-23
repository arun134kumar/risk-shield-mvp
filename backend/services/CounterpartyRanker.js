const ComplaintProvider = require('./ComplaintProvider');

class CounterpartyRanker {
    /**
     * Ranks counterparties based on multiple risk vectors.
     * @param {Array} transactions 
     * @param {Array} patterns (Finding objects)
     * @returns {Promise<Array>} Ranked counterparties
     */
    static async rank(transactions, patterns) {
        const cpMap = new Map();
        
        let totalOutgoingValue = 0;

        // Pass 1: Aggregate basic metrics
        transactions.forEach(t => {
            if (t.direction === 'DEBIT' && t.counterpartyAccountId && t.counterpartyAccountId !== 'Unknown Counterparty') {
                totalOutgoingValue += t.amount;
                
                if (!cpMap.has(t.counterpartyAccountId)) {
                    cpMap.set(t.counterpartyAccountId, {
                        account: t.counterpartyAccountId,
                        totalValue: 0,
                        transactionCount: 0,
                        velocity: 0,
                        findings: [],
                        supportingTxnIds: []
                    });
                }
                
                const cp = cpMap.get(t.counterpartyAccountId);
                cp.totalValue += t.amount;
                cp.transactionCount += 1;
                cp.supportingTxnIds.push(t.id);
            }
        });

        // Pass 2: Map Findings to counterparties
        patterns.forEach(finding => {
            const relatedTxns = finding.supportingTransactionIds || [];
            
            cpMap.forEach((cp, key) => {
                const hasIntersection = cp.supportingTxnIds.some(id => relatedTxns.includes(id));
                if (hasIntersection) {
                    cp.findings.push(finding);
                }
            });
        });

        // Pass 3: Scoring and Formatting
        const ranked = [];
        for (const [key, cp] of cpMap.entries()) {
            let priorityScore = 0;
            const why = [];

            // 1. Share of outgoing value
            const share = totalOutgoingValue > 0 ? cp.totalValue / totalOutgoingValue : 0;
            if (share > 0.5) {
                priorityScore += 30;
                why.push(`${(share * 100).toFixed(0)}% of source outgoing value went to this counterparty.`);
            }

            // 2. High volume/count
            if (cp.totalValue > 50000) {
                priorityScore += 20;
                why.push(`Received substantial total value (₹${cp.totalValue.toLocaleString()}).`);
            }
            if (cp.transactionCount >= 5) {
                priorityScore += 15;
                why.push(`High frequency (${cp.transactionCount} transactions) indicates velocity burst.`);
            }

            // 3. Patterns/Findings
            cp.findings.forEach(f => {
                priorityScore += f.priorityScore || 10;
                why.push(f.explanation || f.title);
            });

            // 4. External Complaints (Placeholder for external integrations)
            const complaintRes = await ComplaintProvider.checkStatus(cp.account);
            if (complaintRes.status === 'KNOWN_CASE') {
                priorityScore += 40;
                why.push('Linked to a known external complaint/case.');
            }

            // Normalize Score
            priorityScore = Math.min(100, Math.floor(priorityScore));

            let priorityLabel = 'LOW';
            if (priorityScore >= 80) priorityLabel = 'HIGH';
            else if (priorityScore >= 60) priorityLabel = 'MEDIUM/HIGH';
            else if (priorityScore >= 40) priorityLabel = 'MEDIUM';

            // Evidence Quality
            let evidenceQuality = 'LOW';
            if (priorityScore >= 70) evidenceQuality = 'HIGH';
            else if (priorityScore >= 40) evidenceQuality = 'MEDIUM';

            ranked.push({
                account: cp.account,
                investigationPriority: priorityScore,
                priorityLabel: priorityLabel,
                evidenceQuality: evidenceQuality,
                why: [...new Set(why)], // deduplicate reasons
                supportingTxnIds: cp.supportingTxnIds,
                totalValue: cp.totalValue,
                transactionCount: cp.transactionCount
            });
        }

        // Sort descending by priorityScore
        ranked.sort((a, b) => b.investigationPriority - a.investigationPriority);
        
        return ranked;
    }
}

module.exports = CounterpartyRanker;

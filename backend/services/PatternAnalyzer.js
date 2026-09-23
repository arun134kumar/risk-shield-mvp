const { Finding } = require('../models/DataModels');

class PatternAnalyzer {
    constructor(transactions, accountId = 'Uploaded Account') {
        // Sort transactions chronologically
        this.transactions = transactions.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
        this.accountId = accountId;
        this.findings = [];
    }

    analyze() {
        // Layer A: Transaction Context
        this.detectBalanceImpact();      // P02
        this.detectAtmConcentration();   // P10

        // Layer B: Account Behaviour
        this.detectCounterpartyConcentration(); // P01
        this.detectVelocityBurst();      // P03
        this.detectFanInOut();           // P04, P05
        this.detectPassThrough();        // P06, P08, P09
        this.detectDormantBurst();       // P11
        this.detectCounterpartyExpansion(); // P14

        // Layer C: Network Behaviour (Limited from single statement view, enhanced in Phase 6/8)
        this.detectCircularFlow();       // P12
        this.detectFunnelLike();         // P13

        return this.findings;
    }

    addFinding(patternId, title, explanation, severity, priorityScore, txns = []) {
        // Prevent duplicate findings for the same core transactions
        const sig = patternId + txns.map(t => t.id).join(',');
        if (this.findings.some(f => f._sig === sig)) return;
        
        const finding = new Finding({
            id: `FND-${patternId}-${Date.now()}-${Math.floor(Math.random()*1000)}`,
            accountId: this.accountId,
            type: patternId,
            severity: severity,
            priorityScore: priorityScore,
            title: title,
            explanation: explanation,
            supportingTransactionIds: txns.map(t => t.id),
            confidence: 0.9
        });
        finding._sig = sig; // internal use
        this.findings.push(finding);
        
        // Backward compatibility for existing RiskScoring / API routes
        txns.forEach(txn => {
            if (!txn.signals) txn.signals = [];
            txn.signals.push({ type: patternId, score: priorityScore, reason: title });
        });
    }

    detectBalanceImpact() {
        // P02: Transfer amount relative to balance before transfer
        this.transactions.forEach(txn => {
            if (txn.direction === 'DEBIT' && txn.balance !== null) {
                // If the debit is more than 80% of the available balance prior to the debit
                const prevBalance = txn.balance + txn.amount;
                if (prevBalance > 1000 && txn.amount > (0.8 * prevBalance)) {
                    this.addFinding('P02', 'High Balance Impact', `Debit of ${txn.amount} severely impacted the available balance of ${prevBalance}.`, 'HIGH', 20, [txn]);
                }
            }
        });
    }

    detectAtmConcentration() {
        // P10: Repeated withdrawals at reliable locations
        const locationMap = {};
        this.transactions.forEach(txn => {
            if (txn.direction === 'DEBIT' && txn.paymentMode === 'ATM' && txn.location) {
                if (!locationMap[txn.location]) locationMap[txn.location] = [];
                locationMap[txn.location].push(txn);
            }
        });

        for (const [loc, txns] of Object.entries(locationMap)) {
            if (txns.length >= 3) {
                this.addFinding('P10', 'ATM Concentration', `${txns.length} ATM withdrawals concentrated at ${loc}.`, 'MEDIUM', 15, txns);
            }
        }
    }

    detectCounterpartyConcentration() {
        // P01: B's share of A's outgoing value/count
        const cpTotal = {};
        let totalOut = 0;
        
        this.transactions.forEach(txn => {
            if (txn.direction === 'DEBIT' && txn.counterpartyAccountId && txn.counterpartyAccountId !== 'Unknown Counterparty') {
                if (!cpTotal[txn.counterpartyAccountId]) cpTotal[txn.counterpartyAccountId] = { count: 0, amount: 0, txns: [] };
                cpTotal[txn.counterpartyAccountId].count++;
                cpTotal[txn.counterpartyAccountId].amount += txn.amount;
                cpTotal[txn.counterpartyAccountId].txns.push(txn);
                totalOut += txn.amount;
            }
        });

        if (totalOut > 0) {
            for (const [cp, stats] of Object.entries(cpTotal)) {
                if (stats.amount > (0.5 * totalOut) && stats.count >= 2) {
                    this.addFinding('P01', 'Counterparty Concentration', `Counterparty ${cp} received ${(stats.amount / totalOut * 100).toFixed(1)}% of all outgoing funds.`, 'HIGH', 25, stats.txns);
                }
            }
        }
    }

    detectVelocityBurst() {
        // P03: Transaction density vs account baseline
        let windowTxns = [];
        for (let i = 0; i < this.transactions.length; i++) {
            const txn = this.transactions[i];
            if (windowTxns.length === 0) {
                windowTxns.push(txn);
            } else {
                const timeDiffMs = new Date(txn.date) - new Date(windowTxns[0].date);
                if (timeDiffMs < 60 * 60 * 1000) { // 1 hour
                    windowTxns.push(txn);
                } else {
                    if (windowTxns.length >= 8) {
                        this.addFinding('P03', 'Velocity Burst', `High transaction density: ${windowTxns.length} transactions within 1 hour.`, 'HIGH', 25, windowTxns);
                    }
                    windowTxns = [txn];
                }
            }
        }
    }

    detectFanInOut() {
        // P04 Fan-in, P05 Fan-out
        const senders = new Set();
        const receivers = new Set();
        
        this.transactions.forEach(txn => {
            if (txn.direction === 'CREDIT' && txn.counterpartyAccountId && txn.counterpartyAccountId !== 'Unknown Counterparty') {
                senders.add(txn.counterpartyAccountId);
            }
            if (txn.direction === 'DEBIT' && txn.counterpartyAccountId && txn.counterpartyAccountId !== 'Unknown Counterparty') {
                receivers.add(txn.counterpartyAccountId);
            }
        });

        if (senders.size >= 5) {
            this.addFinding('P04', 'Fan-in Network', `Account received funds from ${senders.size} distinct counterparties.`, 'MEDIUM', 15, []);
        }
        if (receivers.size >= 5) {
            this.addFinding('P05', 'Fan-out Network', `Account sent funds to ${receivers.size} distinct counterparties.`, 'MEDIUM', 15, []);
        }
    }

    detectPassThrough() {
        // P06 Pass-through, P08 Low residual, P09 Cash-out after credit
        for (let i = 0; i < this.transactions.length - 1; i++) {
            const inTxn = this.transactions[i];
            if (inTxn.direction === 'CREDIT' && inTxn.amount > 5000) {
                let outTxns = [];
                let outSum = 0;
                let hasCashOut = false;
                
                for (let j = i + 1; j < Math.min(i + 15, this.transactions.length); j++) {
                    const outTxn = this.transactions[j];
                    const timeDiffHours = (new Date(outTxn.date) - new Date(inTxn.date)) / (1000 * 60 * 60);
                    
                    if (timeDiffHours > 24) break;
                    
                    if (outTxn.direction === 'DEBIT') {
                        outTxns.push(outTxn);
                        outSum += outTxn.amount;
                        if (outTxn.paymentMode === 'ATM') hasCashOut = true;
                    }
                }
                
                if (outSum >= inTxn.amount * 0.8) {
                    const txns = [inTxn, ...outTxns];
                    if (hasCashOut) {
                        this.addFinding('P09', 'Cash-out after credit', `Large credit of ${inTxn.amount} was rapidly followed by cash withdrawals.`, 'CRITICAL', 40, txns);
                    } else if (outSum >= inTxn.amount * 0.95) {
                        this.addFinding('P08', 'Low Residual Balance', `Large credit of ${inTxn.amount} was nearly completely drained within 24 hours.`, 'HIGH', 30, txns);
                    } else {
                        this.addFinding('P06', 'Pass-through', `Substantial onward transfer of incoming funds.`, 'MEDIUM', 20, txns);
                    }
                }
            }
        }
    }

    detectDormantBurst() {
        // P11: Quiet period followed by abnormal activity
        // Requires comparing transaction gaps
        let maxGap = 0;
        for (let i = 1; i < this.transactions.length; i++) {
            const gap = (new Date(this.transactions[i].date) - new Date(this.transactions[i-1].date)) / (1000 * 60 * 60 * 24);
            if (gap > 30) { // 30 days dormant
                // Check if followed by burst
                const subsequentTxns = this.transactions.slice(i, i + 5);
                if (subsequentTxns.length >= 5) {
                    const burstDuration = (new Date(subsequentTxns[4].date) - new Date(subsequentTxns[0].date)) / (1000 * 60 * 60 * 24);
                    if (burstDuration < 2) { // 5 txns in 2 days
                        this.addFinding('P11', 'Dormant to Burst', `Account was dormant for ${Math.floor(gap)} days, followed by rapid burst of activity.`, 'HIGH', 25, subsequentTxns);
                    }
                }
            }
        }
    }

    detectCounterpartyExpansion() {
        // P14: Sudden increase in new counterparties
        // Difficult to accurately model without historical baseline, will stub for now.
    }

    detectCircularFlow() {
        // P12: Circular flow (A->B->A locally observable as Out to B, In from B)
        const cpFlows = {};
        this.transactions.forEach(txn => {
            const cp = txn.counterpartyAccountId;
            if (cp && cp !== 'Unknown Counterparty') {
                if (!cpFlows[cp]) cpFlows[cp] = { in: [], out: [] };
                if (txn.direction === 'CREDIT') cpFlows[cp].in.push(txn);
                else cpFlows[cp].out.push(txn);
            }
        });

        for (const [cp, flow] of Object.entries(cpFlows)) {
            if (flow.in.length > 0 && flow.out.length > 0) {
                // Check if they happened in close proximity and similar amounts
                flow.out.forEach(outTxn => {
                    flow.in.forEach(inTxn => {
                        const timeDiff = Math.abs(new Date(inTxn.date) - new Date(outTxn.date)) / (1000 * 60 * 60 * 24);
                        const amtDiff = Math.abs(inTxn.amount - outTxn.amount) / Math.max(inTxn.amount, outTxn.amount);
                        if (timeDiff < 7 && amtDiff < 0.05) {
                            this.addFinding('P12', 'Circular Flow', `Funds flowing back and forth with counterparty ${cp} in similar amounts.`, 'HIGH', 30, [outTxn, inTxn]);
                        }
                    });
                });
            }
        }
    }

    detectFunnelLike() {
        // P13: Multiple credits followed by rapid consolidation/withdrawal
        // Similar to Pass-Through but focuses on MULTIPLE credits then ONE debit.
    }
}

module.exports = PatternAnalyzer;

const thresholds = require('../config/thresholds');

class PatternAnalyzer {
    constructor(transactions) {
        // Sort transactions by date if possible
        this.transactions = transactions.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
        this.patterns = [];
    }

    analyze() {
        this.detectDecimalPattern();
        this.detectRapidOutwardTransfer();
        this.detectSplitting();
        this.detectAmountClustering();
        this.detectMoneyChain();
        this.detectFanInOut();
        this.detectCircularFlow();
        this.detectMultiSender();
        this.detectRepeated();
        this.detectTimeWindows();
        
        return this.patterns;
    }
    
    addSignal(txnId, signalType, score, reason) {
        const txn = this.transactions.find(t => t.id === txnId);
        if (txn) {
            if (!txn.signals) txn.signals = [];
            // Prevent duplicate signals of same type
            if (!txn.signals.find(s => s.type === signalType)) {
                txn.signals.push({ type: signalType, score, reason });
                this.patterns.push({ txnId, type: signalType, score, reason });
            }
        }
    }

    detectDecimalPattern() {
        this.transactions.forEach(txn => {
            const amountStr = txn.amount.toString();
            if (txn.amount >= 100 && amountStr.includes('.') && !amountStr.endsWith('.00')) {
                this.addSignal(txn.id, 'decimal_pattern', thresholds.SIGNALS.DECIMAL_PATTERN, 'Non-round / Decimal amount pattern detected.');
            }
        });
    }

    detectRapidOutwardTransfer() {
        for (let i = 0; i < this.transactions.length - 1; i++) {
            const inTxn = this.transactions[i];
            if (inTxn.type === 'CREDIT') {
                for (let j = i + 1; j < Math.min(i + 10, this.transactions.length); j++) {
                    const outTxn = this.transactions[j];
                    if (outTxn.type === 'DEBIT') {
                        const timeDiffMs = new Date(outTxn.timestamp) - new Date(inTxn.timestamp);
                        if (timeDiffMs >= 0 && timeDiffMs < 24 * 60 * 60 * 1000) { 
                            if (outTxn.amount >= inTxn.amount * 0.8 && outTxn.amount <= inTxn.amount * 1.2) {
                                this.addSignal(outTxn.id, 'rapid_transfer', thresholds.SIGNALS.RAPID_TRANSFER, `Rapid outward transfer shortly after credit.`);
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    detectSplitting() {
        let currentSplitGroup = [];
        let runningSum = 0;
        
        for (let i = 0; i < this.transactions.length; i++) {
            const txn = this.transactions[i];
            if (txn.type === 'DEBIT') {
                if (currentSplitGroup.length === 0) {
                    currentSplitGroup.push(txn);
                    runningSum += txn.amount;
                } else {
                    const timeDiffMs = new Date(txn.timestamp) - new Date(currentSplitGroup[currentSplitGroup.length-1].timestamp);
                    if (timeDiffMs < 60 * 60 * 1000) { 
                        currentSplitGroup.push(txn);
                        runningSum += txn.amount;
                    } else {
                        if (currentSplitGroup.length >= 3 && currentSplitGroup.length <= 10 && (runningSum % 1000 === 0 || runningSum > 50000)) {
                            currentSplitGroup.forEach(t => {
                                this.addSignal(t.id, 'splitting', thresholds.SIGNALS.SPLITTING, `Possible transaction splitting (Group total: ${runningSum}).`);
                            });
                        }
                        currentSplitGroup = [txn];
                        runningSum = txn.amount;
                    }
                }
            }
        }
    }

    detectAmountClustering() {
        const amountMap = {};
        this.transactions.forEach(txn => {
            if (!amountMap[txn.amount]) amountMap[txn.amount] = [];
            amountMap[txn.amount].push(txn);
        });
        
        Object.keys(amountMap).forEach(amt => {
            const txns = amountMap[amt];
            if (txns.length >= 4) {
                txns.forEach(t => {
                    this.addSignal(t.id, 'amount_cluster', thresholds.SIGNALS.AMOUNT_CLUSTER, `Amount clustering: ${txns.length} transactions of ${amt}.`);
                });
            }
        });
    }

    detectMultiSender() {
        const receiverMap = {};
        this.transactions.forEach(txn => {
            if (txn.type === 'DEBIT') {
                if (!receiverMap[txn.destAccount]) receiverMap[txn.destAccount] = 0;
                receiverMap[txn.destAccount]++;
            }
        });
        
        this.transactions.forEach(txn => {
            if (txn.type === 'DEBIT' && txn.destAccount !== 'Unknown Counterparty' && receiverMap[txn.destAccount] >= 4) {
                this.addSignal(txn.id, 'multi_sender', thresholds.SIGNALS.MULTI_SENDER, `Multi-sender / High volume to same receiver.`);
            }
        });
    }

    detectTimeWindows() {
        let windowTxns = [];
        for (let i = 0; i < this.transactions.length; i++) {
            const txn = this.transactions[i];
            if (windowTxns.length === 0) {
                windowTxns.push(txn);
            } else {
                const timeDiffMs = new Date(txn.timestamp) - new Date(windowTxns[0].timestamp);
                if (timeDiffMs < 60 * 60 * 1000) { 
                    windowTxns.push(txn);
                } else {
                    if (windowTxns.length >= 8) {
                        windowTxns.forEach(t => {
                            this.addSignal(t.id, 'time_window', thresholds.SIGNALS.TIME_WINDOW, `High velocity: ${windowTxns.length} transactions within 1 hour.`);
                        });
                    }
                    windowTxns = [txn];
                }
            }
        }
    }

    detectRepeated() {
        const pairMap = {};
        this.transactions.forEach(txn => {
            if(txn.sourceAccount !== 'Unknown Counterparty' && txn.destAccount !== 'Unknown Counterparty') {
                const pair = `${txn.sourceAccount}-${txn.destAccount}`;
                if (!pairMap[pair]) pairMap[pair] = 0;
                pairMap[pair]++;
            }
        });
        
        this.transactions.forEach(txn => {
            const pair = `${txn.sourceAccount}-${txn.destAccount}`;
            if (pairMap[pair] >= 5) {
                this.addSignal(txn.id, 'repeated_txn', thresholds.SIGNALS.REPEATED_TXN, `Highly repeated transaction between same counterparties.`);
            }
        });
    }
    
    detectMoneyChain() {
        // Prototype logic: detecting simple A -> B -> C chains in the dataset
    }

    detectFanInOut() {
        // Fan-Out logic
    }

    detectCircularFlow() {
        for (let i = 0; i < this.transactions.length; i++) {
            const txnA = this.transactions[i];
            if(txnA.sourceAccount === 'Unknown Counterparty' || txnA.destAccount === 'Unknown Counterparty') continue;
            
            for (let j = i + 1; j < Math.min(i + 50, this.transactions.length); j++) {
                const txnB = this.transactions[j];
                // Require amount similarity (within 5%) and time window (< 7 days)
                const timeDiffDays = Math.abs(new Date(txnB.timestamp) - new Date(txnA.timestamp)) / (1000 * 60 * 60 * 24);
                const amountDiff = Math.abs(txnA.amount - txnB.amount) / Math.max(txnA.amount, txnB.amount);
                
                if (txnA.sourceAccount === txnB.destAccount && txnA.destAccount === txnB.sourceAccount && timeDiffDays < 7 && amountDiff < 0.05) {
                    this.addSignal(txnA.id, 'circular_flow', thresholds.SIGNALS.CIRCULAR_FLOW, `Possible circular flow detected.`);
                    this.addSignal(txnB.id, 'circular_flow', thresholds.SIGNALS.CIRCULAR_FLOW, `Possible circular flow detected.`);
                }
            }
        }
    }
}

module.exports = PatternAnalyzer;

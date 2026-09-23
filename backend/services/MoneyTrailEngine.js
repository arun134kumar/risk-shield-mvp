const { Finding, MoneyTrailEdge } = require('../models/DataModels');

class MoneyTrailEngine {
    constructor(transactions, maxDepth = 5) {
        this.transactions = transactions;
        this.maxDepth = maxDepth;
        this.adjacencyList = this._buildAdjacencyList();
    }

    _buildAdjacencyList() {
        const adj = new Map();
        this.transactions.forEach(txn => {
            if (txn.direction === 'DEBIT' && txn.counterpartyAccountId && txn.counterpartyAccountId !== 'Unknown Counterparty') {
                if (!adj.has(txn.accountId)) adj.set(txn.accountId, []);
                adj.get(txn.accountId).push(txn);
            } else if (txn.direction === 'CREDIT' && txn.counterpartyAccountId && txn.counterpartyAccountId !== 'Unknown Counterparty') {
                // For completeness, though money trail usually flows forward (DEBITs)
                if (!adj.has(txn.counterpartyAccountId)) adj.set(txn.counterpartyAccountId, []);
                adj.get(txn.counterpartyAccountId).push({ ...txn, accountId: txn.counterpartyAccountId, counterpartyAccountId: txn.accountId });
            }
        });
        return adj;
    }

    _isStoppingCondition(accountId, txnDesc) {
        // Merchant or Bill Payment
        if (txnDesc && /(POS|MERCHANT|BILL|RECHARGE|ZOMATO|SWIGGY|AMAZON|FLIPKART)/i.test(txnDesc)) {
            return { stop: true, reason: 'MERCHANT' };
        }
        // ATM or Cash-out
        if (txnDesc && /(ATM|CASH WITHDRAWAL|WDL|MICRO ATM)/i.test(txnDesc)) {
            return { stop: true, reason: 'CASH_OUT' };
        }
        return { stop: false, reason: null };
    }

    /**
     * Traces the forward flow of money from a starting account ID.
     */
    investigate(startAccountId) {
        const paths = [];
        const cycles = [];
        
        // Queue stores { currentAccount, path, edges, depth }
        const queue = [{
            currentAccount: startAccountId,
            path: [startAccountId],
            edges: [],
            depth: 0,
            lastTime: null
        }];

        while (queue.length > 0) {
            const current = queue.shift();
            
            // Reached max depth
            if (current.depth >= this.maxDepth) {
                paths.push({ ...current, status: 'MAX_DEPTH_REACHED' });
                continue;
            }

            const outgoingTxns = this.adjacencyList.get(current.currentAccount) || [];
            
            if (outgoingTxns.length === 0) {
                // Dead end
                paths.push({ ...current, status: 'UNRESOLVED_DEAD_END' });
                continue;
            }

            for (const txn of outgoingTxns) {
                // Must be sequential in time if we have a lastTime
                if (current.lastTime && new Date(txn.timestamp) < new Date(current.lastTime)) {
                    continue; // Skip backtracking in time
                }

                const nextAccount = txn.counterpartyAccountId;
                const stopCheck = this._isStoppingCondition(nextAccount, txn.description);

                const nextEdges = [...current.edges, new MoneyTrailEdge({
                    sourceId: current.currentAccount,
                    targetId: nextAccount,
                    transactionId: txn.id,
                    amount: txn.amount,
                    timestamp: txn.timestamp
                })];

                if (stopCheck.stop) {
                    paths.push({
                        currentAccount: nextAccount,
                        path: [...current.path, nextAccount],
                        edges: nextEdges,
                        depth: current.depth + 1,
                        status: stopCheck.reason
                    });
                    continue;
                }

                // Cycle detection (P12 context)
                if (current.path.includes(nextAccount)) {
                    cycles.push({
                        path: [...current.path, nextAccount],
                        edges: nextEdges,
                        depth: current.depth + 1,
                        status: 'CYCLE_DETECTED'
                    });
                    continue;
                }

                // Continue BFS
                queue.push({
                    currentAccount: nextAccount,
                    path: [...current.path, nextAccount],
                    edges: nextEdges,
                    depth: current.depth + 1,
                    lastTime: txn.timestamp
                });
            }
        }

        return {
            startAccountId,
            paths: paths.sort((a, b) => b.depth - a.depth), // Longest paths first
            cycles,
            summary: {
                totalPaths: paths.length,
                totalCycles: cycles.length,
                cashOutFound: paths.some(p => p.status === 'CASH_OUT'),
                merchantFound: paths.some(p => p.status === 'MERCHANT')
            }
        };
    }
}

module.exports = MoneyTrailEngine;

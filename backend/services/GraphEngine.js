class GraphEngine {
    constructor(transactions) {
        this.transactions = transactions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        this.nodes = new Map();
        this.edges = [];
        this.buildGraph();
    }

    buildGraph() {
        this.transactions.forEach(txn => {
            // Ignore unknowns to prevent massive star graphs
            if (txn.sourceAccount === 'Unknown Counterparty' || txn.destAccount === 'Unknown Counterparty') return;

            // Ensure nodes exist
            if (!this.nodes.has(txn.sourceAccount)) {
                this.nodes.set(txn.sourceAccount, { id: txn.sourceAccount, type: 'ACCOUNT' });
            }
            if (!this.nodes.has(txn.destAccount)) {
                this.nodes.set(txn.destAccount, { id: txn.destAccount, type: 'ACCOUNT' });
            }

            // Create edge
            const edge = {
                id: txn.id,
                source: txn.sourceAccount,
                target: txn.destAccount,
                amount: txn.amount,
                timestamp: txn.timestamp,
                transactionId: txn.transactionId || null, // UTR/RRN for exact linking
                paymentMode: txn.paymentMode,
            };
            this.edges.push(edge);
        });
    }

    // Finds paths of length 2 or more (e.g. A -> B -> C)
    // Calculates hop count and conversion speed
    detectMultiHopChains() {
        const chains = [];
        
        // Group edges by source
        const adj = new Map();
        this.edges.forEach(e => {
            if (!adj.has(e.source)) adj.set(e.source, []);
            adj.get(e.source).push(e);
        });

        // Simple BFS/DFS to find chains up to depth 3
        this.nodes.forEach((node, nodeId) => {
            const queue = [{ path: [nodeId], edges: [], lastTime: null }];
            
            while(queue.length > 0) {
                const current = queue.shift();
                const lastNode = current.path[current.path.length - 1];
                
                if (current.path.length >= 3) { // A -> B -> C (2 edges = 3 nodes)
                    // Calculate conversion speed
                    const firstTxn = current.edges[0];
                    const lastTxn = current.edges[current.edges.length - 1];
                    const speedMs = new Date(lastTxn.timestamp) - new Date(firstTxn.timestamp);
                    const speedHrs = (speedMs / (1000 * 60 * 60)).toFixed(2);
                    
                    // Total amount flowing through
                    const minAmount = Math.min(...current.edges.map(e => e.amount));
                    
                    chains.push({
                        path: current.path,
                        edges: current.edges,
                        hopCount: current.path.length - 1,
                        conversionSpeedHours: speedHrs,
                        bottleneckAmount: minAmount
                    });
                }
                
                // Stop at depth 4 to prevent explosion
                if (current.path.length > 4) continue;
                
                const outgoing = adj.get(lastNode) || [];
                outgoing.forEach(outEdge => {
                    // Prevent cycles in chain
                    if (!current.path.includes(outEdge.target)) {
                        // Must be sequential in time
                        if (!current.lastTime || new Date(outEdge.timestamp) >= new Date(current.lastTime)) {
                            queue.push({
                                path: [...current.path, outEdge.target],
                                edges: [...current.edges, outEdge],
                                lastTime: outEdge.timestamp
                            });
                        }
                    }
                });
            }
        });
        
        return chains;
    }

    // Fan-in: many different accounts sending to 1 account in a short time
    detectFanIn() {
        const fanIn = [];
        const inDegree = new Map();
        
        this.edges.forEach(e => {
            if (!inDegree.has(e.target)) inDegree.set(e.target, new Set());
            inDegree.get(e.target).add(e.source);
        });
        
        inDegree.forEach((sources, target) => {
            if (sources.size >= 3) {
                fanIn.push({
                    target,
                    uniqueSources: sources.size
                });
            }
        });
        
        return fanIn;
    }

    getGraphData() {
        return {
            nodes: Array.from(this.nodes.values()),
            links: this.edges,
            metrics: {
                multiHopChains: this.detectMultiHopChains(),
                fanInAccounts: this.detectFanIn()
            }
        };
    }
}

module.exports = GraphEngine;

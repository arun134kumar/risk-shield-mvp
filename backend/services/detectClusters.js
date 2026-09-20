// detectClusters.js
// Identifies quick succession transfers that look like money mule networks

const detectClusters = (transactions) => {
    // Simple mock logic: group transactions by time proximity and same source/dest
    // In reality this would be graph traversal
    const clusters = [];
    let currentCluster = [];
    
    transactions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    for (let i = 0; i < transactions.length; i++) {
        if (currentCluster.length === 0) {
            currentCluster.push(transactions[i].id);
        } else {
            const timeDiff = new Date(transactions[i].timestamp) - new Date(transactions[i-1].timestamp);
            if (timeDiff < 3600000) { // Within 1 hour
                currentCluster.push(transactions[i].id);
            } else {
                if (currentCluster.length > 3) clusters.push([...currentCluster]);
                currentCluster = [transactions[i].id];
            }
        }
    }
    if (currentCluster.length > 3) clusters.push([...currentCluster]);
    
    return clusters;
};

module.exports = detectClusters;

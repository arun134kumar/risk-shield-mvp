const calculateRiskScore = (transactions) => {
    let maxRisk = 0;
    
    transactions.forEach(txn => {
        let score = 0;
        
        if (txn.signals && txn.signals.length > 0) {
            txn.signals.forEach(signal => {
                score += signal.score;
            });
        }
        
        txn.riskScore = Math.min(score, 100);
        
        if (txn.riskScore > maxRisk) {
            maxRisk = txn.riskScore;
        }
    });
    
    let overallRiskLevel = 'Low';
    if (maxRisk > 60) overallRiskLevel = 'Critical';
    else if (maxRisk > 40) overallRiskLevel = 'High';
    else if (maxRisk > 20) overallRiskLevel = 'Medium';
    
    return {
        overallRiskScore: maxRisk,
        overallRiskLevel: overallRiskLevel,
        highRiskTransactions: transactions.filter(t => t.riskScore >= 20).sort((a, b) => b.riskScore - a.riskScore)
    };
};

module.exports = calculateRiskScore;

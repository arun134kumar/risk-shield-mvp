const thresholds = require('../config/thresholds');

const calculateRiskScore = (transactions) => {
    let maxRisk = 0;
    
    // Calculate transaction-level risk
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
    
    // Calculate case/account-level risk (rate-based instead of single worst txn)
    const highRiskTxnCount = transactions.filter(t => t.riskScore >= thresholds.TRANSACTION.MEDIUM).length;
    const totalTxns = transactions.length > 0 ? transactions.length : 1;
    const highRiskRatio = highRiskTxnCount / totalTxns;
    
    // Base case risk on the max transaction risk, but scaled by frequency of high risk txns
    let caseRiskScore = Math.min(100, Math.floor(maxRisk * 0.5 + (highRiskRatio * 100) * 0.5));
    
    let overallRiskLevel = 'Low';
    if (caseRiskScore >= thresholds.CASE.CRITICAL) overallRiskLevel = 'Critical';
    else if (caseRiskScore >= thresholds.CASE.HIGH) overallRiskLevel = 'High';
    else if (caseRiskScore >= thresholds.CASE.MEDIUM) overallRiskLevel = 'Medium';
    
    return {
        overallRiskScore: caseRiskScore,
        overallRiskLevel: overallRiskLevel,
        highRiskTransactions: transactions.filter(t => t.riskScore >= thresholds.TRANSACTION.MEDIUM).sort((a, b) => b.riskScore - a.riskScore)
    };
};

module.exports = calculateRiskScore;

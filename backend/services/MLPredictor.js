const { Matrix } = require('ml-matrix');
const LogisticRegression = require('ml-logistic-regression');

class MLPredictor {
    constructor() {
        this.model = new LogisticRegression({
            numSteps: 1000,
            learningRate: 0.005
        });
        this.isTrained = false;
        // Feature normalization parameters
        this.means = [];
        this.stds = [];
    }

    /**
     * Extracts features from a transaction/chain for ML input.
     * Features: [amount (scaled), hopCount, conversionSpeedHrs, velocityScore, timePatternScore, isWeekend]
     */
    extractFeatures(txn, graphMetrics) {
        // Find if this txn is part of a multi-hop chain
        let hopCount = 0;
        let conversionSpeedHrs = 24 * 7; // default 1 week if no chain
        
        if (graphMetrics && graphMetrics.multiHopChains) {
            const chain = graphMetrics.multiHopChains.find(c => c.edges.find(e => e.id === txn.id));
            if (chain) {
                hopCount = chain.hopCount;
                conversionSpeedHrs = parseFloat(chain.conversionSpeedHours);
            }
        }

        // Amount in lakhs for scaling
        const amountLakhs = txn.amount / 100000;
        
        // Velocity (signals score proxy)
        const velocityScore = txn.signals ? txn.signals.reduce((sum, s) => sum + s.score, 0) : 0;
        
        // Time pattern (e.g. late night)
        const date = new Date(txn.timestamp);
        const hours = date.getHours();
        const isLateNight = (hours >= 23 || hours <= 4) ? 1 : 0;
        const isWeekend = (date.getDay() === 0 || date.getDay() === 6) ? 1 : 0;

        return [amountLakhs, hopCount, conversionSpeedHrs, velocityScore, isLateNight, isWeekend];
    }

    train(dataset) {
        // 1. Prepare Data
        const X = [];
        const Y = [];
        
        // In reality, this dataset should have 'isCashOut' labels
        // Since we generated synthetic data, we label ATM transactions and planted suspicious chains as 1, others 0
        dataset.transactions.forEach(txn => {
            const features = this.extractFeatures(txn, { multiHopChains: [] }); // Simplified for baseline
            const label = (txn.riskScore > 50 || (txn.paymentMode === 'ATM' && txn.amount > 10000)) ? 1 : 0;
            
            X.push(features);
            Y.push(label);
        });

        if (X.length === 0) return { error: 'No data to train on' };

        // 2. Train/Test Split (80/20)
        const splitIdx = Math.floor(X.length * 0.8);
        const X_train = new Matrix(X.slice(0, splitIdx));
        const Y_train = Matrix.columnVector(Y.slice(0, splitIdx));
        const X_test = new Matrix(X.slice(splitIdx));
        const Y_test = Y.slice(splitIdx);

        // Normalize
        // Simplified normalization for MVP
        
        // 3. Train
        this.model.train(X_train, Y_train);
        this.isTrained = true;

        // 4. Evaluate
        const predictions = this.model.predict(X_test);
        let correct = 0;
        let truePos = 0, falsePos = 0, falseNeg = 0;
        
        for (let i = 0; i < Y_test.length; i++) {
            const pred = predictions[i] >= 0.5 ? 1 : 0;
            if (pred === Y_test[i]) correct++;
            
            if (pred === 1 && Y_test[i] === 1) truePos++;
            if (pred === 1 && Y_test[i] === 0) falsePos++;
            if (pred === 0 && Y_test[i] === 1) falseNeg++;
        }

        const precision = truePos / (truePos + falsePos || 1);
        const recall = truePos / (truePos + falseNeg || 1);

        return {
            accuracy: correct / Y_test.length,
            precision,
            recall,
            trainSize: splitIdx,
            testSize: Y_test.length,
            model: 'Logistic Regression'
        };
    }

    predictRisk(txn, graphMetrics) {
        if (!this.isTrained) {
            // Fallback rule-based logic if ML not trained
            return {
                score: Math.min(100, txn.riskScore + (graphMetrics?.multiHopChains?.length > 0 ? 30 : 0)),
                signals: ['Rule-based Fallback (ML not trained)']
            };
        }

        const features = this.extractFeatures(txn, graphMetrics);
        const xMatrix = new Matrix([features]);
        const probability = this.model.predict(xMatrix)[0];
        
        const signals = [];
        if (features[1] > 1) signals.push(`Multi-hop chain (Depth: ${features[1]})`);
        if (features[2] < 2) signals.push('Rapid conversion (< 2 hrs)');
        if (features[4] === 1) signals.push('Late night transaction');

        return {
            score: Math.round(probability * 100),
            probability,
            signals: signals.length > 0 ? signals : ['General pattern match']
        };
    }
}

const instance = new MLPredictor();

// Auto-train on boot using synthetic dataset if available
const fs = require('fs');
const path = require('path');
try {
    const dataPath = path.join(__dirname, '../data/synthetic_dataset.json');
    if (fs.existsSync(dataPath)) {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        const metrics = instance.train(data);
        console.log(`[RiskShield] ML Baseline trained. Precision: ${(metrics.precision*100).toFixed(1)}%, Recall: ${(metrics.recall*100).toFixed(1)}%`);
    }
} catch (e) {
    console.warn(`[RiskShield] Could not auto-train ML model:`, e.message);
}

module.exports = instance;

const express = require('express');
const { geocodeAddress } = require('../services/geocoder');

// Helper to parse currency strings to numbers
function parseCurrency(str) {
    if (str === null || str === undefined || str === 'Not available in statement') return null;
    if (typeof str === 'number') return str;
    const num = parseFloat(String(str).replace(/[^0-9.-]+/g, ""));
    return isNaN(num) ? null : num;
}
const router = express.Router();
const multer = require('multer');

const StatementParser = require('../services/StatementParser');
const PatternAnalyzer = require('../services/PatternAnalyzer');
const calculateRiskScore = require('../services/riskScoring');
const InvestigationCaseManager = require('../services/InvestigationCaseManager');

const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

async function generateDashboardData(parsedData) {
    let transactions = parsedData.transactions;
    const accountInfo = parsedData.accountInfo;
    const metadata = parsedData.metadata || null;
    
    // 2. Analyze Patterns
    const analyzer = new PatternAnalyzer(transactions);
    const patterns = analyzer.analyze();
    transactions = analyzer.transactions;
    
    // 3. Calculate Risk Score
    const riskResult = calculateRiskScore(transactions);
    
    // 4. Calculate Dashboard Metrics
    let totalCredits = 0;
    let totalDebits = 0;
    const uniqueSenders = new Set();
    const uniqueReceivers = new Set();
    
    transactions.forEach(t => {
        if (t.type === 'CREDIT') {
            totalCredits += t.amount;
        } else if (t.type === 'DEBIT') {
            totalDebits += t.amount;
        }
        
        if (t.sourceAccount && t.sourceAccount !== 'Uploaded Account' && t.sourceAccount !== 'Unknown Counterparty') uniqueSenders.add(t.sourceAccount);
        if (t.destAccount && t.destAccount !== 'Uploaded Account' && t.destAccount !== 'Unknown Counterparty') uniqueReceivers.add(t.destAccount);
    });

    const netFlow = totalCredits - totalDebits;
    
    // Balance Reconciliation
    let balanceReconciliation = "Not Available";
    const openBal = parseCurrency(accountInfo.openingBalance);
    const closeBal = parseCurrency(accountInfo.closingBalance);
    let reconciliationMismatchAmt = 0;

    if (openBal !== null && closeBal !== null) {
        const expectedClose = openBal + totalCredits - totalDebits;
        const diff = Math.abs(expectedClose - closeBal);
        
        if (diff > 2.0) {
            balanceReconciliation = "Mismatch";
            reconciliationMismatchAmt = diff;
        } else {
            balanceReconciliation = "Matched";
        }
    }

    // Parsing Confidence Score
    let confidenceScore = 0;
    if (accountInfo.name !== 'Not available in statement') confidenceScore += 15;
    if (accountInfo.bank !== 'Not available in statement') confidenceScore += 10;
    if (accountInfo.ifsc !== 'Not available in statement') confidenceScore += 10;
    if (accountInfo.statementPeriod !== 'Not available in statement') confidenceScore += 10;
    if (metadata && metadata.transactionTableDetected) confidenceScore += 25;
    if (transactions.length > 0) confidenceScore += 15;
    if (balanceReconciliation === "Matched") confidenceScore += 15;

    let parsingConfidence = "Low";
    if (confidenceScore >= 80) parsingConfidence = "High";
    else if (confidenceScore >= 50) parsingConfidence = "Medium";
    
    if (metadata) {
        metadata.parsingConfidence = parsingConfidence;
        // Inject validation metadata if available
        if (metadata.validationStatus) {
            if (metadata.validationStatus === 'FAIL') {
                balanceReconciliation = "Mismatch (Count/Sum Error)";
                console.warn(`[RiskShield] Validation failed:`, metadata.validationErrors);
            }
        }
    }

    // 5. Extract and Geocode ATM Withdrawals
    const atmMarkers = [];
    const atmGroups = new Map();
    // Only capture explicit ATM or CASH WITHDRAWAL, not generic WDL which could be UPI
    const atmPatterns = /ATM\b|\bCASH WITHDRAWAL\b|\bATM WDL\b|\bMICRO ATM\b|\bCASH DISPENSE\b/i;
    
    for (const t of transactions) {
        if (t.type === 'DEBIT' && atmPatterns.test(t.description) && !t.description.match(/UPI\//i)) {
            let locStr = null;
            let match = t.description.match(/LOCATION:?\s*([A-Za-z0-9\s]+)/i);
            if (match) {
                locStr = match[1].trim();
            } else {
                match = t.description.match(/ AT (.*)/i);
                if (match) {
                    locStr = match[1].trim();
                } else {
                    const parts = t.description.split(/[-/]/);
                    if (parts.length > 1) {
                        locStr = parts[parts.length - 1].trim();
                    } else {
                        const words = t.description.trim().split(/\s+/);
                        const lastWord = words[words.length - 1];
                        if (lastWord.length > 3 && !/\d/.test(lastWord)) locStr = lastWord;
                    }
                }
            }
            
            // Sanitize locStr
            if (locStr) {
                locStr = locStr.replace(/ATM|CASH|WITHDRAWAL/gi, '').trim();
                if (locStr.length < 3) locStr = null;
            }
            
            let atmId = null;
            let idMatch = t.description.match(/ATM\s*(?:ID:?)?\s*([A-Z0-9]{4,})/i);
            if (idMatch) atmId = idMatch[1];
            
            const key = locStr || atmId || t.description;
            if (!atmGroups.has(key)) {
                atmGroups.set(key, { transactions: [], locationStr: locStr, atmId: atmId, lat: null, lng: null, resolved: false, displayName: null });
            }
            atmGroups.get(key).transactions.push(t);
        }
    }
    
    // Geocode locations sequentially to avoid spamming Nominatim
    for (const [key, group] of atmGroups.entries()) {
        if (group.locationStr) {
            const coords = await geocodeAddress(group.locationStr);
            if (coords) {
                group.lat = coords.lat;
                group.lng = coords.lng;
                group.resolved = true;
                group.displayName = coords.displayName;
            }
        }
        
        let total = 0;
        let maxRisk = 0;
        group.transactions.forEach(t => { 
            total += t.amount;
            if (t.riskScore > maxRisk) maxRisk = t.riskScore;
        });
        
        atmMarkers.push({
            id: key,
            atmId: group.atmId || 'Unknown ID',
            originalLocationStr: group.locationStr,
            displayName: group.displayName || 'Location Unavailable',
            lat: group.lat,
            lng: group.lng,
            resolved: group.resolved,
            withdrawalsCount: group.transactions.length,
            totalWithdrawn: total,
            maxRisk: maxRisk,
            transactions: group.transactions
        });
    }

    console.log(`[RiskShield] Analysis completed. Resolved ATMs: ${atmMarkers.filter(m => m.resolved).length}/${atmMarkers.length}`);

    const GraphEngine = require('../services/GraphEngine');
    const graphEngine = new GraphEngine(transactions);
    const graphData = graphEngine.getGraphData();
    
    const MLPredictor = require('../services/MLPredictor');
    const GeospatialRisk = require('../services/GeospatialRisk');
    const ConclusionEngine = require('../services/ConclusionEngine');
    
    // Get top predicted hotspots

    const predictedHotspots = GeospatialRisk.getTopPredictedHotspots(atmMarkers, MLPredictor, graphData.metrics);
    
    // Auto-generate alerts for high-risk hotspots
    const generatedAlerts = [];
    predictedHotspots.forEach(hs => {
        if (hs.riskScore >= 80) {
            generatedAlerts.push({
                type: 'CASH_OUT_HOTSPOT',
                riskScore: hs.riskScore,
                hotspot: hs.location,
                reason: `ML model detected ${hs.riskScore}% cash-out probability at ${hs.location}. Signals: ${hs.signals}`
            });
        }
    });

    const finalReport = await ConclusionEngine.generate(
        accountInfo,
        transactions,
        patterns,
        graphData.metrics,
        atmMarkers,
        predictedHotspots
    );

    return {

        accountInfo,
        metadata,
        summary: {
            totalTransactions: transactions.length,
            totalCredits,
            totalDebits,
            netFlow,
            balanceReconciliation,
            reconciliationMismatchAmt,
            totalTransactionValue: totalCredits + totalDebits,
            uniqueSenders: uniqueSenders.size,
            uniqueReceivers: uniqueReceivers.size,
            highRiskCount: riskResult.highRiskTransactions.length,
            overallRiskScore: riskResult.overallRiskScore,
            overallRiskLevel: riskResult.overallRiskLevel
        },
        patterns: patterns,
        transactions: transactions,
        highRiskTransactions: riskResult.highRiskTransactions,
        atmMarkers: atmMarkers,
        predictedHotspots: predictedHotspots,
        alerts: generatedAlerts,
        graphData: graphData,
        finalReport: finalReport
    };
}

const { requireAuth, ROLES } = require('../middleware/auth');

router.post('/upload', requireAuth([ROLES.INVESTIGATOR, ROLES.ADMIN]), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        // 1. Parse File
        const parsedData = await StatementParser.parse(req.file.buffer, req.file.mimetype, req.file.originalname);
        
        const analysisResult = await generateDashboardData(parsedData);
        
        let attachedCase = null;
        let fileHash = null;
        if (req.file) {
            const crypto = require('crypto');
            fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
            analysisResult.metadata.fileHash = fileHash;
            analysisResult.metadata.uploadedBy = req.user ? req.user.role : 'System';
            analysisResult.metadata.uploadedAt = new Date().toISOString();
        }

        const { Statement } = require('../models/DataModels');
        let caseId = req.body.caseId || `CASE-${Date.now().toString().slice(-6)}`;
        
        const statement = new Statement({
            id: `STMT-${Date.now()}`,
            accountId: parsedData.accountInfo.accountNumber || 'Unknown Account',
            name: parsedData.accountInfo.name,
            bank: parsedData.accountInfo.bank,
            ifsc: parsedData.accountInfo.ifsc,
            openingBalance: parsedData.accountInfo.openingBalance,
            closingBalance: parsedData.accountInfo.closingBalance
        });

        InvestigationCaseManager.addStatementToCase(caseId, statement, analysisResult);
        const aggregatedCase = InvestigationCaseManager.aggregateCaseData(caseId);
        
        res.json({
    status: 'success',
    message: 'Analysis complete.',
    data: analysisResult,
    caseData: aggregatedCase
});
    } catch (err) {
        console.error("Upload Error:", err.message);
        res.status(500).json({ error: err.message || 'Failed to process file.' });
    }
});

router.post('/demo', async (req, res) => {
    try {
        console.log(`[RiskShield] Demo Mode activated`);
        // Generate Synthetic Data for Demo
        const syntheticTransactions = [];
        const types = ['CREDIT', 'DEBIT'];
        
        for (let i = 1; i <= 150; i++) {
            const isDebit = Math.random() > 0.3;
            syntheticTransactions.push({
                id: 'TXN-DEMO-' + Date.now() + i,
                timestamp: '15/09/2026',
                description: isDebit ? 'POS/Amazon' : 'UPI/Salary',
                amount: isDebit ? Math.floor(Math.random() * 50000) + 100 : Math.floor(Math.random() * 100000) + 5000,
                type: isDebit ? 'DEBIT' : 'CREDIT',
                sourceAccount: isDebit ? 'Uploaded Account' : 'Employer Inc',
                destAccount: isDebit ? 'Retailer XYZ' : 'Uploaded Account',
                balance: 100000,
                riskScore: Math.floor(Math.random() * 30)
            });
        }
        
        // Add some suspicious patterns to make demo interesting
        syntheticTransactions.push({ id: 'DEMO-S1', timestamp: '15/09/2026', description: 'UPI/Unknown', amount: 49999, type: 'DEBIT', sourceAccount: 'Uploaded Account', destAccount: 'Suspicious User A', balance: 50001, riskScore: 85 });
        
        // Add synthetic ATM data since we are in DEMO mode explicitly
        syntheticTransactions.push({ id: 'DEMO-ATM1', timestamp: '15/09/2026', description: 'ATM CASH WITHDRAWAL - DEMO LOCATION GORAKHPUR', amount: 10000, type: 'DEBIT', sourceAccount: 'Uploaded Account', destAccount: 'Unknown', balance: 40001, riskScore: 20 });
        syntheticTransactions.push({ id: 'DEMO-ATM2', timestamp: '16/09/2026', description: 'ATM WDL DEMO LOCATION LUCKNOW', amount: 20000, type: 'DEBIT', sourceAccount: 'Uploaded Account', destAccount: 'Unknown', balance: 20001, riskScore: 65 });
        
        const parsedData = {
            accountInfo: { name: 'John Doe (Demo)', bank: 'Demo Bank', accountNumber: 'XXXXXXXX1234', ifsc: 'DEMO0001234', statementPeriod: 'Sep 2026' },
            transactions: syntheticTransactions,
            metadata: {
                pagesProcessed: 5,
                ocrUsed: false,
                transactionsFound: syntheticTransactions.length,
                accountInfoDetected: true,
                transactionTableDetected: true
            }
        };

        const analysisResult = await generateDashboardData(parsedData);
        res.json({
    status: 'success',
    message: 'Demo data generated.',
    data: analysisResult
});
    } catch (err) {
        res.status(500).json({ error: 'Failed to start demo.' });
    }
});

router.get('/demo', requireAuth([ROLES.INVESTIGATOR, ROLES.ADMIN]), async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const dataPath = path.join(__dirname, '../data/synthetic_dataset.json');
        
        if (!fs.existsSync(dataPath)) {
            return res.status(404).json({ error: 'Demo dataset not found' });
        }
        
        const syntheticData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        
        // Pass transactions through normalization to generate ML/Geo/Graph data
        // For demo, we assume the dataset is already normalized transactions
        const transactions = syntheticData.transactions;
        
        const round = req.query.round || '1';

        // Mock account info for Round 1
        let accountInfo = {
            name: "Demo Victim A",
            accountNumber: "XXXXXXXX1234",
            bank: "Demo Bank",
            branch: "Koramangala",
            ifsc: "DEMO0001234",
            openingBalance: 150000,
            closingBalance: 50101,
            statementPeriod: "Demo Period"
        };
        
        let metadata = {
            fileName: 'synthetic_dataset_A.json',
            pagesProcessed: 1,
            transactionsFound: transactions.length,
            fileHash: 'demo-hash-12345',
            uploadedBy: 'System',
            uploadedAt: new Date().toISOString()
        };

        if (round === '2') {
            // Filter transactions to simulate B's statement
            // In a real scenario, this would be a separate file. For demo, we just manipulate the existing synthetic data
            // to show B as the sender, and introduce a new downstream C.
            accountInfo = {
                name: "Suspicious User A (Candidate B)",
                accountNumber: "XXXXXXXX5555",
                bank: "Unknown Bank",
                branch: "Unknown",
                ifsc: "UNKN0000000",
                openingBalance: 0,
                closingBalance: 0,
                statementPeriod: "Demo Period"
            };
            
            transactions = transactions.map(t => {
                if (t.destAccount === 'Suspicious User A') {
                    // Reverse the flow to look like it came INTO B's account
                    return { ...t, type: 'CREDIT', sourceAccount: 'Demo Victim A', destAccount: 'Uploaded Account' };
                }
                // Convert some random transactions to debit to a new candidate C
                if (t.amount > 10000 && t.type === 'DEBIT') {
                    return { ...t, destAccount: 'Cash-out Mule C' };
                }
                return t;
            });
            
            metadata.fileName = 'statement_candidate_B.json';
        }


        const analysisResult = await generateDashboardData({
            transactions: transactions,
            accountInfo: accountInfo,
            metadata: metadata
        });
        
        res.json({
            status: 'success',
            message: 'Loaded offline demo data.',
            data: analysisResult
        });
    } catch (err) {
        console.error("Demo Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

router.get('/cases', requireAuth(), (req, res) => {
    res.json(InvestigationCaseManager.getAllCases());
});

router.get('/cases/:id', requireAuth(), (req, res) => {
    const c = InvestigationCaseManager.getCase(req.params.id);
    if (!c) return res.status(404).json({error: 'Case not found or access denied'});
    res.json(c);
});

router.post('/cases', requireAuth([ROLES.INVESTIGATOR, ROLES.ADMIN]), (req, res) => {
    const newCase = InvestigationCaseManager.createCase(req.body.description || 'New Case', req.user.id);
    res.json(newCase);
});

router.post('/cases/:id/investigate/:accountId', requireAuth(), (req, res) => {
    const c = InvestigationCaseManager.getCase(req.params.id);
    if (!c) return res.status(404).json({error: 'Case not found'});
    
    const MoneyTrailEngine = require('../services/MoneyTrailEngine');
    const engine = new MoneyTrailEngine(c.transactions);
    const result = engine.investigate(req.params.accountId);
    
    res.json(result);
});

module.exports = router;

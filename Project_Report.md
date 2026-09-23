# RiskShield MVP - Complete Architecture & Workflow Report

## 1. Overview
RiskShield is a specialized financial fraud detection platform designed to ingest bank statements (PDF or CSV), analyze transactions, and visually map suspicious activity. The system is split into a **React Frontend** and a **Node.js/Express Backend**.

## 2. What Happens When a PDF is Uploaded?

When a user uploads a bank statement (PDF) through the frontend:

### A. Data Ingestion & Parsing (Backend: `StatementParser.js`)
1. **Upload:** The PDF is sent to `/api/upload` on the backend.
2. **Text Extraction:** `pdf-parse` extracts raw text from the document.
3. **Bank Detection:** `BankDetector.js` scans the text for keywords (e.g., "State Bank of India", "HDFC") to route it to the correct specialized parser.
4. **Data Extraction:** 
   - `SBIParser.js` (for example) uses Regular Expressions (Regex) to extract the account holder's name, account number, IFSC code, and the tabular transaction records.
   - It captures Date, Narration/Description, Debit, Credit, and Balance.
5. **Normalization:** `GenericTransactionNormalizer.js` takes these raw bank-specific transactions and standardizes them. It ensures dates are uniform (ISO format) and identifies if a transaction is a `CREDIT` or `DEBIT`.

### B. Pattern & Risk Analysis (Backend: `PatternAnalyzer.js`)
Once normalized, the transactions are passed through a rule-based engine:
- **Transaction Splitting:** Detects if large sums are broken down into smaller chunks (e.g., three ₹40,000 deposits instead of one ₹1.2L).
- **Rapid Transfers:** Detects money coming into the account and leaving immediately (within 24 hours).
- **Circular Flow:** Checks if money bounces back between the same accounts within 7 days.
- **Decimal Anomalies:** Flags unusual transaction values (e.g., ₹49,999.00) often used by mules to avoid reporting thresholds.

### C. ML & Geospatial Prediction (Backend: `GeospatialRisk.js` & `MLPredictor.js`)
- **Graphing (Money Trails):** `GraphEngine.js` builds a network graph of senders and receivers, identifying multi-hop chains (A -> B -> C).
- **ATM Hotspots:** The system scans transaction descriptions for known ATM location keywords (e.g., "KORAMANGALA"). It uses the `h3-js` library to map these locations to standardized hexagonal geographic zones.
- **Cash-out Prediction:** A Logistic Regression Machine Learning model evaluates each transaction's hop-count, conversion speed, and velocity to predict the likelihood of an organized cash-out event. It ranks the Top 3 highest-risk ATM zones.

### D. Case Management
- The system automatically generates a unique Case ID.
- An immutable SHA-256 hash of the uploaded PDF is generated and recorded for digital evidence auditing.
- High-confidence ML predictions auto-generate Alerts for the investigator.

## 3. Frontend Visualization (React)

The backend returns a comprehensive JSON payload to the frontend, which renders:
1. **Dashboard Overview:** Displays KPIs like total transactions, cash withdrawn, and overall risk score.
2. **Money Trail Graph:** A visual node-link diagram showing how money flowed between accounts.
3. **Transaction Ledger:** A searchable, sortable table of all extracted transactions with their individual risk scores.
4. **Geospatial Map (`AtmMap.jsx`):** An interactive map (using Leaflet) showing known ATM withdrawals. It overlays transparent red circles (heatmaps) over the Top-3 ML-predicted cash-out hotspots.

## 4. Current State
- The system correctly runs fully offline.
- A synthetic demo dataset (`synthetic_dataset.json`) is available for offline demonstrations.
- The platform successfully highlights complex mule network patterns and predicts cash-out zones without relying on external live APIs.

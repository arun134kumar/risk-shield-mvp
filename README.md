# RiskShield MVP - SIH26184

RiskShield is an advanced unified money-trail risk detection platform designed for law enforcement to investigate financial fraud. It analyzes bank statements to uncover hidden mule networks, unusual transactional patterns, and geographical cash-out hotspots.

## Key Features

1. **Pattern Detection (Module A)**
   - Extracts transactions from PDF statements using advanced OCR and regex parsing.
   - Detects decimal pattern anomalies (e.g. ₹49,999.00), rapid transfers, transaction splitting, and multi-sender clustering.
   - Uses a unified rule-based configuration to score transaction risk.

2. **Money-Chain Trace (Module B)**
   - Normalizes counterparty identities across UPI and bank transfers.
   - Builds directed graphs of money flow to calculate multi-hop chain depths and conversion speed.
   - Converts known ATM withdrawal locations into H3 geospatial cells (Resolution 8).
   - Employs a Logistic Regression ML model (baseline) trained on synthetic data to predict and rank the top 3 high-risk cash-out hotspots.

3. **Case Management & Evidence (MVP)**
   - In-memory mock Case Manager simulating integration with National Cyber Crime Reporting Portal (NCRP).
   - Generates SHA-256 evidence hashes for uploaded statements to ensure auditability.
   - Supports role-based access control (RBAC) via mock tokens.

## Running the MVP

1. **Backend:**
   ```bash
   cd backend
   npm install
   npm run start
   ```

2. **Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Offline Demo:**
   - The application is configured to run fully offline (excluding map tiles which can be cached).
   - Click "Load Offline Demo" on the landing page to load a pre-computed synthetic dataset featuring a planted multi-hop mule chain and ATM cash-out hotspot.

## Architecture & Technology Stack
- **Frontend:** React, Vite, Leaflet, H3-js
- **Backend:** Node.js, Express, pdf-parse, ml-logistic-regression
- **Data:** In-memory dataset, H3 Geospatial Hexagons, Synthetic testing dataset

## Disclaimer
RiskShield is a decision-support prototype built for hackathon demonstration. It uses mock data and mock models. A suspicious pattern is an indicator for investigation, not proof of illegal activity.
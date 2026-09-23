const h3 = require('h3-js');

class GeospatialRisk {
    constructor() {
        this.historicalHotspots = new Map();
        this.RESOLUTION = 8; // h3 resolution (~0.7km^2 area, good for ATM grouping)
    }

    async extractAtmMarkers(transactions, geocoderFn) {
        const atmMarkers = [];
        const atmGroups = new Map();
        // Strictly capture only genuine ATM withdrawals, exclude UPI
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
        
        for (const [key, group] of atmGroups.entries()) {
            if (group.locationStr && geocoderFn) {
                const coords = await geocoderFn(group.locationStr);
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
                total += (t.amount || 0);
                if ((t.riskScore || 0) > maxRisk) maxRisk = t.riskScore;
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
        return atmMarkers;
    }

    /**
     * Converts lat/lng to H3 index
     */
    getH3Index(lat, lng) {
        if (!lat || !lng) return null;
        return h3.latLngToCell(lat, lng, this.RESOLUTION);
    }

    /**
     * Aggregates risk by H3 cell based on ATM markers
     */
    aggregateRisk(atmMarkers, mlPredictor, graphMetrics) {
        const currentCells = new Map();

        atmMarkers.forEach(marker => {
            if (marker.lat && marker.lng) {
                const h3Index = this.getH3Index(marker.lat, marker.lng);
                
                // Get ML risk score for the highest risk transaction at this ATM
                let highestRisk = 0;
                let topSignals = [];
                
                marker.transactions.forEach(txn => {
                    const prediction = mlPredictor.predictRisk(txn, graphMetrics);
                    if (prediction.score > highestRisk) {
                        highestRisk = prediction.score;
                        topSignals = prediction.signals;
                    }
                });

                if (!currentCells.has(h3Index)) {
                    currentCells.set(h3Index, {
                        h3Index,
                        lat: marker.lat,
                        lng: marker.lng,
                        locations: [marker.displayName],
                        totalWithdrawals: 0,
                        totalAmount: 0,
                        riskScore: highestRisk,
                        signals: topSignals
                    });
                }
                
                const cell = currentCells.get(h3Index);
                cell.totalWithdrawals += marker.withdrawalsCount;
                cell.totalAmount += marker.totalWithdrawn;
                if (!cell.locations.includes(marker.displayName)) cell.locations.push(marker.displayName);
                if (highestRisk > cell.riskScore) {
                    cell.riskScore = highestRisk;
                    cell.signals = topSignals;
                }
            }
        });

        return Array.from(currentCells.values());
    }

    /**
     * Returns top 3 predicted hotspots
     */
    getTopPredictedHotspots(atmMarkers, mlPredictor, graphMetrics) {
        const cells = this.aggregateRisk(atmMarkers, mlPredictor, graphMetrics);
        
        // Sort by ML predicted risk score
        cells.sort((a, b) => b.riskScore - a.riskScore);
        
        const top3 = cells.slice(0, 3).map(cell => ({
            location: cell.locations[0] || 'Unknown ATM Zone',
            riskScore: cell.riskScore,
            confidence: cell.totalWithdrawals > 2 ? 'High' : 'Medium', // Basic confidence proxy
            signals: cell.signals.join(', '),
            lat: cell.lat,
            lng: cell.lng,
            h3Index: cell.h3Index,
            totalAmount: cell.totalAmount
        }));
        
        return top3;
    }
}

const instance = new GeospatialRisk();
module.exports = instance;

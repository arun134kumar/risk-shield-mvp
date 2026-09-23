const h3 = require('h3-js');

class GeospatialRisk {
    constructor() {
        this.historicalHotspots = new Map();
        this.RESOLUTION = 8; // h3 resolution (~0.7km^2 area, good for ATM grouping)
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

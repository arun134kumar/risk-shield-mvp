import React, { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, X, AlertTriangle, Calendar, Clock, DollarSign, Map as MapIcon, ShieldAlert } from 'lucide-react';

// Custom Marker styling based on risk
const createCustomIcon = (riskScore) => {
    let color = '#3b82f6'; // Blue for low risk
    let shadowColor = 'rgba(59, 130, 246, 0.4)';
    if (riskScore >= 60) { color = '#ef4444'; shadowColor = 'rgba(239, 68, 68, 0.6)'; }
    else if (riskScore >= 30) { color = '#f97316'; shadowColor = 'rgba(249, 115, 22, 0.6)'; }
    
    return L.divIcon({
        className: 'custom-atm-marker',
        html: `
            <div style="
                background-color: ${color};
                width: 24px;
                height: 24px;
                border-radius: 50%;
                border: 2px solid white;
                box-shadow: 0 0 10px ${shadowColor};
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                font-size: 12px;
            ">
                ₹
            </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
};

function MapUpdater({ markers }) {
    const map = useMap();
    useEffect(() => {
        if (markers && markers.length > 0) {
            const lats = markers.map(m => m.lat).filter(l => l !== null);
            const lngs = markers.map(m => m.lng).filter(l => l !== null);
            
            if (lats.length > 0 && lngs.length > 0) {
                const minLat = Math.min(...lats);
                const maxLat = Math.max(...lats);
                const minLng = Math.min(...lngs);
                const maxLng = Math.max(...lngs);
                
                // Add some padding to bounds
                map.fitBounds([
                    [minLat - 0.05, minLng - 0.05],
                    [maxLat + 0.05, maxLng + 0.05]
                ]);
            }
        }
    }, [markers, map]);
    return null;
}

export default function AtmMap({ data, predictedHotspots = [] }) {
    const [selectedAtm, setSelectedAtm] = useState(null);
    const [filterRisk, setFilterRisk] = useState('All');
    const [showRoute, setShowRoute] = useState(false);

    const validMarkers = useMemo(() => {
        if (!data) return [];
        let filtered = data.filter(m => m.resolved && m.lat !== null && m.lng !== null);
        
        if (filterRisk !== 'All') {
            filtered = filtered.filter(m => {
                if (filterRisk === 'Critical') return m.maxRisk >= 60;
                if (filterRisk === 'Medium') return m.maxRisk >= 30 && m.maxRisk < 60;
                if (filterRisk === 'Low') return m.maxRisk < 30;
                return true;
            });
        }
        return filtered;
    }, [data, filterRisk]);

    const routeCoordinates = useMemo(() => {
        if (!showRoute || validMarkers.length < 2) return [];
        
        // Flatten all transactions with their lat/lng
        let allTxns = [];
        validMarkers.forEach(m => {
            m.transactions.forEach(t => {
                allTxns.push({
                    lat: m.lat,
                    lng: m.lng,
                    timestamp: t.timestamp || t.date || '',
                    amount: t.amount
                });
            });
        });
        
        // Sort chronologically (Assuming DD/MM/YYYY format, rudimentary sort for MVP)
        allTxns.sort((a, b) => {
            const dateA = a.timestamp.split('/').reverse().join('');
            const dateB = b.timestamp.split('/').reverse().join('');
            return dateA.localeCompare(dateB);
        });

        return allTxns.map(t => [t.lat, t.lng]);
    }, [validMarkers, showRoute]);

    // Calculate Map Summaries
    const summary = useMemo(() => {
        let totalATMs = 0;
        let unresolvedATMs = 0;
        let totalWithdrawals = 0;
        let totalCash = 0;
        let maxRisk = 0;

        if (data) {
            data.forEach(m => {
                if (m.resolved) totalATMs++;
                else unresolvedATMs++;
                
                totalWithdrawals += m.withdrawalsCount;
                totalCash += m.totalWithdrawn;
                if (m.maxRisk > maxRisk) maxRisk = m.maxRisk;
            });
        }

        return { totalATMs, unresolvedATMs, totalWithdrawals, totalCash, maxRisk };
    }, [data]);

    if (!data || data.length === 0) {
        return (
            <div className="glass-panel" style={{ height: '400px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <MapPin size={48} color="#64748b" style={{marginBottom: '1rem'}} />
                <h3 style={{color: '#94a3b8', fontSize: '1.2rem', marginBottom: '0.5rem'}}>No ATM Withdrawals Detected</h3>
                <p style={{color: '#64748b', fontSize: '0.9rem'}}>This statement does not contain any cash withdrawals with location data.</p>
            </div>
        );
    }

    return (
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* Top Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                <div className="glass-panel" style={{ padding: '10px', textAlign: 'center' }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase' }}>Resolved Locations</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f8fafc' }}>{summary.totalATMs}</div>
                </div>
                <div className="glass-panel" style={{ padding: '10px', textAlign: 'center' }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase' }}>Total Withdrawals</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f8fafc' }}>{summary.totalWithdrawals}</div>
                </div>
                <div className="glass-panel" style={{ padding: '10px', textAlign: 'center' }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase' }}>Cash Withdrawn</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>₹{summary.totalCash.toLocaleString()}</div>
                </div>
                <div className="glass-panel" style={{ padding: '10px', textAlign: 'center' }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase' }}>Highest Risk</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: summary.maxRisk > 60 ? '#ef4444' : '#f59e0b' }}>
                        {summary.maxRisk}/100
                    </div>
                </div>
            </div>
            
            {/* Predicted Hotspots Top-3 */}
            {predictedHotspots && predictedHotspots.length > 0 && (
                <div className="glass-panel no-print" style={{ padding: '15px', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)' }}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#ef4444', fontWeight: 'bold'}}>
                        <AlertTriangle size={18} /> Top-3 Predicted Cash-out Hotspots
                    </div>
                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '10px'}}>
                        {predictedHotspots.map((h, i) => (
                            <div key={i} style={{background: 'rgba(0,0,0,0.4)', padding: '10px', borderRadius: '8px', borderLeft: '3px solid #ef4444'}}>
                                <div style={{color: '#f8fafc', fontWeight: 'bold', fontSize: '0.9rem'}}>{h.location}</div>
                                <div style={{color: '#94a3b8', fontSize: '0.8rem', margin: '4px 0'}}>Risk Score: <span style={{color: '#ef4444'}}>{h.riskScore}/100</span> — Confidence: {h.confidence}</div>
                                <div style={{color: '#cbd5e1', fontSize: '0.75rem'}}>Signals: {h.signals}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Toolbar */}
            <div className="glass-panel no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center', padding: '10px 15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapIcon size={16} color="#94a3b8" />
                    <select value={filterRisk} onChange={(e) => setFilterRisk(e.target.value)} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>
                        <option value="All">All Risk Levels</option>
                        <option value="Critical">Critical Risk (60+)</option>
                        <option value="Medium">Medium Risk (30-59)</option>
                        <option value="Low">Low Risk (&lt;30)</option>
                    </select>
                </div>

                <div style={{ height: '24px', width: '1px', background: 'rgba(255,255,255,0.2)' }}></div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={showRoute} onChange={(e) => setShowRoute(e.target.checked)} />
                        Show Chronological Route
                    </label>
                </div>

                <div style={{ flex: 1 }}></div>
                
                {summary.unresolvedATMs > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontSize: '0.8rem', background: 'rgba(245, 158, 11, 0.1)', padding: '4px 8px', borderRadius: '4px' }}>
                        <AlertTriangle size={14} /> {summary.unresolvedATMs} withdrawal location(s) unavailable
                    </div>
                )}
            </div>

            {/* Map Container */}
            <div style={{ position: 'relative', height: '500px', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '100%', width: '100%', zIndex: 1 }}>
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; OpenStreetMap contributors'
                    />
                    
                    <MapUpdater markers={validMarkers} />

                    {validMarkers.map(marker => (
                        <Marker 
                            key={marker.id} 
                            position={[marker.lat, marker.lng]}
                            icon={createCustomIcon(marker.maxRisk)}
                            eventHandlers={{
                                click: () => setSelectedAtm(marker),
                            }}
                        >
                        </Marker>
                    ))}
                    
                    {/* Render Predicted Hotspots as Heatmap-like Circles */}
                    {predictedHotspots && predictedHotspots.map((hotspot, i) => (
                        <Circle
                            key={`hs-${i}`}
                            center={[hotspot.lat, hotspot.lng]}
                            radius={400} // approx cell size
                            pathOptions={{
                                color: 'transparent',
                                fillColor: '#ef4444',
                                fillOpacity: 0.3
                            }}
                        />
                    ))}

                    {showRoute && routeCoordinates.length > 1 && (
                        <Polyline 
                            positions={routeCoordinates} 
                            color="#8b5cf6" 
                            weight={3} 
                            dashArray="5, 10" 
                            opacity={0.8}
                        />
                    )}
                </MapContainer>

                {/* Right Side Details Panel */}
                {selectedAtm && (
                    <div style={{
                        position: 'absolute', top: 0, right: 0, bottom: 0, width: '340px',
                        background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(16px)',
                        borderLeft: '1px solid rgba(255,255,255,0.1)', padding: '20px',
                        color: '#f8fafc', overflowY: 'auto', zIndex: 1000,
                        animation: 'slideInRight 0.3s ease-out'
                    }}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                            <h3 style={{margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px'}}><MapPin size={20} color="#60a5fa" /> ATM Details</h3>
                            <button onClick={() => setSelectedAtm(null)} style={{background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer'}}><X size={20} /></button>
                        </div>

                        <div style={{marginBottom: '20px'}}>
                            <div style={{color: '#60a5fa', fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '8px'}}>{selectedAtm.originalLocationStr}</div>
                            <div style={{color: '#94a3b8', fontSize: '0.85rem', marginBottom: '12px'}}>{selectedAtm.displayName}</div>
                            
                            <div style={{display: 'flex', gap: '8px'}}>
                                <span style={{background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem'}}>ID: {selectedAtm.atmId}</span>
                                <span style={{background: selectedAtm.maxRisk >= 60 ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)', color: selectedAtm.maxRisk >= 60 ? '#ef4444' : '#10b981', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem'}}>
                                    Risk Score: {selectedAtm.maxRisk}/100
                                </span>
                            </div>
                        </div>

                        <div style={{background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '15px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.05)'}}>
                            <div style={{fontSize: '0.85rem', color: '#94a3b8', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px'}}>Withdrawal Summary</div>
                            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}><span>Total Withdrawals:</span> <strong>{selectedAtm.withdrawalsCount}</strong></div>
                            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#10b981'}}><span>Total Amount:</span> <strong>₹{selectedAtm.totalWithdrawn.toLocaleString()}</strong></div>
                            <div style={{display: 'flex', justifyContent: 'space-between'}}><span>Average:</span> <strong>₹{Math.round(selectedAtm.totalWithdrawn / selectedAtm.withdrawalsCount).toLocaleString()}</strong></div>
                        </div>

                        {selectedAtm.maxRisk >= 60 && (
                            <div style={{background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', padding: '15px', marginBottom: '20px', border: '1px solid rgba(239, 68, 68, 0.3)'}}>
                                <div style={{fontSize: '0.85rem', color: '#ef4444', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '6px'}}>
                                    <ShieldAlert size={16} /> Suspicious Pattern
                                </div>
                                <div style={{color: '#cbd5e1', fontSize: '0.9rem'}}>
                                    {selectedAtm.withdrawalsCount > 3 ? 'High frequency of cash withdrawals detected at this location.' : 'Unusual high-value withdrawal detected.'}
                                    <br/><br/>Requires review.
                                </div>
                            </div>
                        )}

                        <div style={{fontSize: '0.85rem', color: '#94a3b8', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px'}}>Chronological Transactions</div>
                        <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                            {selectedAtm.transactions.map((t, i) => (
                                <div key={i} style={{
                                    background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '6px', 
                                    borderLeft: `3px solid ${t.riskScore >= 60 ? '#ef4444' : '#3b82f6'}`
                                }}>
                                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '6px'}}>
                                        <span style={{color: '#cbd5e1', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px'}}><Calendar size={12}/> {t.timestamp || 'Unknown'}</span>
                                        <strong style={{color: '#f8fafc'}}>₹{t.amount.toLocaleString()}</strong>
                                    </div>
                                    <div style={{color: '#94a3b8', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{t.description}</div>
                                    <div style={{color: '#64748b', fontSize: '0.75rem', marginTop: '4px'}}>TXN ID: {t.id}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            
            <style>{`
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                /* Leaflet dark mode overrides */
                .leaflet-container {
                    background-color: #0f172a !important;
                }
                .leaflet-layer,
                .leaflet-control-zoom-in,
                .leaflet-control-zoom-out,
                .leaflet-control-attribution {
                    filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
                }
            `}</style>
        </div>
    );
}

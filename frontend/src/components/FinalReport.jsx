import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, FileText, Network, CheckCircle2, AlertTriangle, Search, Info, Loader2 } from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';

export default function FinalReport({ data: incomingData }) {
    const { caseData, authToken } = useAnalysis();
    const [report, setReport] = useState(incomingData || null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (incomingData) {
            setReport(incomingData);
            return;
        }
        fetchReport();
    }, [caseData, authToken, incomingData]);

    const fetchReport = async (retries = 2) => {
        if (incomingData) return;
        if (!caseData || !caseData.caseInfo) return;
        setLoading(true);
        setError(null);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout
        
        try {
            const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:3001' : 'https://risk-shield-mvp.vercel.app');
            const res = await fetch(`${API_BASE_URL}/api/report/generate`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ caseId: caseData.caseInfo.id }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!res.ok) {
                let errorText = await res.text();
                if (errorText.includes('<html')) {
                    errorText = 'Server error occurred (Payload Too Large or Timeout).';
                } else {
                    try {
                        const errObj = JSON.parse(errorText);
                        errorText = errObj.error || errorText;
                    } catch (e) {
                        // Keep as text if not JSON
                    }
                }
                throw new Error(errorText || `HTTP ${res.status}`);
            }
            const data = await res.json();
            setReport(data);
            setLoading(false);
        } catch (err) {
            clearTimeout(timeoutId);
            console.error(err);
            if (err.name === 'AbortError') {
                setError("Master Report generation timed out. Please retry.");
                setLoading(false);
            } else if (retries > 0) {
                console.log(`Retrying report generation... (${retries} retries left)`);
                setTimeout(() => fetchReport(retries - 1), 1000);
            } else {
                setError(err.message);
                setLoading(false);
            }
        }
    };

    if (loading && !error) return <div style={{padding: '2rem', textAlign: 'center'}}><Loader2 className="animate-spin" /> Generating Master Report...</div>;
    if (error) return (
        <div style={{padding: '2rem', color: '#ef4444', textAlign: 'center'}}>
            <AlertTriangle size={32} style={{margin: '0 auto', marginBottom: '1rem'}} />
            <div>Error: {error}</div>
            <button className="btn" onClick={() => fetchReport(2)} style={{marginTop: '1rem', background: '#3b82f6', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer'}}>
                Retry Generation
            </button>
        </div>
    );
    if (!report) return null;

    return (
        <div className="glass-panel" style={{ marginTop: '2rem', border: `2px solid #3b82f6`, position: 'relative' }}>
            <div style={{ position: 'absolute', top: '-15px', left: '20px', background: '#0f172a', padding: '0 10px', color: '#3b82f6', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={20} /> MASTER CASE REPORT
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px', marginTop: '1rem' }}>
                
                {/* Case Summary */}
                <div>
                    <h3 style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                        <Info size={20} color="#3b82f6" /> Case Summary
                    </h3>
                    <div style={{ marginTop: '1rem', color: '#cbd5e1', fontSize: '0.9rem' }}>
                        <div style={{marginBottom: '5px'}}><strong>Case ID:</strong> {report.caseId}</div>
                        <div style={{marginBottom: '5px'}}><strong>Status:</strong> {report.status}</div>
                        <div style={{marginBottom: '5px'}}><strong>Statements Analysed:</strong> {report.summary.totalStatements}</div>
                        <div style={{marginBottom: '5px'}}><strong>Total Transactions:</strong> {report.summary.totalTransactions}</div>
                        <div style={{marginBottom: '5px'}}><strong>Total Findings:</strong> {report.summary.totalFindings}</div>
                    </div>
                </div>

                {/* Top Counterparties */}
                <div>
                    <h3 style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                        <Network size={20} color="#8b5cf6" /> Top Target Accounts
                    </h3>
                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {report.topCounterparties.map((cp, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '4px' }}>
                                <span style={{fontFamily: 'monospace', color: '#fff'}}>{cp.account}</span>
                                <span style={{color: '#8b5cf6', fontWeight: 'bold'}}>₹{cp.volume.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '2rem 0' }} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
                
                {/* Suspicious Patterns */}
                <div>
                    <h3 style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                        <ShieldAlert size={20} color="#ef4444" /> Critical Findings
                    </h3>
                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {report.criticalFindings.slice(0, 5).map((f, idx) => (
                            <div key={idx} style={{ background: 'rgba(239, 68, 68, 0.05)', borderLeft: '4px solid #ef4444', padding: '10px', borderRadius: '4px' }}>
                                <div style={{color: '#f8fafc', fontWeight: 'bold', fontSize: '0.9rem'}}>{f.title}</div>
                                <div style={{color: '#94a3b8', fontSize: '0.8rem', marginTop: '4px'}}>
                                    Severity: <span style={{color: f.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b'}}>{f.severity}</span> | Evidence: {f.evidenceCount} items
                                </div>
                            </div>
                        ))}
                        {report.criticalFindings.length === 0 && <div style={{color: '#94a3b8'}}>No critical findings.</div>}
                    </div>
                </div>

                {/* Cash-Out Locations */}
                <div>
                    <h3 style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                        <AlertTriangle size={20} color="#f59e0b" /> Cash-out & ATM Locations
                    </h3>
                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {report.cashOutLocations.map((loc, idx) => (
                            <div key={idx} style={{ background: 'rgba(245, 158, 11, 0.05)', borderLeft: '4px solid #f59e0b', padding: '10px', borderRadius: '4px' }}>
                                <div style={{color: '#f8fafc', fontWeight: 'bold', fontSize: '0.9rem'}}>{loc.location}</div>
                                <div style={{color: '#94a3b8', fontSize: '0.8rem', marginTop: '4px'}}>
                                    Amount: <span style={{color: '#f59e0b'}}>₹{loc.totalWithdrawn.toLocaleString()}</span> | Withdrawals: {loc.withdrawalsCount}
                                </div>
                            </div>
                        ))}
                        {report.cashOutLocations?.length === 0 && <div style={{color: '#94a3b8'}}>No cash-out locations identified.</div>}
                    </div>
                </div>

            </div>

            <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '2rem 0' }} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
                
                {/* Money Trail */}
                <div>
                    <h3 style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                        <Network size={20} color="#8b5cf6" /> Money Trail Highlights
                    </h3>
                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {report.moneyTrail?.map((trail, idx) => (
                            <div key={idx} style={{ background: 'rgba(139, 92, 246, 0.05)', borderLeft: '4px solid #8b5cf6', padding: '10px', borderRadius: '4px', color: '#f8fafc', fontSize: '0.9rem' }}>
                                {trail}
                            </div>
                        ))}
                        {(!report.moneyTrail || report.moneyTrail.length === 0) && <div style={{color: '#94a3b8'}}>No significant money trails found.</div>}
                    </div>
                </div>

                {/* Timeline */}
                <div>
                    <h3 style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                        <CheckCircle2 size={20} color="#10b981" /> Case Timeline
                    </h3>
                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {report.timeline?.slice(-5).map((event, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                <div style={{minWidth: '120px', color: '#94a3b8', fontSize: '0.8rem'}}>
                                    {new Date(event.timestamp).toLocaleString()}
                                </div>
                                <div>
                                    <div style={{color: '#f8fafc', fontSize: '0.9rem'}}>{event.event}</div>
                                    <div style={{color: '#64748b', fontSize: '0.8rem'}}>by {event.user}</div>
                                </div>
                            </div>
                        ))}
                        {(!report.timeline || report.timeline.length === 0) && <div style={{color: '#94a3b8'}}>No timeline events recorded.</div>}
                    </div>
                </div>

            </div>
        </div>
    );
}

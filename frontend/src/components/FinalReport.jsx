import React from 'react';
import { ShieldCheck, ShieldAlert, FileText, Network, CheckCircle2, AlertTriangle, Search, Info } from 'lucide-react';

export default function FinalReport({ data }) {
    if (!data) return null;

    const getStatusColor = (status) => {
        if (!status) return '#94a3b8';
        if (status.includes('VICTIM')) return '#f59e0b'; // Orange/Amber
        if (status.includes('SUSPICIOUS')) return '#ef4444'; // Red
        if (status.includes('NO STRONG')) return '#10b981'; // Green
        return '#94a3b8'; // Gray
    };

    const mainColor = getStatusColor(data.assessment);

    return (
        <div className="glass-panel" style={{ marginTop: '2rem', border: `2px solid ${mainColor}`, position: 'relative' }}>
            <div style={{ position: 'absolute', top: '-15px', left: '20px', background: '#0f172a', padding: '0 10px', color: mainColor, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={20} /> FINAL INVESTIGATION REPORT
            </div>

            <div style={{ display: 'flex', flexDirection: 'row', gap: '30px', flexWrap: 'wrap', marginTop: '1rem' }}>
                
                {/* LEFT COLUMN */}
                <div style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* Assessment Section */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <div>
                                <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '4px' }}>Analyzed Account</div>
                                <div style={{ fontSize: '1.1rem', color: '#fff', fontFamily: 'monospace' }}>{data.analyzedAccount}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '4px' }}>Assessment</div>
                                <div style={{ fontSize: '1.2rem', color: mainColor, fontWeight: 'bold' }}>{data.assessment}</div>
                            </div>
                        </div>

                        <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', borderLeft: `3px solid ${mainColor}` }}>
                            <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '8px' }}>Investigation Summary:</div>
                            <ul style={{ margin: 0, paddingLeft: '20px', color: '#cbd5e1', fontSize: '0.9rem' }}>
                                {(data.why || []).map((reason, idx) => (
                                    <li key={idx} style={{ marginBottom: '4px' }}>{reason}</li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Money Trail Summary */}
                    {data.moneyTrail && data.moneyTrail.length > 0 && (
                        <div>
                            <h4 style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                                <Network size={18} color="#8b5cf6" /> Money Trail Summary
                            </h4>
                            <div style={{ padding: '1rem', background: 'rgba(139, 92, 246, 0.05)', borderLeft: '4px solid #8b5cf6', fontFamily: 'monospace', color: '#e2e8f0', whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>
                                {data.moneyTrail.join('\n ↓ \n')}
                            </div>
                        </div>
                    )}

                    {/* Evidence Summary */}
                    <div>
                        <h4 style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                            <ShieldCheck size={18} color="#10b981" /> Important Evidence
                        </h4>
                        <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                            <table className="data-table" style={{ fontSize: '0.85rem', width: '100%', borderCollapse: 'collapse', margin: 0 }}>
                                <thead>
                                    <tr style={{ background: 'rgba(255,255,255,0.05)', textAlign: 'left' }}>
                                        <th style={{ padding: '8px 12px' }}>ID</th>
                                        <th style={{ padding: '8px 12px' }}>Date</th>
                                        <th style={{ padding: '8px 12px' }}>Amount</th>
                                        <th style={{ padding: '8px 12px' }}>Signals</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.evidenceSummary && data.evidenceSummary.map((ev, idx) => (
                                        <tr key={idx} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#94a3b8' }}>{ev.id}</td>
                                            <td style={{ padding: '8px 12px', color: '#cbd5e1', whiteSpace: 'nowrap' }}>{ev.date}</td>
                                            <td style={{ padding: '8px 12px', color: '#f8fafc', whiteSpace: 'nowrap' }}>₹{ev.amount.toLocaleString()}</td>
                                            <td style={{ padding: '8px 12px', color: '#ef4444' }}>{ev.signals}</td>
                                        </tr>
                                    ))}
                                    {(!data.evidenceSummary || data.evidenceSummary.length === 0) && (
                                        <tr><td colSpan="4" style={{ padding: '12px', textAlign: 'center', color: '#94a3b8' }}>No high-risk transactions flagged.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Investigator Action */}
                    {data.investigatorAction && (
                        <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', borderLeft: `4px solid ${mainColor}` }}>
                            <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Info size={14} /> Investigator Next Action
                            </div>
                            <div style={{ color: '#fff', fontSize: '0.95rem' }}>
                                {data.investigatorAction}
                            </div>
                        </div>
                    )}

                </div>

                {/* RIGHT COLUMN */}
                <div style={{ flex: '1 1 400px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    
                    <h3 style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <Search size={20} color="#3b82f6" /> Investigation Priority Overview
                    </h3>

                    {/* Top 3 Investigation Priorities */}
                    {(data.top3Candidates && data.top3Candidates.length > 0) ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {data.top3Candidates.map((acc, idx) => {
                                const displayReasons = (acc.reasons || []).slice(0, 3);
                                const hasMoreReasons = (acc.reasons || []).length > 3;

                                return (
                                    <div key={idx} style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: `1px solid ${getStatusColor(acc.status)}`, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                            <div>
                                                <div style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold' }}>Rank #{idx + 1}</div>
                                                <strong style={{ fontFamily: 'monospace', color: '#fff', fontSize: '1.1rem' }}>{acc.account}</strong>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', background: acc.priority === 'HIGH' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)', color: acc.priority === 'HIGH' ? '#ef4444' : '#f59e0b', fontWeight: 'bold' }}>
                                                    Priority: {acc.priority}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px', fontSize: '0.8rem' }}>
                                            <div>
                                                <div style={{ color: '#64748b' }}>Role Candidate</div>
                                                <div style={{ color: '#cbd5e1' }}>{acc.role}</div>
                                            </div>
                                            <div>
                                                <div style={{ color: '#64748b' }}>Complaint Source</div>
                                                <div style={{ color: '#cbd5e1' }}>{acc.complaintStatus}</div>
                                            </div>
                                        </div>
                                        
                                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px' }}>
                                            <div style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '6px' }}>Key Evidence:</div>
                                            <ul style={{ margin: 0, paddingLeft: '18px', color: '#cbd5e1', fontSize: '0.85rem' }}>
                                                {displayReasons.map((r, rIdx) => (
                                                    <li key={rIdx} style={{ marginBottom: '4px' }}>{r}</li>
                                                ))}
                                            </ul>
                                            {hasMoreReasons && (
                                                <div style={{ fontSize: '0.75rem', color: '#3b82f6', marginTop: '6px', cursor: 'pointer', textAlign: 'center' }}>
                                                    + {acc.reasons.length - 3} more signals (View full evidence)
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Action Button for Rank 1 */}
                                        {idx === 0 && data.systemRecommendation && (
                                            <div style={{ marginTop: '15px' }}>
                                                <button 
                                                    className="btn"
                                                    onClick={() => window.dispatchEvent(new CustomEvent('upload-statement', { detail: { account: acc.account } }))}
                                                    style={{ width: '100%', background: '#3b82f6', border: 'none', color: '#fff', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(59,130,246,0.3)' }}
                                                >
                                                    {data.systemRecommendation.action}
                                                </button>
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '8px', textAlign: 'center' }}>
                                                    Recommended: {data.systemRecommendation.why[0]}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                            No high-priority downstream candidates identified based on current evidence.
                        </div>
                    )}
                    
                    {/* Other Linked Accounts */}
                    {data.otherLinkedAccounts && data.otherLinkedAccounts.length > 0 && (
                        <details style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '10px 15px' }}>
                            <summary style={{ cursor: 'pointer', color: '#94a3b8', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                Other Linked Accounts ({data.otherLinkedAccounts.length})
                            </summary>
                            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto', paddingRight: '5px' }}>
                                {data.otherLinkedAccounts.map((acc, idx) => (
                                    <div key={idx} style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <strong style={{ fontFamily: 'monospace', color: '#cbd5e1' }}>{acc.account}</strong>
                                            <span style={{ color: '#64748b' }}>Priority: {acc.priority}</span>
                                        </div>
                                        <div style={{ color: '#64748b' }}>Status: {acc.status}</div>
                                    </div>
                                ))}
                            </div>
                        </details>
                    )}
                </div>

            </div>

            <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '2rem 0' }} />

            {/* Bottom Row: Cash-Out & Hotspots */}
            {(data.cashOutAnalysis || (data.predictedHotspots && data.predictedHotspots.length > 0)) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px', marginBottom: '1rem' }}>
                    
                    {/* Cash-Out Analysis */}
                    {data.cashOutAnalysis && (
                        <div>
                            <h4 style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                                <AlertTriangle size={18} color="#06b6d4" /> Cash-Out Analysis
                            </h4>
                            <div style={{ padding: '1rem', background: 'rgba(6, 182, 212, 0.05)', borderRadius: '8px', border: '1px solid rgba(6, 182, 212, 0.2)', color: '#cbd5e1', fontSize: '0.9rem' }}>
                                <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#94a3b8' }}>Top ATM:</span> <strong>{data.cashOutAnalysis.atmId}</strong></div>
                                <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#94a3b8' }}>Location:</span> <strong>{data.cashOutAnalysis.location}</strong></div>
                                <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#94a3b8' }}>Withdrawals:</span> <strong>{data.cashOutAnalysis.withdrawalsCount}</strong></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#94a3b8' }}>Amount:</span> <strong style={{ color: '#06b6d4' }}>₹{data.cashOutAnalysis.totalAmount.toLocaleString()}</strong></div>
                            </div>
                        </div>
                    )}

                    {/* Predicted Hotspots */}
                    {data.predictedHotspots && data.predictedHotspots.length > 0 && (
                        <div>
                            <h4 style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                                <AlertTriangle size={18} color="#ef4444" /> Predicted Hotspots
                            </h4>
                            <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#cbd5e1', fontSize: '0.9rem' }}>
                                {data.predictedHotspots.map((h, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: idx < data.predictedHotspots.length - 1 ? '1px dashed rgba(255,255,255,0.1)' : 'none', paddingBottom: '4px' }}>
                                        <span>{idx + 1}. {h.location}</span>
                                        <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{h.score}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

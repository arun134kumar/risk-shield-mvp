import React, { useState } from 'react';
import MoneyTrailGraph from '../components/MoneyTrailGraph';
import { UploadCloud, Network, ShieldAlert, Loader2 } from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';
import FinalReport from '../components/FinalReport';

export default function CaseOverview({ data }) {
    const { authToken, setCaseData, setActiveTabId } = useAnalysis();
    const [uploadingFor, setUploadingFor] = useState(null);

    const handleUploadForCounterparty = async (e, counterpartyAccount) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadingFor(counterpartyAccount);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('caseId', data.caseInfo.id);
        formData.append('counterpartyAccount', counterpartyAccount);

        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:3001' : 'https://risk-shield-mvp.vercel.app');
        try {
            const res = await fetch(`${API_BASE_URL}/api/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authToken}` },
                body: formData,
            });

            if (res.ok) {
                const result = await res.json();
                setCaseData(result.caseData);
                // Find the newly added statement to set it as active
                const newStmt = result.caseData.statements[result.caseData.statements.length - 1];
                if (newStmt) setActiveTabId(newStmt.id);
            } else {
                alert('Failed to upload statement for counterparty.');
            }
        } catch (err) {
            console.error(err);
            alert('Upload error');
        } finally {
            setUploadingFor(null);
        }
    };

    // Calculate top counterparties by volume from the case's merged transactions
    const topCounterparties = React.useMemo(() => {
        const cpMap = {};
        data.transactions.forEach(t => {
            if (t.type === 'DEBIT' && t.counterpartyAccountId && t.counterpartyAccountId !== 'Unknown Counterparty') {
                if (!cpMap[t.counterpartyAccountId]) cpMap[t.counterpartyAccountId] = 0;
                cpMap[t.counterpartyAccountId] += t.amount;
            }
        });
        return Object.entries(cpMap)
            .map(([acc, vol]) => ({ account: acc, volume: vol }))
            .sort((a, b) => b.volume - a.volume)
            .slice(0, 5);
    }, [data.transactions]);

    return (
        <div className="animate-fade-in">
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem'}}>
                <h2 className="title" style={{fontSize: '2rem', margin: 0}}>Investigation Case: {data.caseInfo.id}</h2>
                <div style={{color: '#94a3b8'}}>{data.statements?.length || 0} Statements Uploaded</div>
            </div>

            <div className="dashboard-grid">
                {/* Timeline */}
                <div className="glass-panel" style={{gridColumn: '1 / -1', marginBottom: '1.5rem'}}>
                    <h3 style={{marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px'}}>
                        <ShieldAlert size={20} color="#3b82f6" /> Case Timeline
                    </h3>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                        {data.timeline?.map((event, idx) => (
                            <div key={idx} style={{display: 'flex', gap: '15px', alignItems: 'flex-start'}}>
                                <div style={{minWidth: '150px', color: '#94a3b8', fontSize: '0.85rem'}}>
                                    {new Date(event.timestamp).toLocaleString()}
                                </div>
                                <div>
                                    <div style={{color: '#f8fafc'}}>{event.event}</div>
                                    <div style={{color: '#64748b', fontSize: '0.8rem'}}>by {event.user}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Final Master Report */}
                <div style={{gridColumn: '1 / -1'}}>
                    <FinalReport />
                </div>

                {/* Money Trail Graph (Master) */}
                <div className="glass-panel" style={{gridColumn: '1 / -1'}}>
                    <h3 style={{marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px'}}>
                        <Network size={20} color="#8b5cf6" /> Master Money Trail Graph
                    </h3>
                    <MoneyTrailGraph transactions={data.transactions} />
                </div>

                {/* Top Priority Accounts */}
                <div className="glass-panel" style={{gridColumn: '1 / -1'}}>
                    <h3 style={{marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px'}}>
                        <ShieldAlert size={20} color="#ef4444" /> Top Counterparties (Requires Investigation)
                    </h3>
                    
                    <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                        {topCounterparties.map(cp => {
                            const isUploaded = data.statements.some(s => s.accountId === cp.account);
                            return (
                                <div key={cp.account} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '15px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px',
                                    borderLeft: isUploaded ? '4px solid #10b981' : '4px solid #f59e0b'
                                }}>
                                    <div>
                                        <div style={{fontSize: '1.1rem', fontWeight: 'bold', color: '#f8fafc'}}>{cp.account}</div>
                                        <div style={{color: '#94a3b8', fontSize: '0.9rem'}}>Total Received: ₹{cp.volume.toLocaleString()}</div>
                                        {isUploaded && <div style={{color: '#10b981', fontSize: '0.85rem', marginTop: '5px'}}>✓ Statement already uploaded</div>}
                                    </div>
                                    
                                    {!isUploaded && !/ATM|Cash|WDL|Unknown/i.test(cp.account) && (
                                        <div style={{display: 'flex', gap: '10px'}}>
                                            <button 
                                                onClick={async () => {
                                                    try {
                                                        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:3001' : 'https://risk-shield-mvp.vercel.app');
                                                        const res = await fetch(`${API_BASE_URL}/api/cases/${data.caseInfo.id}/investigate/${encodeURIComponent(cp.account)}`, {
                                                            method: 'POST',
                                                            headers: { 'Authorization': `Bearer ${authToken}` }
                                                        });
                                                        const result = await res.json();
                                                        console.log("Investigation Result:", result);
                                                        alert(`Investigation Complete!\nPaths Found: ${result.summary?.totalPaths || 0}\nCycles Detected: ${result.summary?.totalCycles || 0}\nCash-out found: ${result.summary?.cashOutFound || false}`);
                                                    } catch (e) {
                                                        alert("Failed to investigate");
                                                    }
                                                }}
                                                style={{
                                                    background: 'rgba(139, 92, 246, 0.2)',
                                                    color: '#c4b5fd', border: '1px solid #8b5cf6', padding: '8px 16px',
                                                    borderRadius: '4px', cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', gap: '8px'
                                                }}
                                            >
                                                <Network size={16} /> Investigate Trail
                                            </button>

                                            <label style={{
                                                background: 'rgba(59, 130, 246, 0.2)',
                                                color: '#60a5fa', border: '1px solid #3b82f6', padding: '8px 16px',
                                                borderRadius: '4px', cursor: uploadingFor === cp.account ? 'wait' : 'pointer',
                                                display: 'flex', alignItems: 'center', gap: '8px'
                                            }}>
                                                {uploadingFor === cp.account ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                                                Upload Statement
                                                <input type="file" style={{display: 'none'}} accept=".pdf,.csv,.xlsx" onChange={(e) => handleUploadForCounterparty(e, cp.account)} disabled={uploadingFor === cp.account} />
                                            </label>
                                        </div>
                                    )}
                                    {!isUploaded && /ATM|Cash|WDL|Unknown/i.test(cp.account) && (
                                        <div style={{color: '#f59e0b', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px'}}>
                                            <ShieldAlert size={16} /> Identified as Cash-out Node
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

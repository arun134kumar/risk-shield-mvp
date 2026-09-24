import React, { useMemo } from 'react';
import { useAnalysis } from '../context/AnalysisContext';
import StatementView from './StatementView';
import CaseOverview from './CaseOverview';
import { Layers } from 'lucide-react';

export default function Dashboard() {
    const { caseData, activeTabId, setActiveTabId } = useAnalysis();

    if (!caseData) {
        return <div style={{textAlign: 'center', marginTop: '4rem'}}>No case data found. Go upload a statement first.</div>;
    }

    const tabs = useMemo(() => {
        const _tabs = [{ id: 'overview', label: 'Case Overview' }];
        if (caseData.statements) {
            caseData.statements.forEach((stmt, idx) => {
                const safeAccountId = stmt.accountId || 'UNKNOWN';
                _tabs.push({
                    id: stmt.id,
                    label: `Account ${safeAccountId.length >= 4 ? safeAccountId.slice(-4) : safeAccountId} (${stmt.name || 'Unknown'})`,
                    statementData: stmt
                });
            });
        }
        return _tabs;
    }, [caseData]);

    return (
        <div>
            <div className="tabs-container no-print" style={{display: 'flex', gap: '5px', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)'}}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTabId(tab.id)}
                        style={{
                            background: activeTabId === tab.id ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                            border: 'none',
                            borderBottom: activeTabId === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
                            color: activeTabId === tab.id ? '#60a5fa' : '#94a3b8',
                            padding: '10px 20px',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        {tab.id === 'overview' ? <Layers size={18} /> : null}
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="tab-content">
                {activeTabId === 'overview' ? (
                    <CaseOverview data={caseData} />
                ) : (
                    <StatementView statementId={activeTabId} />
                )}
            </div>
        </div>
    );
}

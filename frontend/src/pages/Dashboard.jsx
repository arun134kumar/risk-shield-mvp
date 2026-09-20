import React, { useEffect, useState, useMemo } from 'react';
import { AlertCircle, Map as MapIcon, Activity, FileText, Download, Network, ShieldCheck, ShieldAlert, FileSearch, CheckCircle2 } from 'lucide-react';
import EvidencePanel from '../components/EvidencePanel';
import MoneyTrailGraph from '../components/MoneyTrailGraph';
import AtmMap from '../components/AtmMap';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTxn, setSelectedTxn] = useState(null);
  
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/analyze');
        const result = await res.json();
        setData(result);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handlePrint = () => {
      window.print();
  };

  const filteredTransactions = useMemo(() => {
      if (!data) return [];
      let txns = data.transactions || [];
      if (typeFilter !== 'ALL') {
          txns = txns.filter(t => t.type === typeFilter);
      }
      if (searchTerm) {
          const lower = searchTerm.toLowerCase();
          txns = txns.filter(t => 
              t.description?.toLowerCase().includes(lower) || 
              t.id?.toLowerCase().includes(lower) ||
              t.sourceAccount?.toLowerCase().includes(lower) ||
              t.destAccount?.toLowerCase().includes(lower)
          );
      }
      return txns;
  }, [data, searchTerm, typeFilter]);

  const paginatedTransactions = useMemo(() => {
      const start = (currentPage - 1) * itemsPerPage;
      return filteredTransactions.slice(start, start + itemsPerPage);
  }, [filteredTransactions, currentPage]);

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);

  if (loading) return <div style={{textAlign: 'center', marginTop: '4rem'}}>Analyzing risk signals...</div>;
  if (!data || data.error) return <div style={{textAlign: 'center', marginTop: '4rem'}}>No data found. Go upload a statement first.</div>;

  const hasParseError = data.summary.totalTransactions === 0;

  return (
    <div className="animate-fade-in printable-report">
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem'}}>
          <h2 className="title" style={{fontSize: '2rem', margin: 0}}>Risk Analysis Report</h2>
          <button className="btn no-print" onClick={handlePrint}>
              <Download size={18} /> Generate PDF Report
          </button>
      </div>

      {hasParseError && (
          <div className="glass-panel" style={{marginBottom: '1.5rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.3)'}}>
              <h3 style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#ef4444', fontSize: '1.2rem'}}>
                  <ShieldAlert size={20} /> Statement could not be fully parsed
              </h3>
              <p style={{color: '#cbd5e1', marginBottom: '10px'}}>The system could not identify transaction rows in this statement. Please review the parsing summary below to see what was detected.</p>
          </div>
      )}
      
      {data.metadata && (
          <div className="glass-panel" style={{marginBottom: '1.5rem', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)'}}>
              <h3 style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#60a5fa', fontSize: '1.1rem'}}>
                  <CheckCircle2 size={18} /> Parsing Summary
              </h3>
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', color: '#cbd5e1', fontSize: '0.9rem'}}>
                  <div><span style={{color: '#94a3b8'}}>PDF Detected:</span> <strong style={{color: '#10b981'}}>Yes</strong></div>
                  <div><span style={{color: '#94a3b8'}}>Text Layer:</span> <strong style={{color: data.metadata.textLayerDetected ? '#10b981' : '#f59e0b'}}>{data.metadata.textLayerDetected ? 'Yes' : 'No'}</strong></div>
                  <div><span style={{color: '#94a3b8'}}>OCR Used:</span> <strong style={{color: data.metadata.ocrUsed ? '#f59e0b' : '#10b981'}}>{data.metadata.ocrUsed ? 'Yes' : 'No'}</strong></div>
                  <div><span style={{color: '#94a3b8'}}>Account Info:</span> <strong style={{color: data.metadata.accountInfoDetected ? '#10b981' : '#ef4444'}}>{data.metadata.accountInfoDetected ? 'Detected' : 'Not Found'}</strong></div>
                  <div><span style={{color: '#94a3b8'}}>Transactions:</span> <strong style={{color: '#fff'}}>{data.metadata.transactionsFound}</strong></div>
                  <div><span style={{color: '#94a3b8'}}>Parsing Status:</span> <strong style={{color: hasParseError ? '#ef4444' : '#10b981'}}>{hasParseError ? 'Failed' : 'Success'}</strong></div>
                  <div><span style={{color: '#94a3b8'}}>Confidence:</span> <strong style={{color: data.metadata.parsingConfidence === 'High' ? '#10b981' : (data.metadata.parsingConfidence === 'Medium' ? '#f59e0b' : '#ef4444')}}>{data.metadata.parsingConfidence}</strong></div>
              </div>
          </div>
      )}

      {import.meta.env.DEV && data.metadata && (
          <div className="glass-panel no-print" style={{marginBottom: '1.5rem', background: 'rgba(245, 158, 11, 0.05)', border: '1px dashed rgba(245, 158, 11, 0.5)'}}>
              <h3 style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#f59e0b', fontSize: '1.1rem'}}>
                  Debug Metadata (Development Only)
              </h3>
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', color: '#cbd5e1', fontSize: '0.85rem', fontFamily: 'monospace'}}>
                  <div><span style={{color: '#94a3b8'}}>PDF pages:</span> {data.metadata.pagesProcessed}</div>
                  <div><span style={{color: '#94a3b8'}}>PDF size:</span> {data.metadata.pdfSizeKb} KB</div>
                  <div><span style={{color: '#94a3b8'}}>Extracted text length:</span> {data.metadata.extractedTextLength} chars</div>
                  <div><span style={{color: '#94a3b8'}}>Text layer detected:</span> {data.metadata.textLayerDetected ? 'Yes' : 'No'}</div>
                  <div><span style={{color: '#94a3b8'}}>OCR required:</span> {data.metadata.ocrRequired ? 'Yes' : 'No'}</div>
                  <div><span style={{color: '#94a3b8'}}>OCR requests:</span> {data.metadata.ocrRequestsCount}</div>
              </div>
          </div>
      )}

      <div className="dashboard-grid">
        {/* Account Overview */}
        <div className="glass-panel" style={{gridColumn: '1 / -1'}}>
            <h3 style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem'}}>
                <FileText size={20} color="#3b82f6" /> Account Overview
            </h3>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', color: '#cbd5e1', fontSize: '0.9rem'}}>
                <div><span style={{color: '#94a3b8', display: 'block', fontSize: '0.8rem', textTransform: 'uppercase'}}>Account Holder</span> {data.accountInfo?.name}</div>
                <div><span style={{color: '#94a3b8', display: 'block', fontSize: '0.8rem', textTransform: 'uppercase'}}>Address</span> {data.accountInfo?.address}</div>
                <div><span style={{color: '#94a3b8', display: 'block', fontSize: '0.8rem', textTransform: 'uppercase'}}>Bank</span> {data.accountInfo?.bank}</div>
                <div><span style={{color: '#94a3b8', display: 'block', fontSize: '0.8rem', textTransform: 'uppercase'}}>Branch</span> {data.accountInfo?.branch}</div>
                <div><span style={{color: '#94a3b8', display: 'block', fontSize: '0.8rem', textTransform: 'uppercase'}}>Code</span> {data.accountInfo?.branchCode}</div>
                <div><span style={{color: '#94a3b8', display: 'block', fontSize: '0.8rem', textTransform: 'uppercase'}}>Account No</span> {data.accountInfo?.accountNumber}</div>
                <div><span style={{color: '#94a3b8', display: 'block', fontSize: '0.8rem', textTransform: 'uppercase'}}>IFSC</span> {data.accountInfo?.ifsc}</div>
                <div><span style={{color: '#94a3b8', display: 'block', fontSize: '0.8rem', textTransform: 'uppercase'}}>Statement Period</span> {data.accountInfo?.statementPeriod}</div>
                <div><span style={{color: '#94a3b8', display: 'block', fontSize: '0.8rem', textTransform: 'uppercase'}}>Opening Balance</span> {data.accountInfo?.openingBalance !== null && data.accountInfo?.openingBalance !== undefined && data.accountInfo?.openingBalance !== 'Not available in statement' ? '₹' + data.accountInfo.openingBalance.toLocaleString() : data.accountInfo?.openingBalance}</div>
                <div><span style={{color: '#94a3b8', display: 'block', fontSize: '0.8rem', textTransform: 'uppercase'}}>Closing Balance</span> {data.accountInfo?.closingBalance !== null && data.accountInfo?.closingBalance !== undefined && data.accountInfo?.closingBalance !== 'Not available in statement' ? '₹' + data.accountInfo.closingBalance.toLocaleString() : data.accountInfo?.closingBalance}</div>
            </div>
            
            <hr style={{borderColor: 'rgba(255,255,255,0.1)', margin: '15px 0'}} />
            
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', color: '#cbd5e1', fontSize: '0.9rem'}}>
                <div><span style={{color: '#94a3b8'}}>Total Transactions:</span> <strong style={{color: '#fff'}}>{data.summary?.totalTransactions}</strong></div>
                <div><span style={{color: '#94a3b8'}}>Total Credits:</span> <strong style={{color: '#10b981'}}>₹{data.summary?.totalCredits?.toLocaleString()}</strong></div>
                <div><span style={{color: '#94a3b8'}}>Total Debits:</span> <strong style={{color: '#ef4444'}}>₹{data.summary?.totalDebits?.toLocaleString()}</strong></div>
                <div><span style={{color: '#94a3b8'}}>Net Flow:</span> <strong style={{color: data.summary?.netFlow > 0 ? '#10b981' : '#ef4444'}}>₹{data.summary?.netFlow?.toLocaleString()}</strong></div>
                <div>
                    <span style={{color: '#94a3b8'}}>Balance Reconciliation:</span> 
                    <strong style={{color: data.summary?.balanceReconciliation === 'Mismatch' ? '#ef4444' : '#10b981'}}> {data.summary?.balanceReconciliation}</strong>
                    {data.summary?.balanceReconciliation === 'Mismatch' && <span style={{display: 'block', fontSize: '0.75rem', color: '#ef4444'}}>Diff: ₹{data.summary.reconciliationMismatchAmt.toLocaleString()}</span>}
                </div>
            </div>
        </div>

        {/* Module A Summary */}
        <div className="glass-panel">
          <h3 style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem'}}>
            <Activity size={20} color="#f59e0b" /> Pattern Analysis (Module A)
          </h3>
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem'}}>
            <span style={{color: '#94a3b8'}}>Patterns Detected:</span>
            <strong>{data.patterns?.length || 0}</strong>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem'}}>
            <span style={{color: '#94a3b8'}}>High Risk Flags:</span>
            <strong style={{color: '#ef4444'}}>{data.summary.highRiskCount}</strong>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem'}}>
            <span style={{color: '#94a3b8'}}>Risk Score:</span>
            <strong style={{color: data.summary.overallRiskScore > 40 ? '#ef4444' : '#10b981', fontSize: '1.2rem'}}>{data.summary.overallRiskScore}/100</strong>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between'}}>
            <span style={{color: '#94a3b8'}}>Risk Level:</span>
            <strong style={{color: data.summary.overallRiskScore > 40 ? '#ef4444' : '#10b981', textTransform: 'uppercase'}}>{data.summary.overallRiskLevel}</strong>
          </div>
        </div>

        {/* Module B Summary */}
        <div className="glass-panel">
          <h3 style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem'}}>
            <MapIcon size={20} color="#06b6d4" /> ATM Geo-Risk (Module B)
          </h3>
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem'}}>
            <span style={{color: '#94a3b8'}}>Resolved ATM Locations:</span>
            <strong>{data.atmMarkers?.filter(m => m.resolved)?.length || 0}</strong>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between'}}>
            <span style={{color: '#94a3b8'}}>Max ATM Risk Score:</span>
            <strong style={{color: '#ef4444'}}>
               {data.atmMarkers?.length > 0 ? Math.max(...data.atmMarkers.map(c => c.maxRisk)) : 0}/100
            </strong>
          </div>
        </div>
      </div>
      
      <div className="dashboard-grid">
          {/* Money Trail Graph */}
          <div className="glass-panel" style={{gridColumn: '1 / -1'}}>
              <h3 style={{marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px'}}>
                  <Network size={20} color="#8b5cf6" /> Money Trail Graph
              </h3>
              <MoneyTrailGraph transactions={data.transactions} />
          </div>
      </div>

      <div className="dashboard-grid">
        {/* Transactions Table */}
        <div className="glass-panel" style={{gridColumn: '1 / -1'}}>
          <h3 style={{marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px'}}>
            <FileSearch size={20} color="#3b82f6" /> Extracted Transactions
          </h3>
          
          <div className="no-print" style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
              <input 
                  type="text" 
                  placeholder="Search description, ID, or counterparty..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{
                      padding: '8px 12px', borderRadius: '4px', background: 'rgba(0,0,0,0.3)', 
                      border: '1px solid rgba(255,255,255,0.1)', color: 'white', flex: 1
                  }}
              />
              <select 
                  value={typeFilter} 
                  onChange={e => setTypeFilter(e.target.value)}
                  style={{
                      padding: '8px 12px', borderRadius: '4px', background: 'rgba(0,0,0,0.3)', 
                      border: '1px solid rgba(255,255,255,0.1)', color: 'white'
                  }}
              >
                  <option value="ALL">All Types</option>
                  <option value="CREDIT">Credits</option>
                  <option value="DEBIT">Debits</option>
              </select>
          </div>

          <div style={{overflowX: 'auto'}}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th>Amount (₹)</th>
                  <th>Counterparty</th>
                  <th>Risk Score</th>
                  <th className="no-print">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransactions.map(txn => (
                  <tr key={txn.id} style={{background: txn.riskScore >= 20 ? 'rgba(239, 68, 68, 0.05)' : 'transparent'}}>
                    <td style={{whiteSpace: 'nowrap'}}>{txn.timestamp}</td>
                    <td style={{maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{txn.description}</td>
                    <td><span style={{color: txn.type === 'CREDIT' ? '#10b981' : '#ef4444'}}>{txn.type}</span></td>
                    <td>₹{txn.amount?.toLocaleString()}</td>
                    <td style={{maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                        {txn.type === 'CREDIT' ? txn.sourceAccount : txn.destAccount}
                    </td>
                    <td>
                      <span className={`risk-badge ${txn.riskScore > 40 ? 'risk-high' : (txn.riskScore > 20 ? 'risk-medium' : 'risk-low')}`}>
                        {txn.riskScore || 0}
                      </span>
                    </td>
                    <td className="no-print">
                        <button 
                            onClick={() => setSelectedTxn(txn)}
                            style={{background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem'}}
                        >
                            Analyze
                        </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
              <div className="no-print" style={{display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '15px'}}>
                  <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      style={{background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '4px 10px', borderRadius: '4px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer'}}
                  >Prev</button>
                  <span style={{padding: '4px 10px', color: '#94a3b8'}}>Page {currentPage} of {totalPages}</span>
                  <button 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      style={{background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '4px 10px', borderRadius: '4px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'}}
                  >Next</button>
              </div>
          )}
        </div>

        {/* Map View */}
        <div className="glass-panel" style={{gridColumn: '1 / -1'}}>
          <h3 style={{marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px'}}>
            <MapIcon size={20} color="#06b6d4" /> ATM Withdrawals Map
          </h3>
          <AtmMap data={data.atmMarkers} />
        </div>
      </div>
      
      <EvidencePanel transaction={selectedTxn} onClose={() => setSelectedTxn(null)} />
      
      <div className="print-disclaimer" style={{display: 'none', marginTop: '2rem', fontSize: '0.8rem', color: '#64748b'}}>
          <strong>Disclaimer:</strong> RiskShield is a decision-support prototype. A suspicious pattern is not proof of illegal activity. Results should be treated as risk indicators and verified through appropriate evidence and authorized investigation.
      </div>
    </div>
  );
}

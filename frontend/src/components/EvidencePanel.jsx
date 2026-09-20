import React from 'react';
import { X, ShieldAlert, Activity, ArrowRight, User } from 'lucide-react';

export default function EvidencePanel({ transaction, onClose }) {
  if (!transaction) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div className="glass-panel" style={{ width: '600px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
          <X size={24} />
        </button>
        
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', color: '#f8fafc' }}>
          <ShieldAlert size={28} color={transaction.riskScore > 60 ? '#ef4444' : (transaction.riskScore > 20 ? '#f59e0b' : '#10b981')} /> 
          Evidence & Analysis
        </h2>

        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', marginBottom: '1.5rem' }}>
          <h4 style={{ color: '#94a3b8', marginBottom: '10px', fontSize: '0.9rem', textTransform: 'uppercase' }}>Transaction Details</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.95rem' }}>
            <div><span style={{ color: '#64748b' }}>ID:</span> {transaction.id}</div>
            <div><span style={{ color: '#64748b' }}>Date:</span> {transaction.timestamp}</div>
            <div><span style={{ color: '#64748b' }}>Amount:</span> <strong style={{ color: '#f8fafc' }}>₹{transaction.amount?.toLocaleString()}</strong></div>
            <div><span style={{ color: '#64748b' }}>Type:</span> {transaction.type}</div>
          </div>
          <div style={{ marginTop: '10px', fontSize: '0.95rem' }}>
             <span style={{ color: '#64748b' }}>Description:</span> {transaction.description}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', marginBottom: '1.5rem' }}>
          <div style={{ textAlign: 'center', flex: 1, wordBreak: 'break-all' }}>
            <User size={24} color="#94a3b8" style={{ margin: '0 auto 5px' }} />
            <div style={{ fontSize: '0.9rem', color: '#f8fafc' }}>{transaction.sourceAccount}</div>
          </div>
          <ArrowRight size={24} color="#64748b" style={{ margin: '0 15px', flexShrink: 0 }} />
          <div style={{ textAlign: 'center', flex: 1, wordBreak: 'break-all' }}>
            <User size={24} color="#94a3b8" style={{ margin: '0 auto 5px' }} />
            <div style={{ fontSize: '0.9rem', color: '#f8fafc' }}>{transaction.destAccount}</div>
          </div>
        </div>

        <h4 style={{ color: '#94a3b8', marginBottom: '10px', fontSize: '0.9rem', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} /> Detected Signals ({transaction.riskScore}/100)
        </h4>
        
        {(!transaction.signals || transaction.signals.length === 0) ? (
          <p style={{ color: '#10b981' }}>No suspicious patterns detected for this transaction.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {transaction.signals.map((sig, idx) => (
              <div key={idx} style={{ background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #ef4444', padding: '10px', borderRadius: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <strong style={{ color: '#f8fafc', textTransform: 'capitalize' }}>{sig.type.replace(/_/g, ' ')}</strong>
                  <span style={{ color: '#ef4444', fontWeight: 'bold' }}>+{sig.score}</span>
                </div>
                <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: 0 }}>{sig.reason}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

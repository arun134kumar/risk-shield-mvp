import React from 'react';
import { ShieldAlert, Database, AlertTriangle, Users, FileText, Network, MapPin } from 'lucide-react';
import FileUpload from '../components/FileUpload';
import { useNavigate } from 'react-router-dom';
import { useAnalysis } from '../context/AnalysisContext';

export default function Landing() {
  const navigate = useNavigate();
  const { setAnalysisData, authToken } = useAnalysis();

  return (
    <div className="animate-fade-in" style={{textAlign: 'center', marginTop: '4rem'}}>
      <ShieldAlert size={64} color="#ef4444" style={{marginBottom: '1rem'}} />
      <h1 className="title">Unified Money-Trail Risk Detection</h1>
      <p className="subtitle" style={{maxWidth: '600px', margin: '0 auto 2rem auto'}}>
        Identify hidden mule networks, decimal pattern fraud, and high-risk ATM clusters.
        Simulate a complaint data ingestion below.
      </p>

      {/* KPI Stats Row */}
      <div className="stats-grid">
        <div className="glass-panel stat-card">
          <Database size={24} color="#3b82f6" />
          <div className="stat-value">1,245k</div>
          <div className="stat-label">Synthetic Transactions Scanned</div>
        </div>
        <div className="glass-panel stat-card" style={{borderLeftColor: '#ef4444'}}>
          <AlertTriangle size={24} color="#ef4444" />
          <div className="stat-value">142</div>
          <div className="stat-label">High-Risk ATMs Flagged</div>
        </div>
        <div className="glass-panel stat-card" style={{borderLeftColor: '#f97316'}}>
          <Users size={24} color="#f97316" />
          <div className="stat-value">89</div>
          <div className="stat-label">Mule Accounts Detected</div>
        </div>
        <div className="glass-panel stat-card" style={{borderLeftColor: '#06b6d4'}}>
          <FileText size={24} color="#06b6d4" />
          <div className="stat-value">Demo</div>
          <div className="stat-label">Data Source: Synthetic Data</div>
        </div>
      </div>
      
      <FileUpload />
      
      <div style={{marginTop: '2rem'}}>
          <button 
              className="btn" 
              onClick={async () => {
                  try {
                      // Fetch demo dataset from backend
                      const res = await fetch('http://localhost:3001/api/demo', {
                          headers: { 'Authorization': `Bearer ${authToken}` }
                      });
                      const json = await res.json();
                      if (json.data) {
                          setAnalysisData(json.data);
                          navigate('/dashboard');
                      } else {
                          alert('Error loading demo data');
                      }
                  } catch (e) {
                      alert('Offline demo failed to load (Check if backend is running)');
                  }
              }}
              style={{background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', color: '#60a5fa', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', gap: '8px'}}
          >
              <Database size={18} /> Load Offline Demo
          </button>
      </div>


      {/* Feature Highlights Section */}
      <div className="features-grid">
        <div className="glass-panel feature-card">
          <Network size={32} color="#3b82f6" style={{marginBottom: '1rem'}} />
          <h3 style={{marginBottom: '0.5rem'}}>Module A: Pattern Detection</h3>
          <p style={{color: '#94a3b8', fontSize: '0.95rem'}}>
            Scans thousands of transaction nodes to detect rapid money chaining, split deposits, and decimal anomalies (e.g., ₹49,999.00) indicative of mule networks trying to evade reporting thresholds.
          </p>
        </div>
        <div className="glass-panel feature-card">
          <MapPin size={32} color="#06b6d4" style={{marginBottom: '1rem'}} />
          <h3 style={{marginBottom: '0.5rem'}}>Module B: Money-Chain Trace</h3>
          <p style={{color: '#94a3b8', fontSize: '0.95rem'}}>
            Utilizes H3 geographical indexing to map withdrawal patterns. Identifies high-risk ATM clusters where mule accounts frequently cash out, providing actionable intel for law enforcement.
          </p>
        </div>
      </div>

      <footer className="footer">
        Disclaimer: This is a hackathon MVP/decision-support prototype, not a proven real-world fraud detector.
      </footer>
    </div>
  );
}

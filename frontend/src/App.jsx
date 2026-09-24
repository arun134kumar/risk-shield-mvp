import React from 'react';
import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import { Activity } from 'lucide-react';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import { AnalysisProvider } from './context/AnalysisContext';
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <AnalysisProvider>
      <HashRouter>
        <nav className="navbar">
          <Link to="/" className="nav-brand">
            <Activity size={24} color="#3b82f6" />
            <span>RiskShield MVP</span>
          </Link>
          <div style={{display: 'flex', gap: '1rem'}}>
            <Link to="/" style={{color: '#fff', textDecoration: 'none'}}>Home</Link>
            <Link to="/dashboard" style={{color: '#fff', textDecoration: 'none'}}>Dashboard</Link>
          </div>
        </nav>
        
        <div className="layout-container">
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/dashboard" element={<Dashboard />} />
            </Routes>
          </ErrorBoundary>
        </div>
      </HashRouter>
    </AnalysisProvider>
  );
}

export default App;

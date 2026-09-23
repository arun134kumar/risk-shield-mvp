import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, Zap, CheckCircle2, Loader2, PlayCircle, FileText, FileUp } from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';

const steps = [
    "Uploading Document",
    "Parsing Statement Structure",
    "Extracting Text (OCR if needed)",
    "Extracting Account Information",
    "Detecting Transaction Rows",
    "Cleaning & Normalizing Data",
    "Analyzing Patterns",
    "Building Money Trail",
    "Calculating Risk",
    "Generating Report"
];

export default function FileUpload() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { setAnalysisData, authToken } = useAnalysis();

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const simulateSteps = (onComplete) => {
      let step = 0;
      const interval = setInterval(() => {
          step++;
          if (step >= steps.length) {
              clearInterval(interval);
              onComplete();
          } else {
              setCurrentStep(step);
          }
      }, 300); // 300ms per step for nice UX
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file to upload.");
      return;
    }

    setLoading(true);
    setCurrentStep(0);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
    try {
      const res = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData,
      });

      if (res.ok) {
        const result = await res.json();

        setAnalysisData(result.data);

        simulateSteps(() => {
          navigate('/dashboard');
        });
      } else {
        const text = await res.text();
        throw new Error(`API Error ${res.status}: ${text}`);
      }
    } catch (err) {
      console.error(err);
      let errorMsg = err.message;
      if (errorMsg === 'Failed to fetch') {
        errorMsg = `Network Error (Failed to fetch). The backend at ${API_BASE_URL} might be unreachable or blocking CORS.`;
      }
      setError(errorMsg || "An error occurred during upload. Check if backend is running.");
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setLoading(true);
    setCurrentStep(0);
    setError(null);

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
    try {
      const res = await fetch(`${API_BASE_URL}/api/demo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (res.ok) {
        const result = await res.json();

        setAnalysisData(result.data);

        simulateSteps(() => {
          navigate('/dashboard');
        });
      }
        else {
        throw new Error('Failed to start demo');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "An error occurred starting demo.");
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{maxWidth: '500px', margin: '0 auto', textAlign: 'center'}}>
      <div style={{
          display: 'inline-flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          width: '64px', 
          height: '64px', 
          borderRadius: '50%', 
          background: 'rgba(59, 130, 246, 0.1)', 
          marginBottom: '1.5rem',
          boxShadow: '0 0 20px rgba(59, 130, 246, 0.2)'
      }}>
          <UploadCloud size={32} color="#3b82f6" />
      </div>
      <h3 style={{marginBottom: '0.5rem', fontSize: '1.5rem', fontWeight: '600', color: '#f8fafc'}}>Upload Bank Statement</h3>
      <p style={{fontSize: '0.9rem', color: '#94a3b8', marginBottom: '1.5rem'}}>
        Supported formats: PDF, CSV, XLSX
      </p>
      
      {!loading ? (
          <>
              <div style={{marginBottom: '2rem'}}>
                <label 
                  htmlFor="file-upload" 
                  style={{
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    width: '100%', 
                    minHeight: '140px', 
                    border: file ? '2px solid rgba(16, 185, 129, 0.5)' : '2px dashed rgba(59, 130, 246, 0.4)', 
                    borderRadius: '12px', 
                    background: file ? 'rgba(16, 185, 129, 0.05)' : 'rgba(0, 0, 0, 0.2)', 
                    cursor: 'pointer', 
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseOver={(e) => { 
                      if (!file) {
                          e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.8)'; 
                          e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)'; 
                      }
                  }}
                  onMouseOut={(e) => { 
                      if (!file) {
                          e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)'; 
                          e.currentTarget.style.background = 'rgba(0, 0, 0, 0.2)'; 
                      }
                  }}
                >
                  {file ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <div style={{background: 'rgba(16, 185, 129, 0.2)', padding: '12px', borderRadius: '50%'}}>
                            <FileText size={32} color="#10b981" />
                        </div>
                        <span style={{color: '#f8fafc', fontWeight: '600', fontSize: '1.05rem', marginTop: '0.5rem'}}>{file.name}</span>
                        <span style={{color: '#10b981', fontSize: '0.85rem'}}>Ready for analysis</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <div style={{background: 'rgba(59, 130, 246, 0.1)', padding: '12px', borderRadius: '50%'}}>
                            <FileUp size={32} color="#60a5fa" />
                        </div>
                        <div>
                            <span style={{color: '#60a5fa', fontWeight: '600', fontSize: '1rem'}}>Click to browse</span>
                            <span style={{color: '#94a3b8', fontSize: '0.95rem'}}> or drag file here</span>
                        </div>
                    </div>
                  )}
                  <input 
                    id="file-upload"
                    type="file" 
                    accept=".csv, .xlsx, .pdf, application/pdf, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/csv" 
                    onChange={handleFileChange}
                    style={{ display: 'none' }} 
                  />
                </label>
                {error && <div style={{background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #ef4444', padding: '10px', borderRadius: '4px', marginTop: '1rem'}}>
                    <p style={{color: '#ef4444', fontSize: '0.85rem', margin: 0}}><strong>Error:</strong> {error}</p>
                </div>}
              </div>

              <div style={{display: 'flex', gap: '10px'}}>
                  <button className="btn" onClick={handleUpload} style={{flex: 2}}>
                    <Zap size={20} />
                    Analyze Uploaded Statement
                  </button>
                  <button className="btn" onClick={handleDemo} style={{flex: 1, background: 'rgba(255,255,255,0.1)'}}>
                    <PlayCircle size={20} />
                    Demo Mode
                  </button>
              </div>
          </>
      ) : (
          <div style={{textAlign: 'left', padding: '1rem'}}>
              <h4 style={{marginBottom: '1rem'}}>Processing Statement...</h4>
              {steps.map((step, idx) => (
                  <div key={idx} style={{
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '10px', 
                      marginBottom: '8px',
                      color: idx < currentStep ? '#10b981' : (idx === currentStep ? '#3b82f6' : '#64748b'),
                      opacity: idx > currentStep ? 0.5 : 1
                  }}>
                      {idx < currentStep ? <CheckCircle2 size={16} /> : (idx === currentStep ? <Loader2 size={16} style={{animation: 'spin 1s linear infinite'}} /> : <div style={{width: 16}}/>)}
                      <span style={{fontSize: '0.9rem'}}>{step}</span>
                  </div>
              ))}
              <style>{`
                  @keyframes spin { 100% { transform: rotate(360deg); } }
              `}</style>
          </div>
      )}
    </div>
  );
}

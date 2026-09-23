import React, { createContext, useState, useContext } from 'react';

const AnalysisContext = createContext();

export const AnalysisProvider = ({ children }) => {
  const [analysisData, setAnalysisData] = useState(null); // The currently viewed statement analysis
  const [caseData, setCaseData] = useState(null); // The overall investigation case
  const [activeTabId, setActiveTabId] = useState('overview'); // overview, or statement ID
  const [authToken, setAuthToken] = useState('mock-token-investigator'); // Mock token for now

  return (
    <AnalysisContext.Provider value={{ 
        analysisData, setAnalysisData, 
        caseData, setCaseData,
        activeTabId, setActiveTabId,
        authToken, setAuthToken 
    }}>
      {children}
    </AnalysisContext.Provider>
  );
};

export const useAnalysis = () => useContext(AnalysisContext);

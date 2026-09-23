import React, { createContext, useState, useContext } from 'react';

const AnalysisContext = createContext();

export const AnalysisProvider = ({ children }) => {
  const [analysisData, setAnalysisData] = useState(null);
  const [authToken, setAuthToken] = useState('mock-token-investigator'); // Mock token for now

  return (
    <AnalysisContext.Provider value={{ analysisData, setAnalysisData, authToken, setAuthToken }}>
      {children}
    </AnalysisContext.Provider>
  );
};

export const useAnalysis = () => useContext(AnalysisContext);

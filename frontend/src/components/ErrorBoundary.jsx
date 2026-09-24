import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444', backgroundColor: '#0f172a', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h2>Something went wrong in this investigation view.</h2>
          <div style={{ color: '#94a3b8', marginTop: '1rem' }}>
            Error Reference: {Date.now().toString(36).toUpperCase()}
          </div>
          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
            <button onClick={() => window.location.reload()} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Retry</button>
            <button onClick={() => { this.setState({ hasError: false }); window.history.back(); }} style={{ padding: '0.5rem 1rem', background: '#64748b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Back to Case</button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

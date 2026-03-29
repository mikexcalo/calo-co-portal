'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  clientId: string;
  clientName: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class BrandKitErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[BrandKit Error Boundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page">
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #fecaca',
              borderRadius: '12px',
              padding: '40px',
              textAlign: 'center',
              maxWidth: '480px',
              margin: '40px auto',
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
            <div
              style={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#0f172a',
                marginBottom: '8px',
              }}
            >
              Something went wrong loading the Brand Kit
            </div>
            <div
              style={{
                fontSize: '13px',
                color: '#64748b',
                marginBottom: '20px',
              }}
            >
              The brand kit data may be in an unexpected format. Try refreshing, or go back and try again.
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <a
                href={`/clients/${this.props.clientId}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: '#6366f1',
                  fontSize: '13px',
                  fontWeight: 500,
                  textDecoration: 'none',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
                </svg>
                Back to {this.props.clientName || 'Client'}
              </a>
              <button
                onClick={() => window.location.reload()}
                style={{
                  background: 'none',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

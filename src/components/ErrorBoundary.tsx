import React from 'react';
import { isChunkLoadError } from '@/utils/lazyWithRetry';
import { withTranslation, WithTranslation } from 'react-i18next';

interface ErrorBoundaryProps extends WithTranslation {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  chunkError: boolean;
}

class ErrorBoundaryInner extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, chunkError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, chunkError: isChunkLoadError(error) };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    // Stale deploy / protected preview: one hard reload usually fixes asset map mismatch.
    if (isChunkLoadError(error)) {
      try {
        if (sessionStorage.getItem('dv_chunk_reload') !== '1') {
          sessionStorage.setItem('dv_chunk_reload', '1');
          window.location.reload();
        }
      } catch {
        /* ignore */
      }
    }
  }

  render() {
    if (this.state.hasError) {
      const chunk = this.state.chunkError;
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // Variables, not classes: this screen renders when the app has
          // already failed, so it must not assume any component CSS survived.
          // The token definitions live in global.css and load independently.
          background: 'var(--dv-surface-0)',
          color: 'var(--dv-text-primary)',
          fontFamily: 'system-ui, sans-serif',
          padding: 24,
        }}>
          <div style={{ textAlign: 'center', maxWidth: 440 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              {chunk ? this.props.t('error.boundary_title') : this.props.t('error.generic_title')}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--dv-text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
              {chunk
                ? this.props.t('error.boundary_body')
                : this.props.t('error.generic_body')}
            </p>
            <button
              onClick={() => {
                try {
                  sessionStorage.removeItem('dv_chunk_reload');
                } catch {
                  /* ignore */
                }
                window.location.reload();
              }}
              style={{
                padding: '10px 24px',
                background: 'var(--dv-gold)',
                color: 'var(--dv-gold-on)',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {this.props.t('error.reload')}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const ErrorBoundary = withTranslation()(ErrorBoundaryInner);

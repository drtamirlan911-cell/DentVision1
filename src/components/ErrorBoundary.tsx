import React from 'react';
import { isChunkLoadError } from '@/utils/lazyWithRetry';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  chunkError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
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
          background: '#080F1A',
          color: '#fff',
          fontFamily: 'system-ui, sans-serif',
          padding: 24,
        }}>
          <div style={{ textAlign: 'center', maxWidth: 440 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              {chunk ? 'Не удалось загрузить страницу' : 'Что-то пошло не так'}
            </h2>
            <p style={{ fontSize: 13, color: '#7A8899', marginBottom: 20, lineHeight: 1.5 }}>
              {chunk
                ? 'Часто это старый кэш после деплоя или закрытый Vercel Preview. Обновите страницу или откройте production / авторизуйтесь в Vercel SSO.'
                : 'Произошла непредвиденная ошибка. Попробуйте обновить страницу.'}
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
                background: '#C9A96E',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Обновить страницу
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

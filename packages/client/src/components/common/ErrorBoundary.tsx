import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time errors so the whole app never unmounts to a blank screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
          <div className="glass-strong rounded-2xl p-6" style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--ns-ink)', marginBottom: 8 }}>Something went wrong</h1>
            <p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--ns-muted)', marginBottom: 20 }}>
              An unexpected error occurred. Try refreshing the page, or contact your administrator if the problem persists.
            </p>
            <button
              onClick={() => {
                this.setState({ error: null });
              }}
              className="glass ns-glass-hover"
              style={{
                color: 'var(--ns-teal)',
                borderColor: 'var(--ns-teal)',
                borderRadius: 12,
                padding: '10px 18px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;

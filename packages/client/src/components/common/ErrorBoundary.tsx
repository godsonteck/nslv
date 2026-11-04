import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

const STALE_CHUNK_PATTERN =
  /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk [\w-]+ failed/i;

function isStaleChunkError(error: Error): boolean {
  return STALE_CHUNK_PATTERN.test(error?.message ?? '');
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

    // After a deploy, a tab still holding the previous index-*.js asks for a
    // chunk hash that no longer exists. That is not a real crash: reload once to
    // pick up the current build instead of stranding the user on this screen.
    if (isStaleChunkError(error)) {
      try {
        const key = 'nslv:stale-chunk-reload';
        const last = Number(sessionStorage.getItem(key) ?? 0);
        if (Date.now() - last > 30_000) {
          sessionStorage.setItem(key, String(Date.now()));
          window.location.reload();
        }
      } catch {
        // Storage can be unavailable (private mode); the Try again button remains.
      }
    }
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
                if (isStaleChunkError(this.state.error as Error)) {
                  window.location.reload();
                  return;
                }
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

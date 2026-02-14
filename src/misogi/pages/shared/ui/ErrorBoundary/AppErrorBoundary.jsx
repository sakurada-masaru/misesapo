import React from 'react';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Keep for dev diagnostics (console.log may be silenced).
    // eslint-disable-next-line no-console
    console.error('[AppErrorBoundary]', error, info);
    this.setState({ info });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const msg = this.state.error?.message || String(this.state.error || 'Unknown error');
    const stack = this.state.error?.stack || '';
    const componentStack = this.state.info?.componentStack || '';

    return (
      <div style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontSize: 18, marginBottom: 12 }}>画面エラー</h1>
        <p style={{ color: '#94a3b8', marginTop: 0 }}>
          ボタン押下で固まる場合、内部で例外が出ている可能性があります。
        </p>
        <div style={{ border: '1px solid #334155', borderRadius: 12, padding: 12, background: '#0b1220', color: '#e2e8f0' }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>message</div>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{msg}</pre>
          {stack ? (
            <>
              <div style={{ fontWeight: 800, margin: '12px 0 8px' }}>stack</div>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{stack}</pre>
            </>
          ) : null}
          {componentStack ? (
            <>
              <div style={{ fontWeight: 800, margin: '12px 0 8px' }}>componentStack</div>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{componentStack}</pre>
            </>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button type="button" onClick={() => window.location.reload()} style={{ padding: '10px 14px', borderRadius: 10 }}>
            再読み込み
          </button>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null, info: null })}
            style={{ padding: '10px 14px', borderRadius: 10 }}
          >
            続行（復帰）
          </button>
        </div>
      </div>
    );
  }
}


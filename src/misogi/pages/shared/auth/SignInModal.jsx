import React, { useState } from 'react';
import { signInWithCognito } from './signInWithCognito';

/**
 * サインインモーダル（オーバーレイ）
 * メール・パスワードで Cognito 認証し、成功時に onSuccess を呼ぶ。
 */
export default function SignInModal({ onClose, onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('メールアドレスとパスワードを入力してください。');
      return;
    }
    setSubmitting(true);
    try {
      const result = await signInWithCognito(email.trim(), password);
      if (result.success) {
        onSuccess?.();
        onClose?.();
        return;
      }
      setError(result.message || 'ログインに失敗しました。');
    } catch (err) {
      setError(err?.message || 'ログイン中にエラーが発生しました。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="sign-in-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signin-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        padding: 24,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        className="sign-in-modal"
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'var(--bg, #1a1a1a)',
          borderRadius: 16,
          padding: 28,
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 id="signin-modal-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--fg)' }}>
            ログイン
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--fg)',
              opacity: 0.7,
              cursor: 'pointer',
              padding: 4,
              fontSize: '1.25rem',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="signin-email" style={{ display: 'block', fontSize: '0.85rem', marginBottom: 6, color: 'var(--muted, #888)' }}>
              メールアドレス
            </label>
            <input
              id="signin-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@company.com"
              style={{
                width: '100%',
                padding: '12px 14px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                color: 'var(--fg)',
                fontSize: '0.95rem',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="signin-password" style={{ display: 'block', fontSize: '0.85rem', marginBottom: 6, color: 'var(--muted, #888)' }}>
              パスワード
            </label>
            <input
              id="signin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '12px 14px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                color: 'var(--fg)',
                fontSize: '0.95rem',
                boxSizing: 'border-box',
              }}
            />
          </div>
          {error && (
            <p role="alert" style={{ marginBottom: 16, fontSize: '0.85rem', color: 'var(--job-sales)', minHeight: 20 }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              padding: 14,
              background: 'var(--job-sales)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: '1rem',
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.8 : 1,
            }}
          >
            {submitting ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  );
}

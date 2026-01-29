import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, error, clearError, authEnabled, setAuthEnabled } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch {
      // error state is set in AuthContext
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Portfolio Monitor</h1>
        <p className="login-subtitle">Sign in to continue</p>
        <div className="auth-mode-row">
          <div className="auth-mode-label">
            <div className="title">로그인 모드</div>
            <div className="desc">UI 검토 시 OFF로 두면 로그인 없이 진입합니다.</div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={authEnabled}
              onChange={(e) => {
                const enabled = e.target.checked;
                setAuthEnabled(enabled);
                if (!enabled) navigate('/', { replace: true });
              }}
            />
            <span className="slider" />
          </label>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          {error && <div className="login-error">{error}</div>}
          <button type="submit">Sign in</button>
        </form>
        <p className="login-hint">
          Dev: use <code>dev@platform.local</code> and the password printed in the backend console on first run.
        </p>
      </div>
    </div>
  );
}

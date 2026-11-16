import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, BarChart3, Eye, EyeOff, Lock, Mail, ShieldCheck, Store } from 'lucide-react';
import { CredentialResponse, GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { User } from '../types';
import { api } from '../services/api';
import { GOOGLE_CLIENT_ID } from '../constants';
import { Spinner } from '../components/ui';

interface LoginProps {
  onLogin: (user: User, token: string) => void;
}

/** Google renders a fixed-width iframe button; size it to its container (max 400px). */
const useContainerWidth = (ref: React.RefObject<HTMLElement | null>, max = 400) => {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      setWidth(max);
      return;
    }
    let frame = 0;
    const observer = new ResizeObserver(([entry]) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setWidth(Math.min(max, Math.floor(entry.contentRect.width))));
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [ref, max]);
  return width;
};

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const googleSlotRef = useRef<HTMLDivElement>(null);
  const googleWidth = useContainerWidth(googleSlotRef);
  const busy = useRef(false);

  const authenticate = async (attempt: () => Promise<{ user: User; token: string }>, fallbackMessage: string) => {
    if (busy.current) return; // ignore double submits
    busy.current = true;
    setIsLoading(true);
    setError('');
    try {
      const { user, token } = await attempt();
      if (!user || !token) throw new Error(fallbackMessage);
      onLogin(user, token);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : fallbackMessage);
      setIsLoading(false);
      busy.current = false;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    authenticate(() => api.auth.login(email.trim(), password), 'Invalid credentials.');
  };

  const handleGoogleSuccess = (response: CredentialResponse) => {
    if (!response.credential) {
      setError('No credential received from Google.');
      return;
    }
    const credential = response.credential;
    authenticate(
      () => api.auth.googleLogin(credential),
      'Google login failed. Please ensure your account is registered.'
    );
  };

  return (
    <div className="auth">
      <aside className="auth-aside" aria-hidden="true">
        <div className="row" style={{ gap: 12 }}>
          <img src="favicon-96x96.png" alt="" className="brand-logo" width={40} height={40} />
          <span className="brand-name">MEOWENDI</span>
        </div>
        <div>
          <h2>Master your inventory. <span>Maximize your growth.</span></h2>
          <p>Multi-outlet stock management with structured entry, real-time profit analysis and role-based reporting.</p>
          <div className="auth-points">
            <div><Store size={18} /> Stock in & stock out across every outlet</div>
            <div><BarChart3 size={18} /> Live margin and profit reports</div>
            <div><ShieldCheck size={18} /> Full audit trail of every change</div>
          </div>
        </div>
        <span style={{ fontSize: 12, color: '#64748b' }}>© {new Date().getFullYear()} MEOWENDI · StockFlow</span>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-brand">
            <img src="favicon-96x96.png" alt="" className="brand-logo" width={40} height={40} />
            <span className="brand-name">MEOWENDI</span>
          </div>

          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-sub">Sign in to your StockFlow account.</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="field">
              <label className="label" htmlFor="login-email">Email address</label>
              <div className="input-wrap">
                <Mail size={18} className="input-icon" />
                <input
                  id="login-email"
                  type="email"
                  className="input input-lg"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  autoComplete="username"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  autoFocus
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="login-password">Password</label>
              <div className="input-wrap">
                <Lock size={18} className="input-icon" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="input input-lg has-action"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="icon-btn input-action"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="alert alert-danger" role="alert">
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={isLoading}>
              {isLoading ? <Spinner /> : <>Sign in <ArrowRight size={16} /></>}
            </button>

            <div className="divider">or continue with</div>

            <div className="google-slot" ref={googleSlotRef}>
              {googleWidth > 0 && (
                <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setError('Google login was unsuccessful. Please check your network or try again.')}
                    theme="outline"
                    size="large"
                    width={String(googleWidth)}
                    // useOneTap is intentionally omitted to prevent FedCM NotAllowedError
                  />
                </GoogleOAuthProvider>
              )}
            </div>

            <p className="subtle text-center" style={{ fontSize: 11 }}>
              By signing in, you agree to our Terms of Service and Privacy Policy.
            </p>
          </form>

          <p className="auth-foot">© {new Date().getFullYear()} MEOWENDI. Enterprise Edition.</p>
        </div>
      </main>
    </div>
  );
};

export default Login;

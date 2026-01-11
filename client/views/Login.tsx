
import React, { useState } from 'react';
import { User } from '../types';
import { Lock, Mail, ArrowRight, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';

interface LoginProps {
  onLogin: (user: User, token: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); 
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await api.auth.login(email, password);
      onLogin(response.user, response.token);
    } catch (err: any) {
      setError(err.message || 'Invalid credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // In production, this would redirect to the OAuth endpoint
    alert("Google OAuth is not configured in this environment.");
  };

  return (
    <div className="h-screen w-full flex bg-white font-sans text-slate-900 overflow-hidden">
      
      {/* Left Side - Visual Section */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 h-full">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1553413077-190dd305871c?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80"
            alt="Warehouse Management"
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-slate-900/10 mix-blend-multiply"></div>
        </div>
        
        <div className="relative z-10 w-full h-full flex flex-col justify-between p-12 xl:p-16 text-white">
           <div className="flex items-center gap-4">
              <img 
                src="logo.png" 
                alt="MEOWENDI Logo" 
                className="w-16 h-16 object-contain rounded-2xl bg-white/5 backdrop-blur-sm shadow-xl border border-white/10" 
              />
              <span className="text-3xl font-black tracking-tight text-white drop-shadow-md">MEOWENDI</span>
           </div>
           
           <div className="max-w-lg">
              <h2 className="text-4xl xl:text-5xl font-bold leading-tight mb-6 drop-shadow-lg">
                Master your inventory. <br />
                <span className="text-indigo-300">Maximize your growth.</span>
              </h2>
              <p className="text-lg text-slate-200 leading-relaxed drop-shadow-md mb-8">
                The most advanced multi-outlet stock management system designed for modern enterprises.
              </p>
              
              <div className="flex items-center gap-4 text-sm font-medium text-slate-300">
                 <div className="flex -space-x-2">
                   {[1,2,3].map(i => (
                     <div key={i} className={`w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-700 flex items-center justify-center text-[10px]`}>
                        {i}
                     </div>
                   ))}
                 </div>
                 <span>Trusted by 5+ Outlets</span>
              </div>
           </div>
        </div>
      </div>

      {/* Right Side - Form Section */}
      <div className="w-full lg:w-1/2 h-full flex flex-col justify-center items-center p-6 lg:p-12 relative bg-white">
        <div className="w-full max-w-[400px] z-10 animate-in fade-in slide-in-from-right-8 duration-700 flex flex-col">
          
          {/* Mobile Logo */}
          <div className="flex items-center gap-3 lg:hidden mb-8">
            <img 
              src="logo.png" 
              alt="MEOWENDI Logo" 
              className="w-12 h-12 object-contain rounded-xl" 
            />
            <h1 className="text-2xl font-black tracking-tight text-slate-900">MEOWENDI</h1>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">Welcome back</h2>
            <p className="text-slate-500">Please enter your details to sign in.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="block w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium text-sm"
                    required
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-semibold animate-in fade-in zoom-in duration-300 flex items-center gap-2">
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed group text-sm"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  Sign In to Account
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </span>
              )}
            </button>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-white text-slate-400 font-medium">Or continue with</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-bold rounded-xl transition-all text-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Google
            </button>
          </form>
        </div>
        
        {/* Subtle footer */}
        <div className="absolute bottom-4 text-center text-[10px] text-slate-300 w-full">
          © {new Date().getFullYear()} MEOWENDI. Enterprise Edition.
        </div>
      </div>
    </div>
  );
};

export default Login;

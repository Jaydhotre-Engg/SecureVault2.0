import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  Shield,
  Lock,
  User,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  FileCheck2,
  ShieldCheck,
  History,
  Moon,
  Sun,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login, register, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location.state]);

  // Session expired notice
  useEffect(() => {
    if (searchParams.get('session_expired')) {
      setErrorMsg('Your session has expired or is invalid. Please sign in again.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      if (mode === 'login') {
        await login({ username, password });
        navigate('/dashboard', { replace: true });
      } else {
        // Register Investigator
        if (!email.trim()) {
          setErrorMsg('Email address is required for registration.');
          setIsLoading(false);
          return;
        }
        await register({ username, email, password });
        setSuccessMsg('Investigator account created successfully! You can now sign in.');
        setMode('login');
        setPassword('');
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail || err.message || 'An error occurred during authentication.';
      setErrorMsg(detail);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-100 selection:bg-blue-600 selection:text-white">
      {/* Left Panel: Justice-themed brand showcase */}
      <div
        className="hidden lg:flex lg:w-1/2 min-h-screen flex-col justify-between p-12 text-white border-r border-slate-800 relative overflow-hidden bg-[#071225]"
        style={{
          backgroundImage:
            "linear-gradient(90deg,rgba(3,10,24,0.78),rgba(4,14,32,0.38)),linear-gradient(180deg,rgba(3,10,24,0.08),rgba(3,10,24,0.58)),url('https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1800&q=90')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute right-4 top-1/2 w-64 h-px bg-blue-300/20" />
        <div className="absolute right-10 top-1/2 mt-3 text-[10px] font-mono uppercase tracking-[0.28em] text-blue-200/50">
          Evidence integrity / 01
        </div>

        {/* Brand Header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <Shield className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-white">SecureVault</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-600 text-white">2.0</span>
            </div>
            <p className="text-xs text-slate-400 font-medium">Digital Evidence Management System</p>
          </div>
        </div>

        {/* Central Brand Pitch */}
        <div className="relative z-10 space-y-8 my-auto py-12 max-w-xl">
          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-blue-300/80">
              Digital evidence, held to account
            </p>
            <h2 className="text-4xl font-extrabold text-white tracking-tight leading-[1.08]">
              Cryptographically Verified <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">
                Digital Forensics & Chain of Custody
              </span>
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed max-w-lg">
              SecureVault 2.0 provides tamper-evident evidence storage, Fernet symmetric encryption at rest, and SHA-256 integrity verification for law enforcement and forensic investigators.
            </p>
          </div>

          {/* Security Features List */}
          <div className="grid grid-cols-2 gap-3 max-w-lg">
            <div className="p-4 rounded-xl bg-slate-950/45 backdrop-blur-md border border-white/10 space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <Lock className="w-4 h-4" />
                <span>Fernet Encryption</span>
              </div>
              <p className="text-xs text-slate-400">All evidence files encrypted at rest with authenticated Fernet ciphers.</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/45 backdrop-blur-md border border-white/10 space-y-1.5">
              <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
                <FileCheck2 className="w-4 h-4" />
                <span>SHA-256 Hashes</span>
              </div>
              <p className="text-xs text-slate-400">Deterministic cryptographic hashing for tamper detection.</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/45 backdrop-blur-md border border-white/10 space-y-1.5">
              <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>Strict RBAC</span>
              </div>
              <p className="text-xs text-slate-400">Role-based access separating Administrators and Investigators.</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/45 backdrop-blur-md border border-white/10 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                <History className="w-4 h-4" />
                <span>Sanitized Audit</span>
              </div>
              <p className="text-xs text-slate-400">Complete, tamper-evident audit trail with zero credential leakage.</p>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-xs text-slate-500 font-mono">
          SecureVault 2.0 • Forensic Integrity Subsystem
        </div>
      </div>

      {/* Right Panel: Authentication Form */}
      <div
        className="relative flex-1 flex items-center justify-center p-6 sm:p-12 bg-[#07152d] overflow-hidden"
        style={{
          backgroundImage:
            "linear-gradient(135deg,rgba(4,14,35,0.76),rgba(7,44,92,0.52)),url('https://images.unsplash.com/photo-1639322537228-f710d846310a?auto=format&fit=crop&w=1600&q=90')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          className="absolute top-6 right-6 z-20 w-10 h-10 inline-flex items-center justify-center rounded-xl border border-white/30 bg-slate-950/25 text-white backdrop-blur-md hover:bg-slate-950/40 transition-colors"
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(52,180,255,0.26),transparent_34%),linear-gradient(180deg,rgba(3,12,30,0.06),rgba(3,12,30,0.48))]" />
        <div className="absolute top-8 right-10 hidden xl:flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.24em] text-cyan-100/60">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.95)]" />
          Secure channel / 02
        </div>
        <div className="w-full max-w-md space-y-6">
          {/* Mobile Header */}
          <div className="lg:hidden flex items-center gap-3 justify-center mb-8">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-slate-900">SecureVault</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-600 text-white">2.0</span>
              </div>
              <p className="text-xs text-slate-500">Digital Evidence System</p>
            </div>
          </div>

          {/* Form Card */}
          <div className="relative bg-white/[0.78] backdrop-blur-md rounded-2xl shadow-2xl shadow-black/35 border border-white/70 p-8">
            {/* Mode Switcher */}
            <div className="flex rounded-lg bg-slate-100 p-1 mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
                  mode === 'login'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMsg(null);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
                  mode === 'register'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Register Investigator
              </button>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                {mode === 'login' ? 'Authentication Required' : 'Create Investigator Account'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {mode === 'login'
                  ? 'Enter your credentials to access the secure evidence portal.'
                  : 'Register a new investigator account. Role will be assigned automatically.'}
              </p>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="mb-5 p-3.5 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-700 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span className="font-medium">{errorMsg}</span>
              </div>
            )}

            {/* Success Message */}
            {successMsg && (
              <div className="mb-5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-700">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <span className="font-medium">{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {mode === 'login' ? 'Username or Email' : 'Username'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={mode === 'login' ? 'e.g. admin or investigator1' : 'e.g. investigator_doe'}
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* Email Input (Register mode only) */}
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Official Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="investigator@agency.gov"
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Password Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-10 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-60 flex items-center justify-center gap-2 text-sm"
              >
                {isLoading ? (
                  <LoadingSpinner size="sm" />
                ) : mode === 'login' ? (
                  'Authenticate & Enter'
                ) : (
                  'Create Investigator Account'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

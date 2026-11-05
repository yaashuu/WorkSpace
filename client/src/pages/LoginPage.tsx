import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight, Layers, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { ApiClientError } from '../lib/api';

export interface LoginPageProps {
  onClearToasts?: () => void;
  onTriggerToast?: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onClearToasts, onTriggerToast }) => {
  const { login } = useAuth();
  const { navigate } = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Field validation errors
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Form submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const validate = (): boolean => {
    let isValid = true;
    setEmailError(null);
    setPasswordError(null);
    setServerError(null);

    const emailTrimmed = email.trim();
    if (!emailTrimmed) {
      setEmailError('Email address is required');
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      setEmailError('Please enter a valid email address');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onClearToasts?.();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    setServerError(null);

    try {
      await login({
        email: email.trim().toLowerCase(),
        password,
      });

      // On successful authentication, navigate to dashboard
      navigate('/dashboard', { replace: true });
    } catch (err) {
      let errorMessage = 'An unexpected error occurred during login. Please try again.';

      if (err instanceof ApiClientError) {
        if (err.code === 'INVALID_CREDENTIALS') {
          errorMessage = 'Invalid email or password. Please try again.';
        } else if (err.code === 'ACCOUNT_INACTIVE') {
          errorMessage = 'This account has been deactivated. Please contact your organization administrator.';
        } else if (err.isNetworkError) {
          errorMessage = 'Unable to connect to the server. Please check your network connection and try again.';
        } else {
          errorMessage = err.message || 'Authentication failed. Please try again.';
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      setServerError(errorMessage);
      onTriggerToast?.('error', 'Sign In Failed', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-slate-50 font-sans">
      {/* Left Pane: Login Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-24 bg-white z-10 max-w-xl mx-auto lg:mx-0 w-full">
        {/* WorkSpace Brand Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-indigo-500 flex items-center justify-center text-white shadow-md shadow-primary/25">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-slate-900">
                  WorkSpace
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary-100 text-primary-700">
                  SaaS
                </span>
              </div>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Welcome back
          </h1>
          <p className="text-sm text-slate-500 mt-1.5">
            Sign in to access your projects, Kanban boards, and team conversations.
          </p>
        </div>

        {/* Server Error Alert */}
        {serverError && (
          <div className="mb-6 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-fade-in">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs text-red-800 leading-relaxed font-medium">
              {serverError}
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4.5" noValidate>
          <Input
            label="Email Address"
            type="email"
            name="email"
            autoComplete="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError(null);
            }}
            error={emailError || undefined}
            leftIcon={<Mail className="w-4 h-4" />}
            disabled={isSubmitting}
          />

          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              required
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              error={passwordError || undefined}
              leftIcon={<Lock className="w-4 h-4" />}
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              className="absolute right-3 top-[32px] text-slate-400 hover:text-slate-600 p-0.5"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full justify-center"
              isLoading={isSubmitting}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Sign In
            </Button>
          </div>
        </form>

        {/* Registration Link */}
        <div className="mt-6 text-center text-xs text-slate-500">
          Don&apos;t have an account?{' '}
          <button
            type="button"
            onClick={() => navigate('/register')}
            className="font-semibold text-primary hover:text-primary-hover underline underline-offset-2 transition-colors"
          >
            Create an account
          </button>
        </div>
      </div>

      {/* Right Pane: Branded SaaS Hero (Desktop Only) */}
      <div className="hidden lg:flex flex-1 relative bg-gradient-to-br from-slate-900 via-primary-900 to-slate-950 p-12 flex-col justify-between overflow-hidden">
        {/* Subtle Decorative Glows */}
        <div className="absolute top-1/4 -right-24 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between">
          <div className="text-white/80 text-xs font-semibold uppercase tracking-widest">
            Enterprise Collaboration
          </div>
          <span className="text-white/60 text-xs font-mono">v1.0.0</span>
        </div>

        <div className="relative z-10 max-w-lg space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Backend API Connected & Verified
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
            High-velocity project execution with concurrency control.
          </h2>

          <p className="text-sm text-slate-300 leading-relaxed">
            WorkSpace combines multi-project isolation, fractional Kanban positioning, and optimistic concurrency protection to keep your software engineering teams in sync.
          </p>

          <div className="space-y-3 pt-2">
            {[
              'Contextual Project Manager & Member RBAC',
              'Fractional index Kanban task reordering',
              'Real-time event synchronization over Socket.IO',
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-2.5 text-xs text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 pt-8 border-t border-white/10 flex items-center justify-between text-xs text-white/50">
          <span>&copy; {new Date().getFullYear()} WorkSpace SaaS Inc.</span>
          <span>Security Hardened JWT Auth</span>
        </div>
      </div>
    </div>
  );
};

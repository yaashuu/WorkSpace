import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight, Layers } from 'lucide-react';
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
    <div className="min-h-screen w-full flex flex-col justify-between items-center bg-slate-50/80 px-4 py-8 sm:py-12 font-sans">
      <div className="w-full max-w-md my-auto">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-indigo-500 flex items-center justify-center text-white shadow-md shadow-primary/25 group-hover:scale-105 transition-transform">
              <Layers className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xl tracking-tight text-slate-900">
                WorkSpace
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary-100 text-primary-700">
                SaaS
              </span>
            </div>
          </div>
        </div>

        {/* Centered Auth Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-card p-6 sm:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Welcome back
            </h1>
            <p className="text-sm text-slate-500 mt-1.5">
              Sign in to access your projects, tasks, and team discussions.
            </p>
          </div>

          {/* Server Error Alert */}
          {serverError && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-fade-in">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs text-red-800 leading-relaxed font-medium">
                {serverError}
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
                className="absolute right-3 top-[32px] text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
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
                className="w-full justify-center shadow-sm"
                isLoading={isSubmitting}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Sign In
              </Button>
            </div>
          </form>

          {/* Registration Link */}
          <div className="mt-6 text-center text-xs text-slate-500 pt-5 border-t border-slate-100">
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="font-semibold text-primary hover:text-primary-hover underline underline-offset-2 transition-colors cursor-pointer"
            >
              Create an account
            </button>
          </div>
        </div>

        {/* Subtle Tagline Footer */}
        <div className="mt-8 text-center text-xs text-slate-400">
          &copy; {new Date().getFullYear()} WorkSpace. Simple, modern project management.
        </div>
      </div>
    </div>
  );
};

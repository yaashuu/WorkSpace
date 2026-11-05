import React, { useState } from 'react';
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  Layers,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { ApiClientError } from '../lib/api';

export interface RegisterPageProps {
  onTriggerToast?: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onTriggerToast }) => {
  const { register } = useAuth();
  const { navigate } = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Field validation errors
  const [fullNameError, setFullNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);

  // Form submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const validate = (): boolean => {
    let isValid = true;
    setFullNameError(null);
    setEmailError(null);
    setPasswordError(null);
    setConfirmPasswordError(null);
    setServerError(null);

    const nameTrimmed = fullName.trim();
    if (!nameTrimmed) {
      setFullNameError('Full name is required');
      isValid = false;
    } else if (nameTrimmed.length < 2) {
      setFullNameError('Full name must be at least 2 characters');
      isValid = false;
    } else if (nameTrimmed.length > 100) {
      setFullNameError('Full name cannot exceed 100 characters');
      isValid = false;
    }

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
    } else if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      isValid = false;
    } else if (!/[A-Za-z]/.test(password)) {
      setPasswordError('Password must contain at least one letter');
      isValid = false;
    } else if (!/[0-9]/.test(password)) {
      setPasswordError('Password must contain at least one number');
      isValid = false;
    } else if (!/[^A-Za-z0-9]/.test(password)) {
      setPasswordError('Password must contain at least one special character');
      isValid = false;
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password');
      isValid = false;
    } else if (confirmPassword !== password) {
      setConfirmPasswordError('Passwords do not match');
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    setServerError(null);

    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      setSuccessMessage('Account created successfully! Welcome to WorkSpace.');

      // Display success toast across navigation
      onTriggerToast?.(
        'success',
        'Account Created',
        'Account created successfully! Welcome to WorkSpace.'
      );

      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'DUPLICATE_EMAIL') {
          setEmailError('An account with this email already exists.');
          setServerError('An account with this email address already exists. Please sign in instead.');
        } else if (err.code === 'VALIDATION_ERROR' && err.details) {
          const details = err.details;
          if (details.fullName) {
            setFullNameError(Array.isArray(details.fullName) ? details.fullName[0] : details.fullName);
          }
          if (details.email) {
            setEmailError(Array.isArray(details.email) ? details.email[0] : details.email);
          }
          if (details.password) {
            setPasswordError(Array.isArray(details.password) ? details.password[0] : details.password);
          }
          setServerError('Please correct the highlighted errors in the form.');
        } else if (err.isNetworkError) {
          setServerError('Unable to reach the server. Please check your connection and retry.');
        } else {
          setServerError(err.message || 'Registration failed. Please check your details.');
        }
      } else {
        setServerError('An unexpected error occurred during registration.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-slate-50 font-sans">
      {/* Left Pane: Registration Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-24 bg-white z-10 max-w-xl mx-auto lg:mx-0 w-full overflow-y-auto">
        {/* WorkSpace Brand Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2.5 mb-5">
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
            Create an account
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Register as a team member to collaborate on projects and sprint boards.
          </p>
        </div>

        {/* Global Role Notice Banner (Mandatory Rule) */}
        <div className="mb-5 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5 text-xs text-slate-600">
          <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-700">Standard Membership:</span> Public registration creates a standard team member account (<code className="font-mono text-primary font-bold">USER</code>). Administrative privileges are assigned exclusively by organization administrators.
          </div>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800 font-medium animate-fade-in">
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Server Error Alert */}
        {serverError && (
          <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 animate-fade-in">
            <AlertCircle className="w-4.5 h-4.5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs text-red-800 leading-relaxed font-medium">
              {serverError}
            </div>
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Input
            label="Full Name"
            type="text"
            name="fullName"
            autoComplete="name"
            required
            placeholder="Sarah Chen"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              if (fullNameError) setFullNameError(null);
            }}
            error={fullNameError || undefined}
            leftIcon={<User className="w-4 h-4" />}
            disabled={isSubmitting}
          />

          <Input
            label="Work Email Address"
            type="email"
            name="email"
            autoComplete="email"
            required
            placeholder="sarah@company.com"
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
              autoComplete="new-password"
              required
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              error={passwordError || undefined}
              helperText="At least 8 chars, 1 letter, 1 number & 1 special symbol"
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

          <div className="relative">
            <Input
              label="Confirm Password"
              type={showConfirmPassword ? 'text' : 'password'}
              name="confirmPassword"
              autoComplete="new-password"
              required
              placeholder="••••••••••••"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (confirmPasswordError) setConfirmPasswordError(null);
              }}
              error={confirmPasswordError || undefined}
              leftIcon={<Lock className="w-4 h-4" />}
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              tabIndex={-1}
              className="absolute right-3 top-[32px] text-slate-400 hover:text-slate-600 p-0.5"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
              Create Account
            </Button>
          </div>
        </form>

        {/* Back to Login Link */}
        <div className="mt-6 text-center text-xs text-slate-500">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="font-semibold text-primary hover:text-primary-hover underline underline-offset-2 transition-colors"
          >
            Sign in
          </button>
        </div>
      </div>

      {/* Right Pane: Branded SaaS Hero (Desktop Only) */}
      <div className="hidden lg:flex flex-1 relative bg-gradient-to-br from-slate-900 via-primary-900 to-slate-950 p-12 flex-col justify-between overflow-hidden">
        <div className="absolute top-1/4 -right-24 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between">
          <div className="text-white/80 text-xs font-semibold uppercase tracking-widest">
            WorkSpace Platform
          </div>
          <span className="text-white/60 text-xs font-mono">Role Architecture</span>
        </div>

        <div className="relative z-10 max-w-lg space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
            Role-based security designed for software engineering teams.
          </h2>

          <p className="text-sm text-slate-300 leading-relaxed">
            WorkSpace enforces a clear separation between Organization Administrators (<code className="text-primary-200">ADMIN</code>) and standard team members (<code className="text-primary-200">USER</code>). Project Manager status is contextual to project memberships.
          </p>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2 text-xs text-slate-300">
            <div className="font-semibold text-white">Security Highlights:</div>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li>Bcrypt hashed passwords (12 rounds)</li>
              <li>Signed JWT tokens with configurable expiration</li>
              <li>Server-enforced input validation schemas with Zod</li>
            </ul>
          </div>
        </div>

        <div className="relative z-10 pt-8 border-t border-white/10 flex items-center justify-between text-xs text-white/50">
          <span>&copy; {new Date().getFullYear()} WorkSpace SaaS Inc.</span>
          <span>Zero Frontend Role Overrides</span>
        </div>
      </div>
    </div>
  );
};

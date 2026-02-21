'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login, signup } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'signup') {
      if (!name.trim()) {
        setError('Name is required');
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await signup(email, password, name);
      }
      router.push('/app/workspace');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError(null);
    setConfirmPassword('');
  };

  const inputClass =
    'w-full rounded-lg border border-white/10 bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:border-accent/50 focus:outline-none';

  return (
    <div className="flex h-screen flex-col items-center justify-center">
      <Link href="/" className="mb-8 text-2xl font-semibold tracking-tight text-foreground">
        VARYN
      </Link>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-panel p-8">
        <h1 className="text-xl font-medium">{mode === 'login' ? 'Sign in' : 'Create account'}</h1>

        {error && (
          <p className="rounded-lg border border-red-500/20 bg-red-950/20 px-3 py-2 text-xs text-red-400">
            {error}
          </p>
        )}

        {mode === 'signup' && (
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            autoComplete="name"
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          autoComplete="email"
          required
        />
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputClass} pr-14`}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted/50 hover:text-foreground transition select-none"
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        {mode === 'signup' && (
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputClass}
            autoComplete="new-password"
            required
          />
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-accent py-2.5 text-sm font-medium text-background transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Sign Up'}
        </button>

        <p className="text-center text-xs text-muted">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button type="button" onClick={switchMode} className="text-accent underline">
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </form>
    </div>
  );
}

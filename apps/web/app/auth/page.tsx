'use client';

import { useState } from 'react';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = mode === 'login' ? '/auth/login' : '/auth/signup';
    const body = mode === 'login'
      ? { email, password }
      : { email, password, name };

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('varyn_token', data.token);
      window.location.href = '/workspace';
    }
  };

  return (
    <div className="flex h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-panel p-8">
        <h1 className="text-xl font-medium">{mode === 'login' ? 'Sign in' : 'Create account'}</h1>

        {mode === 'signup' && (
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:border-accent/50 focus:outline-none"
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:border-accent/50 focus:outline-none"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:border-accent/50 focus:outline-none"
        />

        <button
          type="submit"
          className="w-full rounded-full bg-accent py-2.5 text-sm font-medium text-background transition hover:brightness-110"
        >
          {mode === 'login' ? 'Sign In' : 'Sign Up'}
        </button>

        <p className="text-center text-xs text-muted">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="text-accent underline"
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </form>
    </div>
  );
}

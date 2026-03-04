// Login Page - User authentication
// v1.1 - Added i18n support

'use client';

import { useState, FormEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useT } from '@/lib/i18n';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { t } = useT();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.loginFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-primary-700 rounded-2xl mx-auto flex items-center justify-center shadow-lg">
            <span className="text-white text-3xl font-bold">灵</span>
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">{t('login.title')}</h1>
          <p className="mt-1 text-gray-500">{t('login.subtitle')}</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              {t('login.username')}
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-400 focus:border-primary-400 outline-none transition"
              placeholder={t('login.usernamePlaceholder')}
              required
              autoComplete="username"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              {t('login.password')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-400 focus:border-primary-400 outline-none transition"
              placeholder={t('login.passwordPlaceholder')}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary-600 text-white py-3 rounded-xl font-medium hover:bg-primary-700 focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? t('login.submitting') : t('login.submit')}
          </button>
        </form>

        {/* Test credentials hint */}
        <p className="mt-4 text-center text-xs text-gray-400">
          {t('login.testHint')}
        </p>
      </div>
    </div>
  );
}

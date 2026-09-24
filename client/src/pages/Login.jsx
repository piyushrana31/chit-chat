import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { loginUser } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, KeyRound, ArrowRight, Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { theme, toggleTheme } = useTheme();
  if (user) return <Navigate to="/chat" replace />;

  const submit = async (event) => {
    event.preventDefault();
    try {
      setError('');
      login(await loginUser(username, password));
      navigate('/chat');
    } catch (cause) {
      setError(cause.message);
    }
  };

  return (
    <div className="page-in relative flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8">
      <button type="button" onClick={toggleTheme} aria-label="Toggle color theme" className="theme-toggle absolute right-5 top-5 rounded-full border border-slate-700 bg-slate-900/80 p-3 text-slate-300 shadow-lg hover:text-white">{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-blue-950/30 backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950/60 p-8 lg:p-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30">
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Signal-style demo</p>
              <h1 className="text-xl font-semibold text-white">Secure Chat</h1>
            </div>
          </div>

          <div className="mt-12 space-y-8">
            <div>
              <p className="mb-3 text-xs uppercase tracking-[0.2em] text-sky-300">End-to-end encrypted</p>
              <h2 className="max-w-md text-4xl font-semibold leading-tight text-white">
                Private messaging with forward secrecy and session keys.
              </h2>
            </div>

            <div className="grid gap-4 text-sm text-slate-300 sm:grid-cols-2">
              <div className="animate-[page-in_500ms_120ms_both] rounded-2xl border border-slate-700 bg-slate-950/40 p-4">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-300">
                  <KeyRound size={18} />
                </div>
                <p className="font-medium text-white">Session-based</p>
                <p className="mt-1 text-slate-400">Signal-style identity and ratchet state.</p>
              </div>
              <div className="animate-[page-in_500ms_220ms_both] rounded-2xl border border-slate-700 bg-slate-950/40 p-4">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300">
                  <ShieldCheck size={18} />
                </div>
                <p className="font-medium text-white">Forward secrecy</p>
                <p className="mt-1 text-slate-400">Message keys evolve independently per chat.</p>
              </div>
            </div>
          </div>

          <div className="mt-10 text-sm text-slate-400">
            Server sees ciphertext only. Private keys stay local.
          </div>
        </div>

        <div className="flex items-center justify-center bg-slate-950/80 p-8 lg:p-10">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Welcome back</p>
              <h3 className="mt-2 text-3xl font-semibold text-white">Log in</h3>
            </div>

            <form className="space-y-5" onSubmit={submit}>
              <div>
                <label htmlFor="username" className="mb-2 block text-sm text-slate-300">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none ring-0 transition focus:border-sky-500"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm text-slate-300">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none ring-0 transition focus:border-sky-500"
                />
              </div>

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 font-medium text-white transition hover:brightness-110"
              >
                Continue <ArrowRight size={18} />
              </button>
              {error && <p className="text-sm text-rose-300">{error}</p>}
            </form>

            <div className="mt-6 text-center text-sm text-slate-400">
              Need an account?{' '}
              <Link to="/register" className="font-medium text-sky-300 hover:text-sky-200">
                Create one
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

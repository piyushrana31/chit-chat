import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { registerUser } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, LockKeyhole, UserPlus, Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function Register() {
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
      login(await registerUser(username, password));
      navigate('/chat');
    } catch (cause) {
      setError(cause.message);
    }
  };

  return (
    <div className="page-in relative flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8">
      <button type="button" onClick={toggleTheme} aria-label="Toggle color theme" className="theme-toggle absolute right-5 top-5 rounded-full border border-slate-700 bg-slate-900/80 p-3 text-slate-300 shadow-lg hover:text-white">{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-sky-950/30 backdrop-blur-xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">New account</p>
            <h3 className="mt-2 text-3xl font-semibold text-white">Register</h3>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-300 ring-1 ring-sky-400/25">
            <UserPlus size={22} />
          </div>
        </div>

        <form className="space-y-5" onSubmit={submit}>
          <div>
            <label htmlFor="displayName" className="mb-2 block text-sm text-slate-300">
              Display name
            </label>
            <input
              id="displayName"
              type="text"
              defaultValue="alice"
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-sky-500"
            />
          </div>

          <div>
            <label htmlFor="regUsername" className="mb-2 block text-sm text-slate-300">
              Username
            </label>
            <input
              id="regUsername"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-sky-500"
            />
          </div>

          <div>
            <label htmlFor="regPassword" className="mb-2 block text-sm text-slate-300">
              Password
            </label>
            <input
              id="regPassword"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-sky-500"
            />
          </div>

          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-200">
            <div className="flex items-center gap-2 font-medium">
              <LockKeyhole size={16} />
              Device key material is generated locally.
            </div>
          </div>

          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3 font-medium text-white transition hover:brightness-110"
          >
            Create account <ArrowRight size={18} />
          </button>
          {error && <p className="text-sm text-rose-300">{error}</p>}
        </form>

        <div className="mt-6 text-center text-sm text-slate-400">
          Already registered?{' '}
          <Link to="/login" className="font-medium text-sky-300 hover:text-sky-200">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

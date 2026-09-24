import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { fetchMe } from '../services/userService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('secure-chat:auth-token'));
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('secure-chat:auth-user') || 'null'));

  useEffect(() => {
    if (!token) {
      localStorage.removeItem('secure-chat:auth-token');
      localStorage.removeItem('secure-chat:auth-user');
      return;
    }
    localStorage.setItem('secure-chat:auth-token', token);
    fetchMe(token)
      .then(({ user: currentUser }) => {
        const nextUser = { id: String(currentUser._id || currentUser.id), username: currentUser.username };
        setUser(nextUser);
        localStorage.setItem('secure-chat:auth-user', JSON.stringify(nextUser));
      })
      .catch(() => {
        setToken(null);
        setUser(null);
      });
  }, [token]);

  const login = (session) => {
    const nextUser = { id: String(session.user.id), username: session.user.username };
    setToken(session.token);
    setUser(nextUser);
    localStorage.setItem('secure-chat:auth-token', session.token);
    localStorage.setItem('secure-chat:auth-user', JSON.stringify(nextUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('secure-chat:auth-token');
    localStorage.removeItem('secure-chat:auth-user');
  };

  const value = useMemo(() => ({ user, token, login, logout }), [user, token]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

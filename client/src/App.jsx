import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';
import { useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

function ProtectedChat() {
  const { user } = useAuth();
  return user ? <Chat /> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ChatProvider>
          <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/chat" element={<ProtectedChat />} />
          </Routes>
        </ChatProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

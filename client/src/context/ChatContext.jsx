import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createSignalClient } from '../crypto/signalClient';
import { findUser } from '../services/userService';
import { useAuth } from './AuthContext';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { user, token } = useAuth();
  const clientRef = useRef(null);
  const socketRef = useRef(null);
  const storagePrefix = user ? `secure-chat:${user.id}` : 'secure-chat:anonymous';
  const [messages, setMessages] = useState({});
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [hydratedUserId, setHydratedUserId] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('offline');
  const [error, setError] = useState('');
  const websocketUrl = (import.meta.env.VITE_WS_URL || 'ws://localhost:4000').replace(/\/$/, '').endsWith('/ws')
    ? (import.meta.env.VITE_WS_URL || 'ws://localhost:4000').replace(/\/$/, '')
    : `${(import.meta.env.VITE_WS_URL || 'ws://localhost:4000').replace(/\/$/, '')}/ws`;

  useEffect(() => {
    if (!user) {
      setHydratedUserId(null);
      setMessages({});
      setContacts([]);
      setSelectedContact(null);
      return;
    }
    setHydratedUserId(null);
    const savedContacts = JSON.parse(localStorage.getItem(`${storagePrefix}:contacts`) || '[]');
    setMessages(JSON.parse(localStorage.getItem(`${storagePrefix}:messages`) || '{}'));
    setContacts(savedContacts);
    const savedContactId = localStorage.getItem(`${storagePrefix}:selected-contact`);
    setSelectedContact(savedContacts.find((contact) => contact.id === savedContactId) || null);
    setHydratedUserId(user.id);
  }, [user?.id]);

  useEffect(() => {
    if (!user || !token) return undefined;
    let active = true;
    createSignalClient({ userId: user.id, token, apiBaseUrl: `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api`, wsUrl: websocketUrl, namespace: `secure-chat:signal:${user.id}` })
      .then(async (client) => {
        if (!active) return;
        clientRef.current = client;
        await client.publishKeyBundle();
        const connection = client.connectWebSocket({
          onStatus: setConnectionStatus,
          onMessage: (payload) => {
            if (payload.type === 'MESSAGE_RECEIVED') {
              setMessages((current) => ({ ...current, [payload.senderId]: [...(current[payload.senderId] || []), { messageId: payload.messageId, senderId: payload.senderId, receiverId: user.id, plaintext: payload.plaintext, timestamp: payload.timestamp, status: 'DELIVERED' }] }));
            }
            if (payload.type === 'MESSAGE_DELIVERED' || payload.type === 'MESSAGE_READ') {
              setMessages((current) => Object.fromEntries(Object.entries(current).map(([contactId, conversation]) => [contactId, conversation.map((message) => message.messageId === payload.messageId ? { ...message, status: payload.type === 'MESSAGE_READ' ? 'READ' : 'DELIVERED' } : message)])));
            }
            if (payload.type === 'MESSAGE_ERROR' || payload.type === 'MESSAGE_OFFLINE') setError(payload.reason || 'Message could not be delivered');
          },
        });
        socketRef.current = connection;
      })
      .catch((cause) => setError(cause.message || 'Unable to connect securely'));
    return () => {
      active = false;
      socketRef.current?.socket.close();
      clientRef.current = null;
    };
  }, [user, token]);

  useEffect(() => {
    if (!user || hydratedUserId !== user.id) return;
    localStorage.setItem(`${storagePrefix}:messages`, JSON.stringify(messages));
    localStorage.setItem(`${storagePrefix}:contacts`, JSON.stringify(contacts));
    if (selectedContact) localStorage.setItem(`${storagePrefix}:selected-contact`, selectedContact.id);
    else localStorage.removeItem(`${storagePrefix}:selected-contact`);
  }, [messages, contacts, selectedContact, user?.id, hydratedUserId]);

  const addContact = async (username) => {
    const contact = await findUser(username, token);
    if (contact.id === user.id) throw new Error('You cannot add yourself');
    setContacts((current) => current.some((item) => item.id === contact.id) ? current : [...current, contact]);
    setSelectedContact(contact);
  };

  const sendMessage = async (plaintext) => {
    if (!selectedContact || !socketRef.current) throw new Error('Choose a contact and connect first');
    const messageId = `${user.id}-${Date.now()}-${crypto.randomUUID()}`;
    const ciphertext = await socketRef.current.sendEncrypted(selectedContact.id, messageId, plaintext);
    setMessages((current) => ({ ...current, [selectedContact.id]: [...(current[selectedContact.id] || []), { messageId, senderId: user.id, receiverId: selectedContact.id, plaintext, ciphertext, timestamp: new Date().toISOString(), status: 'SENT' }] }));
  };

  const markRead = (messageId) => {
    socketRef.current?.markMessageRead(messageId);
    setMessages((current) => Object.fromEntries(Object.entries(current).map(([contactId, conversation]) => [contactId, conversation.map((message) => message.messageId === messageId ? { ...message, status: 'READ' } : message)])));
  };

  const value = useMemo(() => ({ contacts, messages, selectedContact, setSelectedContact, addContact, sendMessage, markRead, connectionStatus, error, setError }), [contacts, messages, selectedContact, connectionStatus, error]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
}

import { useEffect, useMemo, useState } from 'react';
import { Check, CheckCheck, LogOut, Plus, Send, ShieldCheck, Moon, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import EncryptionBadge from '../components/EncryptionBadge';
import OnlineStatus from '../components/OnlineStatus';
import { useTheme } from '../context/ThemeContext';

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function Status({ status }) {
  if (status === 'READ') return <span className="inline-flex items-center gap-1 text-emerald-300"><CheckCheck size={13} /> Read</span>;
  if (status === 'DELIVERED') return <span className="inline-flex items-center gap-1 text-slate-300"><CheckCheck size={13} /> Delivered</span>;
  return <span className="inline-flex items-center gap-1 text-slate-400"><Check size={13} /> Sent</span>;
}

export default function Chat() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { contacts, messages, selectedContact, setSelectedContact, addContact, sendMessage, markRead, connectionStatus, error, setError } = useChat();
  const [username, setUsername] = useState('');
  const [draft, setDraft] = useState('');
  const conversation = selectedContact ? messages[selectedContact.id] || [] : [];

  useEffect(() => {
    const unread = conversation.filter((message) => message.senderId !== user.id && message.status !== 'READ');
    if (selectedContact && unread.length) unread.forEach((message) => markRead(message.messageId));
  }, [selectedContact]);

  const lastPreview = useMemo(() => (contact) => {
    const last = (messages[contact.id] || []).at(-1);
    return last?.plaintext || 'No local messages yet';
  }, [messages]);

  const submitContact = async (event) => {
    event.preventDefault();
    if (!username.trim()) return;
    try {
      setError('');
      await addContact(username.trim());
      setUsername('');
    } catch (cause) {
      setError(cause.message);
    }
  };

  const submitMessage = async (event) => {
    event.preventDefault();
    if (!draft.trim()) return;
    try {
      setError('');
      await sendMessage(draft.trim());
      setDraft('');
    } catch (cause) {
      setError(cause.message);
    }
  };

  return (
    <div className="page-in min-h-screen bg-slate-950 p-3 text-slate-100 md:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-7xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-slate-950/60 backdrop-blur-xl md:min-h-[calc(100vh-3rem)]">
        <aside className="flex w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-950/45 md:w-80">
          <div className="border-b border-slate-800 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Secure Chat</p>
                <p className="mt-1 font-semibold text-white">{user.username}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" title="Toggle color theme" aria-label="Toggle color theme" onClick={toggleTheme} className="theme-toggle rounded-xl border border-slate-700 p-2 text-slate-400 hover:text-white">{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
                <button type="button" title="Log out" onClick={logout} className="rounded-xl border border-slate-700 p-2 text-slate-400 hover:text-white"><LogOut size={16} /></button>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs"><span className={connectionStatus === 'open' ? 'online-pulse rounded-full' : ''}><OnlineStatus online={connectionStatus === 'open'} /></span><span className="text-slate-500">Signal client</span></div>
          </div>
          <form onSubmit={submitContact} className="flex gap-2 border-b border-slate-800 p-4">
            <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Add username" className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-sky-500" />
            <button type="submit" title="Add contact" className="rounded-xl bg-sky-500 p-2 text-white hover:bg-sky-400"><Plus size={18} /></button>
          </form>
          <div className="flex-1 overflow-y-auto p-3">
            {contacts.map((contact) => {
              const selected = selectedContact?.id === contact.id;
              return <button key={contact.id} type="button" onClick={() => setSelectedContact(contact)} className={`mb-2 w-full rounded-2xl border p-3 text-left ${selected ? 'border-sky-500/50 bg-sky-500/10' : 'border-transparent bg-slate-900/50 hover:border-slate-700'}`}>
                <div className="flex items-center justify-between"><span className="font-medium text-white">{contact.username}</span><OnlineStatus online={contact.online} /></div>
                <p className="mt-1 truncate text-xs text-slate-500">{lastPreview(contact)}</p>
              </button>;
            })}
            {!contacts.length && <p className="p-3 text-sm text-slate-500">Add a username to start a secure conversation.</p>}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-slate-800 px-4 py-4 md:px-6">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Conversation</p>
              <h1 className="mt-1 text-lg font-semibold text-white">{selectedContact?.username || 'Choose a contact'}</h1>
            </div>
            <div className="flex items-center gap-3"><EncryptionBadge /><OnlineStatus online={connectionStatus === 'open'} /></div>
          </header>
          <div className="flex items-center gap-2 border-b border-slate-800 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-200 md:px-6"><ShieldCheck size={15} /> Messages are encrypted on your device before being sent.</div>
          {error && <button type="button" onClick={() => setError('')} className="border-b border-rose-500/20 bg-rose-500/10 px-4 py-2 text-left text-sm text-rose-200">{error}</button>}

          <section className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
              {!selectedContact && <div className="flex h-full items-center justify-center text-center text-slate-500">Select a contact to begin.</div>}
              {selectedContact && !conversation.length && <div className="flex h-full items-center justify-center text-center text-slate-500">No messages yet. Say hello securely.</div>}
              {conversation.map((message) => {
                const mine = message.senderId === user.id;
                return <div key={message.messageId} className={`message-in flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <button type="button" onClick={() => !mine && markRead(message.messageId)} className={`max-w-[82%] text-left ${mine ? 'items-end' : 'items-start'}`}>
                    <div className={`rounded-2xl px-4 py-3 text-sm ${mine ? 'bg-sky-600 text-white' : 'border border-slate-700 bg-slate-900 text-slate-100'}`}>{message.plaintext}</div>
                    <div className={`mt-1 flex items-center gap-2 text-[11px] text-slate-500 ${mine ? 'justify-end' : ''}`}><span>{formatTime(message.timestamp)}</span>{mine && <Status status={message.status} />}</div>
                  </button>
                </div>;
              })}
            </div>
            <form onSubmit={submitMessage} className="flex gap-2 border-t border-slate-800 bg-slate-950/40 p-3 md:p-4">
              <input value={draft} onChange={(event) => setDraft(event.target.value)} disabled={!selectedContact || connectionStatus !== 'open'} placeholder={selectedContact ? 'Write an encrypted message...' : 'Choose a contact first'} className="min-w-0 flex-1 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-sky-500 disabled:opacity-50" />
              <button type="submit" disabled={!selectedContact || !draft.trim() || connectionStatus !== 'open'} title="Send encrypted message" className="rounded-2xl bg-sky-500 px-4 text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"><Send size={18} /></button>
            </form>
          </section>
        </main>
      </div>
    </div>
  );
}

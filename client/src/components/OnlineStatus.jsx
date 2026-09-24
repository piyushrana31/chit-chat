export default function OnlineStatus({ online = false }) {
  return (
    <span className={`inline-flex items-center gap-2 text-xs ${online ? 'text-emerald-400' : 'text-slate-400'}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-slate-500'}`} />
      {online ? 'Online' : 'Offline'}
    </span>
  );
}

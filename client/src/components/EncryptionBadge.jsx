export default function EncryptionBadge({ label = 'End-to-end encrypted' }) {
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-emerald-300">
      {label}
    </span>
  );
}

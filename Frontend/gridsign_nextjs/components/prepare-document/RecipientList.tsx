import React, { useMemo, useState } from "react";
import { PanelHeader } from './PanelHeader';
interface RecipientListProps {
  recipients: { id: string; name: string; email: string; color: string }[];
  activeRecipientId: string;
  onSelect: (id: string) => void;
  onClose?: () => void;
}

export const RecipientList: React.FC<RecipientListProps> = ({ recipients, activeRecipientId, onSelect, onClose }) => {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter(r => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
  }, [query, recipients]);
  return (
    <div className="flex-1 border-b border-border bg-card/95 backdrop-blur-sm p-1 py-3 overflow-y-auto flex flex-col gap-3">
      <PanelHeader title="Recipients" onClose={onClose} />
      <div className="relative group">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full text-xs px-3 py-2 rounded-md bg-muted/50 border border-border/60 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-[11px]"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] px-1 py-0.5 rounded bg-muted hover:bg-muted/80"
            aria-label="Clear search"
          >Clear</button>
        )}
      </div>
  <ul className="flex flex-col py-2">
        {filtered.map(r => {
          const active = activeRecipientId === r.id;
          const initials = r.name.split(/\s+/).slice(0,2).map(p => p[0]?.toUpperCase()).join("");
          return (
            <li key={r.id} className="relative">
              <button
                onClick={() => onSelect(r.id)}
                className={"w-full flex items-center gap-3 p-2 text-left text-xs transition " + (active ? "bg-primary/10" : "hover:bg-muted/40")}
              >
                <span
                  className="flex items-center justify-center w-8 h-8 rounded-full text-[11px] font-semibold ring-2 ring-offset-0"
                  style={{ background: r.color, color: "#fff" }}
                  title={r.name}
                >{initials}</span>
                <span className="flex flex-col leading-tight">
                  <span className="font-medium text-[11px]">{r.name}</span>
                  <span className="text-[10px] text-muted-foreground">{r.email}</span>
                </span>
                {active && <span className="ml-auto text-[10px] font-medium px-2 py-1 rounded bg-primary/15 text-primary">Active</span>}
              </button>
              <div className="absolute bottom-0 left-0 right-0 h-px bg-border/60 pointer-events-none" />
            </li>
          );
        })}
        {!filtered.length && (
          <li className="p-3 text-[11px] text-muted-foreground border border-dashed border-border/60 rounded-md">No recipients match "{query}".</li>
        )}
      </ul>
      <div className="text-[10px] text-muted-foreground mt-1 flex items-center justify-between">
        <span>Total: {filtered.length}</span>
        {query && <span className="italic">Filtered</span>}
      </div>
    </div>
  );
};

"use client";
import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTheme } from 'next-themes';

interface AppPreferences {
  lastPage?: string;
  workflowViewMode?: string;
  templateViewMode?: string;
  workflowStatusFilters?: string[];
  templateStatusFilters?: string[];
  sortWorkflow?: { field: string; dir: string };
  sortTemplate?: { field: string; dir: string };
  searchWorkflow?: string;
  searchTemplate?: string;
  theme?: string;
  updatedAt?: string;
}

const PreferencesPanel: React.FC = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const [prefs, setPrefs] = useState<AppPreferences | null>(null);
  const [autoSaveTheme, setAutoSaveTheme] = useState(true);
  const [live, setLive] = useState(false);

  const loadPrefs = () => {
    try {
      const raw = localStorage.getItem('gridsignPrefs');
      setPrefs(raw ? JSON.parse(raw) : {});
    } catch { setPrefs({}); }
  };
  useEffect(loadPrefs, []);

  // Optional: live updates via storage events (including synthetic ones dispatched in pages)
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'gridsignPrefs') loadPrefs();
    };
    window.addEventListener('storage', handler);
    setLive(true);
    return () => window.removeEventListener('storage', handler);
  }, []);

  useEffect(() => {
    if (!autoSaveTheme) return;
    try {
      const raw = localStorage.getItem('gridsignPrefs');
      const current = raw ? JSON.parse(raw) : {};
      current.theme = resolvedTheme;
      current.updatedAt = new Date().toISOString();
      localStorage.setItem('gridsignPrefs', JSON.stringify(current));
      setPrefs(current);
    } catch {}
  }, [resolvedTheme, autoSaveTheme]);

  const resetPrefs = () => {
    try { localStorage.removeItem('gridsignPrefs'); loadPrefs(); } catch {}
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Preferences & Persistence</h1>
      <p className="text-sm text-muted-foreground">Manage local UI state that GridSign remembers across refreshes (stored only in your browser).</p>
      <Card>
        <CardHeader><CardTitle className="text-sm">Theme</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-muted-foreground">Current:</span>
            <Badge variant="outline" className="capitalize">{resolvedTheme}</Badge>
            <div className="inline-flex rounded-md overflow-hidden border">
              {['light','dark','system'].map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTheme(mode)}
                  className={`px-3 h-7 text-[11px] font-medium transition ${resolvedTheme===mode ? 'bg-muted text-foreground' : 'bg-background hover:bg-muted/50 text-muted-foreground'} ${mode!=='system' ? 'border-r border-border/60' : ''}`}
                  aria-pressed={resolvedTheme===mode}
                >{mode}</button>
              ))}
            </div>
            <label className="flex items-center gap-1 cursor-pointer select-none">
              <input type="checkbox" className="accent-current" checked={autoSaveTheme} onChange={e => setAutoSaveTheme(e.target.checked)} />
              <span className="text-muted-foreground">Auto-save theme</span>
            </label>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Stored Values</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1"><div className="font-medium">Last Page</div><div className="text-muted-foreground">{prefs?.lastPage || '—'}</div></div>
            <div className="space-y-1"><div className="font-medium">Workflow View</div><div className="text-muted-foreground">{prefs?.workflowViewMode || '—'}</div></div>
            <div className="space-y-1"><div className="font-medium">Template View</div><div className="text-muted-foreground">{prefs?.templateViewMode || '—'}</div></div>
            <div className="space-y-1"><div className="font-medium">Workflow Filters</div><div className="text-muted-foreground break-all">{(prefs?.workflowStatusFilters || []).join(', ') || '—'}</div></div>
            <div className="space-y-1"><div className="font-medium">Template Filters</div><div className="text-muted-foreground break-all">{(prefs?.templateStatusFilters || []).join(', ') || '—'}</div></div>
            <div className="space-y-1"><div className="font-medium">Workflow Sort</div><div className="text-muted-foreground">{prefs?.sortWorkflow ? `${prefs.sortWorkflow.field} (${prefs.sortWorkflow.dir})` : '—'}</div></div>
            <div className="space-y-1"><div className="font-medium">Template Sort</div><div className="text-muted-foreground">{prefs?.sortTemplate ? `${prefs.sortTemplate.field} (${prefs.sortTemplate.dir})` : '—'}</div></div>
            <div className="space-y-1"><div className="font-medium">Saved Theme</div><div className="text-muted-foreground">{prefs?.theme || '—'}</div></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={loadPrefs}>Reload</Button>
            <Button size="sm" variant="outline" onClick={resetPrefs}>Reset</Button>
            {live && <Badge variant="outline" className="opacity-70">Live</Badge>}
          </div>
          {prefs?.updatedAt && <p className="text-muted-foreground">Last updated: {new Date(prefs.updatedAt).toLocaleString()}</p>}
        </CardContent>
      </Card>
      <p className="text-[11px] text-muted-foreground">Preferences are not synced to the server yet.</p>
    </div>
  );
};

export default PreferencesPanel;

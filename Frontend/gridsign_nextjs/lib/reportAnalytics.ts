// Simple client-side analytics logger for tooltip usage.
// Stores events in localStorage under 'reportTooltipEvents'.

export interface TooltipEventRecord {
  key: string;
  at: string; // ISO timestamp
}

// Internal helper to find last matching record (avoids Array.prototype.findLast for older TS/JS targets)
function findLastByKey(arr: TooltipEventRecord[], key: string): TooltipEventRecord | undefined {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i].key === key) return arr[i];
  }
  return undefined;
}

export function logTooltipEvent(key: string) {
  try {
    const raw = localStorage.getItem('reportTooltipEvents');
    const arr: TooltipEventRecord[] = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    const recent = findLastByKey(arr, key);
    if (recent) {
      const diff = now - new Date(recent.at).getTime();
      if (diff < 30_000) return; // throttle 30s
    }
    arr.push({ key, at: new Date(now).toISOString() });
    while (arr.length > 200) arr.shift();
    localStorage.setItem('reportTooltipEvents', JSON.stringify(arr));
  } catch {/* ignore */}
}

export function getTooltipEvents(): TooltipEventRecord[] {
  try {
    const raw = localStorage.getItem('reportTooltipEvents');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

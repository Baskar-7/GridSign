// Shared action button styling utilities for prepare-document components
// Tailwind-based; keep variants minimal and semantic.

export const actionButtonBase = "text-xs px-2 py-1 rounded border flex items-center gap-1 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-border/40 disabled:opacity-50 disabled:cursor-not-allowed";
export const iconButtonBase = "w-8 h-8 rounded border flex items-center justify-center transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-border/40 disabled:opacity-50 disabled:cursor-not-allowed";

export const actionVariants = {
  success: "border-emerald-600 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20",
  destructive: "border-destructive text-destructive bg-destructive/10 hover:bg-destructive/20",
  muted: "border-border text-muted-foreground bg-muted/40 hover:bg-muted/60",
  outline: "border-border text-foreground bg-transparent hover:bg-muted/40",
  requiredActive: "bg-amber-500/20 border-amber-600 text-amber-800 dark:text-amber-200 hover:bg-amber-500/30",
  requiredInactive: "bg-muted/40 border-border text-muted-foreground hover:bg-muted/60"
} as const;

export type ActionVariantKey = keyof typeof actionVariants;

export function actionBtn(variant: ActionVariantKey, extra: string = "") {
  return `${actionButtonBase} ${actionVariants[variant]} ${extra}`.trim();
}

export function iconBtn(variant: ActionVariantKey, extra: string = "") {
  return `${iconButtonBase} ${actionVariants[variant]} ${extra}`.trim();
}

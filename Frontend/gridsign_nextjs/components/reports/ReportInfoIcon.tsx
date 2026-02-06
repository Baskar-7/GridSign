"use client";
import * as React from 'react';
import { Info } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface ReportInfoIconProps {
  content: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  id?: string; // for aria-describedby when inline help mode enabled
  onOpenChange?: (open: boolean) => void; // analytics logging hook
  forceInline?: boolean; // show text inline instead of tooltip
}

// Lightweight reusable info tooltip for report sections
export const ReportInfoIcon: React.FC<ReportInfoIconProps> = ({ content, side = 'top', id, onOpenChange, forceInline }) => {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => { onOpenChange?.(open); }, [open, onOpenChange]);
  if (forceInline) {
    return <span id={id} className="text-[11px] text-muted-foreground ml-1 italic">{content}</span>;
  }
  return (
    <Tooltip delayDuration={150} open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Info"
          aria-describedby={id}
          className="inline-flex items-center justify-center rounded-sm p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs text-left leading-relaxed text-[11px]" id={id}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
};

export default ReportInfoIcon;

"use client";
import * as React from 'react';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface HelpExplanationsToggleProps {
  active: boolean;
  onToggle: () => void;
}

// Accessible toggle button with tooltip for activating inline metric explanations
export const HelpExplanationsToggle: React.FC<HelpExplanationsToggleProps> = ({ active, onToggle }) => {
  const label = active ? 'Hide Explanations' : 'Show Explanations';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
            variant={active ? 'secondary' : 'ghost'}
          size="sm"
          onClick={onToggle}
          aria-pressed={active}
          aria-label={label}
          className={`gap-1 pl-2 pr-3 transition-colors ${active ? 'data-[state=on]:bg-secondary' : ''}`}
        >
          <Info className={`h-4 w-4 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className="text-xs font-medium">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-[11px] leading-relaxed">
        Toggle inline metric explanations. When enabled, each section's description appears directly in the layout for quick scanning and printing.
      </TooltipContent>
    </Tooltip>
  );
};

export default HelpExplanationsToggle;

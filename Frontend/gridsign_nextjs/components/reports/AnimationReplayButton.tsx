"use client";
import * as React from 'react';
import { RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface AnimationReplayButtonProps {
  onReplay: () => void;
}

// Button that refreshes chart animations; supports Shift+R shortcut
export const AnimationReplayButton: React.FC<AnimationReplayButtonProps> = ({ onReplay }) => {
  const [pulse, setPulse] = React.useState(false);
  const trigger = () => {
    onReplay();
    setPulse(true);
    setTimeout(() => setPulse(false), 600);
  };
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        trigger();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={trigger}
          aria-label="Replay chart animations"
          className="gap-1 pl-2 pr-3 relative border-none shadow-none"
        >
          <RefreshCcw className={`h-4 w-4 ${pulse ? 'animate-spin' : ''}`} />
          <span className="text-xs font-medium">Refresh Animations</span>
          {pulse && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary animate-ping" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-[11px] leading-relaxed">
        Re-run entrance animations for visible charts. Shortcut: Shift+R.
      </TooltipContent>
    </Tooltip>
  );
};

export default AnimationReplayButton;

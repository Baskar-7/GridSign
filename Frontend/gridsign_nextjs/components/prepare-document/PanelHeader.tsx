import React from 'react';

interface PanelHeaderProps {
  title: string;
  onClose?: () => void;
  className?: string;
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({ title, onClose, className = '' }) => {
  return (
    <div className={`flex items-center justify-between mb-2 ${className}`}> 
      <h3 className="text-xs font-semibold tracking-wider uppercase text-muted-foreground select-none">{title}</h3>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${title} Panel`}
          title="Close"
          className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-muted/70 hover:bg-muted text-[11px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
        >✕</button>
      )}
    </div>
  );
};

export default PanelHeader;

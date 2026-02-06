"use client";
import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface BackButtonProps {
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
  size?: 'sm' | 'md' | 'icon';
}

// Unified back button styling: transparent bg, yellow border, yellow hover background.
// Applies consistent sizing variants while preserving accessibility.
export const BackButton: React.FC<BackButtonProps> = ({ onClick, ariaLabel = 'Go back', className = '', size = 'icon' }) => {
  const router = useRouter();
  const handleClick = () => {
    if (onClick) return onClick();
    if (window.history.length > 1) router.back();
    else router.push('/');
  };
  const baseSizeClasses = size === 'icon' ? 'h-8 w-8 p-0' : size === 'sm' ? 'h-8 px-2' : 'h-9 px-3';
  return (
    <Button
      type="button"
      aria-label={ariaLabel}
      onClick={handleClick}
      className={`back-button ${baseSizeClasses} flex items-center justify-center rounded-md border transition-colors bg-[#ffb800]/15 text-amber-700 border-[#ffb800]/50 hover:bg-[#ffb800] hover:border-[#ffb800] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffb800]/50 dark:text-amber-200 dark:bg-[#ffb800]/20 dark:hover:bg-[#ffb800]/40 ${className}`}
      variant="ghost"
    >
      <ArrowLeft className="h-4 w-4" />
    </Button>
  );
};

export default BackButton;

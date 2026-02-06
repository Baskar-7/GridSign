"use client";
import React from "react";
import Image from "next/image";

interface BrandLogoProps {
  className?: string;
  priority?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ className = "h-10 w-auto", priority = false }) => {
  // Always use yellow logo asset now.
  const src = "/Gridsign_yellow_logo.png";
  return (
    <Image
      src={src}
      alt="GridSign Logo"
      width={220}
      height={64}
      priority={priority}
      className={className + " object-contain select-none transition-opacity"}
    />
  );
};
"use client";
import React from "react";
import { BrandLogo } from "@/components/BrandLogo";

// Wrapper kept for backward compatibility with previous import path.
// Prefer using <BrandLogo /> directly going forward.
const GridSignLogo: React.FC<{ className?: string; priority?: boolean }> = ({ className, priority }) => {
  return <BrandLogo className={className} priority={priority} />;
};

export default GridSignLogo;

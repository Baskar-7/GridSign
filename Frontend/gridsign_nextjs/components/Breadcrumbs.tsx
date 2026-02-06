"use client";

import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { Home, ChevronRight } from "lucide-react";
import { RootState } from "@/lib/store";
import { setActiveComponent } from "@/lib/store/slices/mainContentSlice";

// Labels for top-level components
const labels: Record<string, string> = {
  Homepage: "Home",
  Documentform: "Send for Signatures",
  SendForSignaturePage: "Send for Signatures",
  Profilepage: "Profile",
};

export const Breadcrumbs: React.FC = () => {
  const active = useSelector((s: RootState) => s.mainContent.activeComponent);
  const dispatch = useDispatch();

  // Hide breadcrumbs on homepage
  if (!active || active === "Homepage") return null;

  // Build simple crumbs: Home -> Current page
  const crumbs = [
    { key: "Homepage", label: labels.Homepage },
    { key: active, label: labels[active] || active },
  ];

  const handleClick = (key: string) => {
    if (key !== active) dispatch(setActiveComponent(key));
  };

  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-4 flex items-center gap-2 text-sm flex-wrap"
    >
      {crumbs.map((crumb, idx) => {
        const isLast = idx === crumbs.length - 1;
        return (
          <React.Fragment key={crumb.key}>
            <button
              type="button"
              disabled={isLast}
              onClick={() => !isLast && handleClick(crumb.key)}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 transition-colors ${
                isLast
                  ? "font-medium text-foreground cursor-default"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              aria-current={isLast ? "page" : undefined}
            >
              {crumb.key === "Homepage" && (
                <Home className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{crumb.label}</span>
            </button>
            {!isLast && (
              <ChevronRight
                className="h-4 w-4 text-muted-foreground/60"
                aria-hidden="true"
              />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
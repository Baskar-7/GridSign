"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useDispatch, useSelector } from "react-redux";
import { setActiveComponent } from "@/lib/store/slices/mainContentSlice";
import { RootState } from "@/lib/store";
import { Button } from "./ui/button";
import {
  Home,
  FileText,
  Users,
  Settings,
  Shield,
  LayoutDashboard,
  FolderOpen,
  LogOut,
  LogIn,
  UserPlus,
} from "lucide-react";
import { Separator } from "./ui/separator";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";

type NavItem = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  component: string;
};

const navigationItems: NavItem[] = [
  { icon: Home, label: "Home", component: "Homepage" },
  { icon: LayoutDashboard, label: "Sign", component: "Documentform" },
  { icon: FileText, label: "Sign forms", component: "SignForms" },
  { icon: FileText, label: "Workflows", component: "Workflows" }, // placeholder
  { icon: FolderOpen, label: "Templates", component: "Templates" },
  { icon: Users, label: "Reports", component: "Reports" }, // newly added Reports placeholder
  { icon: Settings, label: "Settings", component: "Profilepage" },
];

const Leftsidebar: React.FC = () => {
  const router = useRouter();
  const dispatch = useDispatch();
  const activeComponent = useSelector((state: RootState) => state.mainContent.activeComponent);
  // Hydration-safe rehydration of active component from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('activeComponent');
      if (stored && stored !== activeComponent) {
        dispatch(setActiveComponent(stored));
      }
    } catch {}
  }, [activeComponent, dispatch]);

  // Theme + mount handling to avoid hydration mismatch
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const [isSignedIn, setIsSignedIn] = useState(false);
  const checkAuth = useCallback(() => {
    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;
      setIsSignedIn(!!token);
    } catch {
      setIsSignedIn(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    checkAuth();
    window.addEventListener("storage", checkAuth);
    window.addEventListener("tokenChange", checkAuth);
    return () => {
      window.removeEventListener("storage", checkAuth);
      window.removeEventListener("tokenChange", checkAuth);
    };
  }, [checkAuth]);

  const handleLogout = () => {
    try {
      localStorage.removeItem("token");
    } catch {}
    setIsSignedIn(false);
    window.dispatchEvent(new Event("tokenChange"));
    router.push("/signin");
  };

  // Safely choose logo AFTER mount; fallback prevents hydration diff
  const logoSrc = logoError
    ? "/Gridsign_white_logo.png"
    : !mounted
    ? "/Gridsign_white_logo.png"
    : resolvedTheme === "dark"
    ? "/Gridsign_white_logo.png"
    : "/Gridsign_yellow_logo.png";

  return (
    <aside
      className="w-64 border-r border-border bg-background flex flex-col h-[calc(100vh-4rem)] sticky top-16"
      aria-label="Main sidebar"
    >
      {/* Navigation starts immediately (logo moved to Navbar) */}
      <nav
        className="flex-1 p-4 space-y-1 overflow-y-auto"
        aria-label="Primary navigation"
      >
        {navigationItems.map((item) => {
          const isActive = activeComponent === item.component;
          // Stable classes independent of hydration; rely on data-active attribute for styling enhancements if needed
          return (
            <button
              key={item.label}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              data-active={isActive ? 'true' : 'false'}
              onClick={() => dispatch(setActiveComponent(item.component))}
              className={
                'group w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors duration-200 ' +
                (isActive
                  ? 'bg-yellow-500 text-white font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/40')
              }
            >
              <item.icon
                className={
                  'h-5 w-5 transition-colors ' +
                  (isActive
                    ? 'text-white'
                    : 'text-muted-foreground group-hover:text-foreground')
                }
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

  <Separator />

      {/* Auth actions */}
      <div className="p-4 space-y-2">
        {isSignedIn ? (
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground hover:bg-accent/40"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        ) : (
          <div className="space-y-2">
            <Link href="/signin" className="block">
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground hover:bg-accent/40"
              >
                <LogIn className="h-4 w-4" />
                Sign In
              </Button>
            </Link>
            <Link href="/signup" className="block">
              <Button className="w-full justify-start gap-2 bg-yellow-500 text-white hover:bg-yellow-600">
                <UserPlus className="h-4 w-4" />
                Sign Up
              </Button>
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Leftsidebar;
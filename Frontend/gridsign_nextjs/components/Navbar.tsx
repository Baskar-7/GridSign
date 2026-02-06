"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { Search, User, LogOut } from "lucide-react";

import { BrandLogo } from "./BrandLogo";
import { ThemeToggle } from "./ThemeToggle";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useApiQuery } from "@/hooks/useApiQuery";
import { postJson, resolveApiUrl } from "@/lib/apiClient";
import { setActiveComponent } from "@/lib/store/slices/mainContentSlice";

interface UserDetails {
  fname: string;
  lname: string;
  email: string;
}

const Navbar: React.FC = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  // Token sync
  useEffect(() => {
    const syncToken = () => {
      try {
        setToken(localStorage.getItem("token"));
      } catch {
        setToken(null);
      }
    };
    syncToken();
    window.addEventListener("storage", syncToken);
    window.addEventListener("tokenChange", syncToken);
    return () => {
      window.removeEventListener("storage", syncToken);
      window.removeEventListener("tokenChange", syncToken);
    };
  }, []);

  const handleLogout = async () => {
    const authToken = token;
    try {
      if (authToken) {
        await postJson("/auth/logout", {}); // placeholder server revoke (stateless JWT now)
      }
    } catch (e) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn("Logout endpoint failed", e);
      }
    } finally {
      try { localStorage.removeItem("token"); } catch {}
      setToken(null);
      window.dispatchEvent(new Event("tokenChange"));
      router.push("/signin");
    }
  };

  const handleProfileClick = () => dispatch(setActiveComponent("Profilepage"));

  const { data: userData, isLoading, error } = useApiQuery<UserDetails>({
    queryKey: ["user-details"],
    url: resolveApiUrl("/user/getUserDetails"), // always local-first & appends /api if missing
    enabled: !!token,
    staleTime: 1000 * 60 * 5,
    config: { headers: { "Content-Type": "application/json" } },
  });

  const user = userData?.data;

  const getAvatar = (fname?: string, lname?: string) => {
    if (!fname || !lname) return "?";
    return `${fname.charAt(0).toUpperCase()}${lname.charAt(0).toUpperCase()}`;
  };

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50 shadow-sm">
      <div className="h-full px-6 flex items-center justify-between w-full gap-4">
        {/* Left: Logo */}
        <div className="flex items-center">
          <button
            onClick={() => dispatch(setActiveComponent("Homepage"))}
            aria-label="Go to homepage"
            className="flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            <BrandLogo className="h-13 w-auto px-8" />
          </button>
        </div>

        {/* Center: Search */}
        <div className="flex-1 flex justify-center">
          <div className="w-full max-w-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search documents, templates, users..."
                aria-label="Global search"
                className="pl-10 w-full bg-secondary/50 border-border focus-visible:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Right: Utilities */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <ThemeToggle />
          {!token ? (
            <Link href="/signin">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
                Sign In
              </Button>
            </Link>
          ) : isLoading ? (
            <div className="flex items-center gap-3">
              <div className="text-right space-y-1">
                <Skeleton className="h-4 w-16 md:w-24" />
                <Skeleton className="h-3 w-20 md:w-32" />
              </div>
              <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" className="rounded-full h-10 w-10" aria-label="User avatar placeholder">
                <span className="text-sm font-semibold">?</span>
              </Button>
            </div>
          ) : user ? (
            <>
              <div className="flex items-center gap-3 pl-2">
                <div className="text-right min-w-[90px] hidden lg:block">
                  <p className="text-xs md:text-sm font-medium text-foreground leading-tight truncate max-w-[140px]">
                    {user.fname} {user.lname}
                  </p>
                  <p className="text-[10px] md:text-xs text-muted-foreground leading-tight truncate max-w-[140px]">
                    {user.email}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full h-10 w-10 bg-primary/10 border-primary/30 hover:bg-primary/20"
                      aria-label="User menu"
                    >
                      <span className="text-sm font-semibold select-none">
                        {getAvatar(user.fname, user.lname)}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium">
                          {user.fname} {user.lname}
                        </p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleProfileClick} className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="cursor-pointer text-red-600 focus:text-red-600"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Logout</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

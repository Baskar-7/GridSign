import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { auth, provider } from "@/firebase";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Auth Service
const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface SignupData {
    fname: string;
    lname: string;
    email: string;
    password: string;
    userRole: string;
}

interface SigninData {
    email: string;
    password: string;
}

interface GoogleAuthData {
    fname: string;
    email: string;
}

export const authService = {
    // Regular signup
    signup: async (data: SignupData) => {
        try {
            const response = await fetch(`${API_URL}/auth/signup`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || "Signup failed");
            }

            return await response.json();
        } catch (error) {
            throw error;
        }
    },

    // Regular signin
    signin: async (data: SigninData) => {
        try {
            const response = await fetch(`${API_URL}/auth/signin`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || "Signin failed");
            }

            return await response.json();
        } catch (error) {
            throw error;
        }
    },

    // Google authentication
    googleSignIn: async () => {
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            // Extract user data
            const googleAuthData: GoogleAuthData = {
                fname: user.displayName || "",
                email: user.email || "",
            };

            // Send to your backend
            const response = await fetch(`${API_URL}/auth/google`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(googleAuthData),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || "Google auth failed");
            }

            return await response.json();
        } catch (error: any) {
            if (error.code === "auth/popup-closed-by-user") {
                throw new Error("Sign-in cancelled");
            }
            throw error;
        }
    },
};

// Password validation
export const validatePassword = (
    password: string
): { isValid: boolean; message: string } => {
    if (password.length < 8) {
        return {
            isValid: false,
            message: "Password must be at least 8 characters long",
        };
    }
    if (!/[A-Z]/.test(password)) {
        return {
            isValid: false,
            message: "Password must contain at least one uppercase letter",
        };
    }
    if (!/[a-z]/.test(password)) {
        return {
            isValid: false,
            message: "Password must contain at least one lowercase letter",
        };
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        return {
            isValid: false,
            message: "Password must contain at least one special character",
        };
    }
    if (/\s/.test(password)) {
        return { isValid: false, message: "Password cannot contain spaces" };
    }
    return { isValid: true, message: "Password is valid" };
};

// Date / time helpers (lightweight, no external deps)
export const formatDateTime = (iso?: string | null, opts: Intl.DateTimeFormatOptions = {}): string => {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleString(undefined, {
            year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', ...opts
        });
    } catch { return '—'; }
};

// Returns short relative time like `3h ago` or `in 2d`
export const fromNow = (iso?: string | null): string => {
    if (!iso) return '';
    const target = new Date(iso).getTime();
    if (isNaN(target)) return '';
    const diffMs = target - Date.now();
    const past = diffMs < 0;
    const absMs = Math.abs(diffMs);
    const mins = Math.floor(absMs / 60000);
    if (mins < 1) return past ? 'just now' : 'soon';
    if (mins < 60) return past ? `${mins}m ago` : `in ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return past ? `${hrs}h ago` : `in ${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return past ? `${days}d ago` : `in ${days}d`;
    const months = Math.floor(days / 30);
    if (months < 12) return past ? `${months}mo ago` : `in ${months}mo`;
    const years = Math.floor(months / 12);
    return past ? `${years}y ago` : `in ${years}y`;
};

// Duration between two ISO stamps (sent -> completed) like `2h 14m` or `3d 4h`
export const durationBetween = (start?: string | null, end?: string | null): string => {
    if (!start || !end) return '';
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (isNaN(s) || isNaN(e) || e < s) return '';
    let ms = e - s;
    const days = Math.floor(ms / 86400000); ms -= days * 86400000;
    const hrs = Math.floor(ms / 3600000); ms -= hrs * 3600000;
    const mins = Math.floor(ms / 60000);
    const parts: string[] = [];
    if (days) parts.push(`${days}d`);
    if (hrs) parts.push(`${hrs}h`);
    if (mins || parts.length === 0) parts.push(`${mins}m`);
    return parts.join(' ');
};

// Consistent dd/MM/yyyy date formatting (zero-padded) for all workflow views.
export const formatDateDDMMYYYY = (iso?: string | null): string => {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '—';
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    } catch { return '—'; }
};


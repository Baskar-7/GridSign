"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; 
import { validatePassword } from "@/lib/utils";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePost } from "@/hooks/useFetch";
import { ApiResponse } from "@/types/api";
import { auth, provider } from "@/firebase";
import { signInWithPopup } from "firebase/auth"; 
import GridSignLogo from "@/components/GridSignLogo";

type AuthMode = "signin" | "signup" | "forgot-password";

interface AuthFormProps {
    mode: AuthMode;
}

const AuthForm: React.FC<AuthFormProps> = ({ mode }) => {
    const router = useRouter();
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [googleLoading, setGoogleLoading] = useState(false);
    const [formData, setFormData] = useState({
        fname: "",
        lname: "",
        email: "",
        password: "",
        confirmPassword: "",
        userRole: "user",
    });

    // Update getEndpoint to use relative paths
    const getEndpoint = () => {
        switch (mode) {
            case "signin":
                return "/auth/signin";
            case "signup":
                return "/auth/signup";
            case "forgot-password":
                return "/auth/request-password-reset";
            default:
                return "";
        }
    };

    // Use the useFetch hook for regular form submission
    const {
        loading,
        error: apiError,
        execute: submitForm,
    } = usePost<ApiResponse>({
        defaultHeaders: {  // Changed from headers to defaultHeaders
            "Content-Type": "application/json",
        },
        onSuccess: (response) => {
            // Show toast based on status
            if (response.status === "success") {
                toast.success(response.message);
                if (mode === "signin") {
                    localStorage.setItem("token", response.data.token);
                    // Dispatch custom event to notify other components
                    window.dispatchEvent(new Event("tokenChange"));
                }
                // Redirect based on mode
                if (mode === "signin" || mode === "signup") {
                    router.push("/");
                } else if (mode === "forgot-password") {
                    // Stay on page or redirect to signin
                    router.push("/signin");
                }
            } else if (response.status === "error") {
                toast.error(response.message);
                setError(response.message);
            } else if (response.status === "warning") {
                toast.warning(response.message);
            } else {
                toast.info(response.message);
            }
        },
        onError: (error) => {
            console.error(`${mode} error:`, error);

            // Check if error response follows the API format
            const errorData = error.response?.data as ApiResponse | undefined;

            if (errorData?.message) {
                toast.error(errorData.message);
                setError(errorData.message);
            } else {
                const errorMessage =
                    error.message || `${mode} failed. Please try again.`;
                toast.error(errorMessage);
                setError(errorMessage);
            }
        },
    });

    // Use the useFetch hook for Google sign-in
    const { loading: googleApiLoading, execute: googleSignInApi } =
        usePost<ApiResponse>({
            onSuccess: (response) => {
                setGoogleLoading(false);
                if (response.status === "success") {
                    toast.success(response.message);
                    localStorage.setItem("token", response.data.token);
                    // Dispatch custom event to notify other components
                    window.dispatchEvent(new Event("tokenChange"));
                    router.push("/");
                } else if (response.status === "error") {
                    toast.error(response.message);
                    setError(response.message);
                } else if (response.status === "warning") {
                    toast.warning(response.message);
                } else {
                    toast.info(response.message);
                }
            },
            onError: (error) => {
                setGoogleLoading(false);
                console.error("Google sign-in error:", error);

                const errorData = error.response?.data as
                    | ApiResponse
                    | undefined;

                if (errorData?.message) {
                    toast.error(errorData.message);
                    setError(errorData.message);
                } else {
                    const errorMessage =
                        error.message ||
                        "Google sign-in failed. Please try again.";
                    toast.error(errorMessage);
                    setError(errorMessage);
                }
            },
        });

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));

        // Validate password for signup
        if (name === "password" && mode === "signup") {
            const validation = validatePassword(value);
            setPasswordError(validation.isValid ? "" : validation.message);
        }

        setError("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setPasswordError("");

        const endpoint = getEndpoint();
        if (!endpoint) {
            setError("Invalid authentication mode");
            return;
        }

        try {
            if (mode === "forgot-password") {
                if (!formData.email) {
                    setError("Email is required");
                    return;
                }
                await submitForm(endpoint, { email: formData.email });
                return;
            }

            if (mode === "signin") {
                console.log("Submitting signin form with data:", formData);
                if (!formData.email || !formData.password) {
                    setError("All fields are required");
                    return;
                }
                await submitForm(endpoint, {
                    email: formData.email,
                    password: formData.password,
                });
                return;
            }

            if (mode === "signup") {
                if (
                    !formData.fname ||
                    !formData.lname ||
                    !formData.email ||
                    !formData.password
                ) {
                    setError("All fields are required");
                    return;
                }

                const passwordValidation = validatePassword(formData.password);
                if (!passwordValidation.isValid) {
                    setPasswordError(passwordValidation.message);
                    return;
                }

                if (formData.password !== formData.confirmPassword) {
                    setError("Passwords do not match");
                    return;
                }

                // Prepare data to send (exclude confirmPassword)
                const { confirmPassword, ...signupData } = formData;
                await submitForm(endpoint, signupData);
            }
        } catch (err) {
            console.error("Form submission error:", err);
        }
    };

    const handleGoogleSignIn = async () => {
        setError("");
        setGoogleLoading(true);

        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            if (!user.email) {
                throw new Error("Email is required for registration");
            }

            // Split display name into first and last name
            const names = user.displayName?.split(" ") || ["", ""];
            const fname = names[0];
            const lname = names.slice(1).join(" ");

            // Use relative path - useFetch will add the base URL
            await googleSignInApi("/auth/google-signin", {
                fname,
                lname,
                email: user.email,
            });
        } catch (err: any) {
            setGoogleLoading(false);

            if (err.code === "auth/popup-closed-by-user") {
                toast.info("Sign-in cancelled");
                return;
            }
            if (err.code === "auth/popup-blocked") {
                const msg = "Pop-up blocked. Please allow pop-ups for this site.";
                toast.error(msg);
                setError(msg);
                return;
            }
            if (err.code === "auth/cancelled-popup-request") {
                return;
            }

            const errorMessage =
                err.message || "Google sign-in failed. Please try again.";
            toast.error(errorMessage);
            setError(errorMessage);
        }
    };

    // Get content based on mode
    const getTitle = () => {
        switch (mode) {
            case "signin":
                return "Welcome Back";
            case "signup":
                return "Create Account";
            case "forgot-password":
                return "Reset Password";
            default:
                return "";
        }
    };

    const getSubtitle = () => {
        switch (mode) {
            case "signin":
                return "Sign in to continue to Grid Sign";
            case "signup":
                return "Join Grid Sign to start signing documents";
            case "forgot-password":
                return "Enter your email to receive a password reset link";
            default:
                return "";
        }
    };

    const getButtonText = () => {
        if (loading) {
            switch (mode) {
                case "signin":
                    return "Signing In...";
                case "signup":
                    return "Creating Account...";
                case "forgot-password":
                    return "Sending Link...";
                default:
                    return "Loading...";
            }
        }
        switch (mode) {
            case "signin":
                return "Sign In";
            case "signup":
                return "Sign Up";
            case "forgot-password":
                return "Send Reset Link";
            default:
                return "Submit";
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center px-4 py-10 sm:py-12">
            {/* Background decorative layers matching homepage style */}
            <div className="absolute inset-0 -z-10 bg-background" />
            <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:16px_28px] opacity-60" />
            <div className="absolute left-1/2 top-10 -translate-x-1/2 -z-10 w-[340px] h-[340px] rounded-full bg-primary/30 blur-[120px] opacity-40" />
            <div className="absolute right-10 bottom-10 -z-10 w-[220px] h-[220px] rounded-full bg-primary/20 blur-[100px] opacity-50" />

            <div className="w-full max-w-md space-y-6">
                {/* Logo */}
                <div className="flex flex-col items-center gap-3">
                    <GridSignLogo className="h-16 drop-shadow-sm" priority />
                    <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/70 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur-sm">
                        <span className="font-medium text-foreground">Secure Digital Signatures</span>
                    </div>
                </div>

                {/* Form Card */}
                <div className="relative rounded-2xl border border-border/70 bg-card shadow-xl shadow-primary/10 p-8 pt-10 overflow-hidden">
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5 opacity-60" />
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl opacity-30" />
                    <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-primary/10 rounded-full blur-3xl opacity-40" />
                    <h1 className="text-2xl font-bold text-black mb-2">
                        {getTitle()}
                    </h1>
                    <p className="text-gray-600 mb-6">{getSubtitle()}</p>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Name Fields - Only for Signup */}
                        {mode === "signup" && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-black mb-2">
                                        First Name *
                                    </label>
                                    <Input
                                        type="text"
                                        name="fname"
                                        value={formData.fname}
                                        onChange={handleChange}
                                        placeholder="John"
                                        className="bg-gray-50 border-gray-300 text-black placeholder:text-gray-400"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-2">
                                        Last Name *
                                    </label>
                                    <Input
                                        type="text"
                                        name="lname"
                                        value={formData.lname}
                                        onChange={handleChange}
                                        placeholder="Doe"
                                        className="bg-gray-50 border-gray-300 text-black placeholder:text-gray-400"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        {/* Email - For All Modes */}
                        <div>
                            <label className="block text-sm font-medium text-black mb-2">
                                Email Address{" "}
                                {mode !== "forgot-password" && "*"}
                            </label>
                            <Input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="john.doe@example.com"
                                className="bg-gray-50 border-gray-300 text-black placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary/60 transition"
                                required
                            />
                        </div>

                        {/* Password - Not for Forgot Password */}
                        {mode !== "forgot-password" && (
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-medium text-black">
                                        Password *
                                    </label>
                                    {mode === "signin" && (
                                        <Link
                                            href="/forgot-password"
                                            className="text-sm text-black hover:underline"
                                        >
                                            Forgot password?
                                        </Link>
                                    )}
                                </div>
                                <div className="relative">
                                    <Input
                                        type={
                                            showPassword ? "text" : "password"
                                        }
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        placeholder="••••••••"
                                        className="bg-gray-50 border-gray-300 text-black placeholder:text-gray-400 pr-10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary/60 transition"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowPassword(!showPassword)
                                        }
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
                                    >
                                        {showPassword ? (
                                            <EyeOff size={20} />
                                        ) : (
                                            <Eye size={20} />
                                        )}
                                    </button>
                                </div>
                                {mode === "signup" && passwordError && (
                                    <p className="mt-1 text-xs text-red-600">
                                        {passwordError}
                                    </p>
                                )}
                                {mode === "signup" && (
                                    <p className="mt-1 text-xs text-gray-500">
                                        8+ chars, uppercase, lowercase, special
                                        character, no spaces
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Confirm Password - Only for Signup */}
                        {mode === "signup" && (
                            <div>
                                <label className="block text-sm font-medium text-black mb-2">
                                    Confirm Password *
                                </label>
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    placeholder="••••••••"
                                    className="bg-gray-50 border-gray-300 text-black placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary/60 transition"
                                    required
                                />
                            </div>
                        )}

                        {/* Remember Me - Only for Signin */}
                        {mode === "signin" && (
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="remember"
                                    className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                                />
                                <label
                                    htmlFor="remember"
                                    className="ml-2 text-sm text-gray-600"
                                >
                                    Remember me
                                </label>
                            </div>
                        )}

                        {/* Submit Button */}
                        <Button
                            type="submit"
                            disabled={
                                loading ||
                                (mode === "signup" && !!passwordError)
                            }
                            className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-black font-semibold py-3 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {getButtonText()}
                                </>
                            ) : (
                                getButtonText()
                            )}
                        </Button>
                    </form>

                    {/* Error region (ARIA live) */}
                    <div aria-live="polite" className="min-h-6">
                        {error && (
                            <div className="mt-4 p-3 bg-red-100/90 border border-red-400 text-red-700 rounded-lg text-sm shadow-sm">
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Divider - Not for Forgot Password */}
                    {mode !== "forgot-password" && (
                        <>
                            <div className="relative my-6">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-border/60"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-2 bg-card text-muted-foreground">
                                        Or continue with
                                    </span>
                                </div>
                            </div>

                            {/* Google Sign In */}
                            <Button
                                type="button"
                                onClick={handleGoogleSignIn}
                                disabled={loading || googleLoading}
                                variant="outline"
                                className="w-full border border-border/70 hover:bg-muted/60 text-black font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-primary"
                            >
                                {googleLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Signing in with Google...
                                    </>
                                ) : (
                                    <>
                                        <svg
                                            className="w-5 h-5"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                fill="currentColor"
                                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                            />
                                            <path
                                                fill="currentColor"
                                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                            />
                                            <path
                                                fill="currentColor"
                                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                            />
                                            <path
                                                fill="currentColor"
                                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                            />
                                        </svg>
                                        Continue with Google
                                    </>
                                )}
                            </Button>
                        </>
                    )}

                    {/* Footer Links */}
                    {mode === "signin" && (
                        <p className="mt-6 text-center text-sm text-muted-foreground">
                            Don&apos;t have an account?{" "}
                            <Link
                                href="/signup"
                                className="font-semibold text-primary hover:underline"
                            >
                                Sign Up
                            </Link>
                        </p>
                    )}

                    {mode === "signup" && (
                        <p className="mt-6 text-center text-sm text-muted-foreground">
                            Already have an account?{" "}
                            <Link
                                href="/signin"
                                className="font-semibold text-primary hover:underline"
                            >
                                Sign In
                            </Link>
                        </p>
                    )}

                    {mode === "forgot-password" && (
                        <p className="mt-6 text-center text-sm text-muted-foreground">
                            Remember your password?{" "}
                            <Link
                                href="/signin"
                                className="font-semibold text-primary hover:underline"
                            >
                                Sign In
                            </Link>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuthForm;

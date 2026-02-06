"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthForm from "@/components/AuthForm";

const SigninPage = () => {
    const router = useRouter();
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const token = localStorage.getItem('token');
            if (token) {
                // Avoid looping back to another auth page; if referrer is an auth page, send home.
                const ref = document.referrer || '';
                const cameFromAuth = /\/signin$|\/signup$|\/forgot-password$/i.test(new URL(ref, window.location.href).pathname);
                if (window.history.length > 1 && !cameFromAuth) {
                    router.back();
                } else {
                    router.push('/');
                }
            }
        } catch {}
    }, [router]);
    return <AuthForm mode="signin" />;
};

export default SigninPage;

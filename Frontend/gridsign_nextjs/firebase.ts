import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Guard Firebase initialization for non-browser (SSR/test) environments to prevent runtime errors
// During Vitest or SSR, we export lightweight stubs so modules depending on auth can import safely.
let auth: ReturnType<typeof getAuth> | { _stub: true };
let provider: GoogleAuthProvider | { _stub: true };

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    provider = new GoogleAuthProvider();
} else {
    auth = { _stub: true };
    provider = { _stub: true } as any;
}

export { auth, provider };

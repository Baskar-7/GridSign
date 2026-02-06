"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { setActiveComponent } from '@/lib/store/slices/mainContentSlice';

// Redirect create route to root; rely on inline creation from Templates tab.
export default function CreateTemplateRedirect() {
  const router = useRouter();
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(setActiveComponent('Templates'));
    router.replace('/');
    // Ideally trigger inline create opening via custom event/localStorage flag
    try { localStorage.setItem('openInlineTemplateCreate','1'); } catch {}
    window.dispatchEvent(new Event('storage'));
  }, [dispatch, router]);
  return null;
}

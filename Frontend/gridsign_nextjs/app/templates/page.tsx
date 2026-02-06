"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { setActiveComponent } from '@/lib/store/slices/mainContentSlice';

// Redirect /templates to root and switch activeComponent to Templates
export default function TemplatesPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(setActiveComponent('Templates'));
    router.replace('/');
  }, [dispatch, router]);
  return null; // transient page
}

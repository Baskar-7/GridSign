"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

// This page expects query parameters token & userId
// Example: /email-verify?token=abc&userId=GUID

const API_BASE = (process.env.NEXT_PUBLIC_LOCAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5035/api').replace(/\/+$/, '');

export default function EmailVerifyPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const token = sp.get('token');
  const userId = sp.get('userId');
  const [status, setStatus] = useState<'idle'|'verifying'|'success'|'error'>('idle');
  const [message,setMessage] = useState<string>('');

  useEffect(() => {
    if (!token || !userId) {
      setStatus('error');
      setMessage('Missing verification details in the URL.');
      return;
    }
    const run = async () => {
      setStatus('verifying');
      try {
        const url = `${API_BASE}/user/verifyEmailChange?userId=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`;
        const res = await fetch(url, { method: 'GET' });
        const data = await res.json();
        if (data.status === 'success') {
          setStatus('success');
          setMessage('Your email has been verified and updated successfully.');
          toast.success('Email verified');
        } else {
          setStatus('error');
          setMessage(data.message || 'Verification failed');
          toast.error(data.message || 'Verification failed');
        }
      } catch (e:any) {
        setStatus('error');
        setMessage(e.message || 'Unexpected error');
        toast.error(e.message || 'Unexpected error');
      }
    };
    run();
  }, [token, userId]);

  const icon = status === 'verifying' ? <Loader2 className="h-10 w-10 animate-spin text-blue-500"/> :
               status === 'success' ? <CheckCircle2 className="h-10 w-10 text-green-600"/> :
               status === 'error' ? <AlertCircle className="h-10 w-10 text-red-600"/> : <Mail className="h-10 w-10 text-muted-foreground"/>;

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6 bg-gradient-to-b from-background to-muted/30">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Email Verification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <div className="flex justify-center">{icon}</div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {status === 'verifying' && 'Verifying your email change request...'}
            {status === 'success' && message}
            {status === 'error' && message}
            {status === 'idle' && 'Initializing verification...'}
          </p>
          {status === 'success' && (
            <Button onClick={() => router.push('/profile')} className="w-full">Go to Profile</Button>
          )}
          {status === 'error' && (
            <div className="space-y-3">
              <Button variant="outline" onClick={() => window.location.reload()} className="w-full">Retry</Button>
              <Button onClick={() => router.push('/profile')} className="w-full">Back to Profile</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

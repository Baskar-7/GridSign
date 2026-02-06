"use client";
import React, { Suspense } from 'react';
import SendForSignaturePage from '@/components/send-for-signature/SendForSignaturePage';

// Thin wrapper to expose /send-for-signature route in App Router.
// Query params (e.g., mode=template) are read internally via useSearchParams in the component.
const SendForSignatureRoutePage: React.FC = () => {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading signature setup...</div>}>
      <SendForSignaturePage />
    </Suspense>
  );
};

export default SendForSignatureRoutePage;

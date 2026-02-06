import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next-themes
vi.mock('next-themes', () => ({ useTheme: () => ({ theme: 'light', setTheme: () => {}, resolvedTheme: 'light' }) }));
// Mock lucide-react icons to simple spans to reduce noise
vi.mock('lucide-react', () => ({
  Edit: (p: any) => <span data-icon="edit" {...p} />,
  MailCheck: (p: any) => <span data-icon="mailcheck" {...p} />,
  RefreshCw: (p: any) => <span data-icon="refresh" {...p} />,
  Check: (p: any) => <span data-icon="check" {...p} />,
  X: (p: any) => <span data-icon="x" {...p} />,
}));

// Mock toast
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Mock useApiQuery to supply user data
vi.mock('@/hooks/useApiQuery', () => ({
  useApiQuery: () => ({
    data: { status: 'success', data: {
      userId: 'u1', fname: 'Jane', lname: 'Doe', email: 'jane@example.com', pendingEmail: null,
      company: 'Acme', jobTitle: 'Engineer', timeZone: { id:'tz', displayName:'Pacific Time', standardName:'PST', daylightName:'PDT', baseUtcOffset:'-08:00', supportsDaylightSavingTime:true }, userRole:'User', isVerifiedMail: false
    } },
    isLoading: false, error: null, refetch: vi.fn(), isFetching: false
  })
}));

// Mock fetch for email change requests
const fetchMock = vi.fn(async (url: string, opts: any) => {
  if (url.includes('/user/requestEmailChange')) {
    return { ok: true, json: async () => ({ status: 'success' }) } as any;
  }
  return { ok: true, json: async () => ({ status: 'success', data: {} }) } as any;
});
// @ts-ignore
global.fetch = fetchMock;

// localStorage mock for token
beforeEach(() => {
  fetchMock.mockClear();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => key==='token' ? 'dummy-token' : null);
});

import Profilepage from '@/components/Profilepage';

/**
 * Tests cover:
 * - Hover verify icon visibility when unverified & no pendingEmail
 * - Transition to email edit state and disclaimer visibility
 * - Submit flow triggers requestEmailChange
 * - Badge state for unverified vs pending vs verified (pending & verified simulated by remocking)
 * - Resend button when pendingEmail exists
 * - Disclaimer not visible until edit mode
 */

describe('Profilepage email flow', () => {
  it('does not show disclaimer before entering edit mode', async () => {
    render(<Profilepage />);
    // Disclaimer should not be present initially
    expect(screen.queryByTestId('email-disclaimer')).not.toBeInTheDocument();
  });

  it('shows unverified badge in base unverified state', async () => {
    render(<Profilepage />);
    const unverified = await screen.findByTestId('badge-unverified');
    expect(unverified).toHaveTextContent('Not Verified');
  });

  it('shows hover verify icon when unverified and no pendingEmail', async () => {
    render(<Profilepage />);
    const emailDisplay = await screen.findByTestId('email-display');
    // Hover over email display
    fireEvent.mouseOver(emailDisplay);
    const icon = await screen.findByTestId('icon-verify-hover');
    expect(icon).toBeInTheDocument();
  });

  it('enters email edit mode and shows disclaimer', async () => {
    render(<Profilepage />);
    const editBtn = await screen.findByTestId('btn-email-edit');
    fireEvent.click(editBtn);
    const disclaimer = await screen.findByTestId('email-disclaimer');
    expect(disclaimer).toHaveTextContent('Changing your email');
  });

  it('submits email change and calls endpoint', async () => {
    render(<Profilepage />);
    fireEvent.click(await screen.findByTestId('btn-email-edit'));
    const input = screen.getByPlaceholderText('Enter new email');
    fireEvent.change(input, { target: { value: 'new@example.com' } });
    const confirm = screen.getByTitle('Confirm');
    fireEvent.click(confirm);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/user/requestEmailChange'), expect.any(Object));
  });

  it('renders pending badge when pendingEmail present', async () => {
    vi.resetModules();
    // Remock useApiQuery with pendingEmail
    vi.doMock('@/hooks/useApiQuery', () => ({
      useApiQuery: () => ({
        data: { status: 'success', data: {
          userId: 'u1', fname: 'Jane', lname: 'Doe', email: 'jane@example.com', pendingEmail: 'new@example.com',
          company: 'Acme', jobTitle: 'Engineer', timeZone: { id:'tz', displayName:'Pacific Time', standardName:'PST', daylightName:'PDT', baseUtcOffset:'-08:00', supportsDaylightSavingTime:true }, userRole:'User', isVerifiedMail: false
        } },
        isLoading: false, error: null, refetch: vi.fn(), isFetching: false
      })
    }));
    const { default: PendingProfile } = await import('@/components/Profilepage');
    render(<PendingProfile />);
    const badge = await screen.findByTestId('badge-pending');
    expect(badge).toHaveTextContent('Pending');
  });

  it('shows resend verification button when pendingEmail present and triggers endpoint', async () => {
    vi.resetModules();
    fetchMock.mockClear();
    vi.doMock('@/hooks/useApiQuery', () => ({
      useApiQuery: () => ({
        data: { status: 'success', data: {
          userId: 'u1', fname: 'Jane', lname: 'Doe', email: 'jane@example.com', pendingEmail: 'new@example.com',
          company: 'Acme', jobTitle: 'Engineer', timeZone: { id:'tz', displayName:'Pacific Time', standardName:'PST', daylightName:'PDT', baseUtcOffset:'-08:00', supportsDaylightSavingTime:true }, userRole:'User', isVerifiedMail: false
        } },
        isLoading: false, error: null, refetch: vi.fn(), isFetching: false
      })
    }));
    const { default: PendingProfileResend } = await import('@/components/Profilepage');
    render(<PendingProfileResend />);
    const resendBtn = await screen.findByTestId('btn-resend-verification');
    expect(resendBtn).toBeInTheDocument();
    fireEvent.click(resendBtn);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/user/requestEmailChange'), expect.any(Object));
  });

  it('renders verified badge when verified and no pendingEmail', async () => {
    vi.resetModules();
    vi.doMock('@/hooks/useApiQuery', () => ({
      useApiQuery: () => ({
        data: { status: 'success', data: {
          userId: 'u1', fname: 'Jane', lname: 'Doe', email: 'jane@example.com', pendingEmail: null,
          company: 'Acme', jobTitle: 'Engineer', timeZone: { id:'tz', displayName:'Pacific Time', standardName:'PST', daylightName:'PDT', baseUtcOffset:'-08:00', supportsDaylightSavingTime:true }, userRole:'User', isVerifiedMail: true
        } },
        isLoading: false, error: null, refetch: vi.fn(), isFetching: false
      })
    }));
    const { default: VerifiedProfile } = await import('@/components/Profilepage');
    render(<VerifiedProfile />);
    const badge = await screen.findByTestId('badge-verified');
    expect(badge).toHaveTextContent('Verified');
  });
});

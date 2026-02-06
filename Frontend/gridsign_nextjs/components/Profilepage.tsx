"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { useApiQuery } from "@/hooks/useApiQuery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Mail,
  Briefcase,
  Building2,
  Clock,
  Shield,
  RefreshCw,
  Edit,
  Check,
  X,
  MailCheck
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";

interface TimeZone {
    id: string;
    hasIanaId: boolean;
    displayName: string;
    standardName: string;
    daylightName: string;
    baseUtcOffset: string;
    supportsDaylightSavingTime: boolean;
}

interface UserDetailsData {
    userId: string;
    fname: string;
    lname: string;
    email: string;
    pendingEmail?: string | null;
    company: string | null;
    jobTitle: string | null;
    timeZone: TimeZone;
    userRole: string;
    isVerifiedMail?: boolean; // legacy mapping
    isMailVerified?: boolean; // preferred mapping from backend (IsMailVerified)
  profilePicFileResourceId?: number | null;
}

const Profilepage = () => {
  const [token, setToken] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

    // Get token from localStorage
  useEffect(() => {
    setMounted(true);
    try { setToken(localStorage.getItem("token")); } catch { setToken(null); }
  }, []);

    // Fetch user details
    // Token is now automatically attached by the hook
  // Prefer local override var NEXT_PUBLIC_LOCAL_API_URL; fallback to NEXT_PUBLIC_API_URL; else default localhost:5035 (from launchSettings)
  const API_BASE = (process.env.NEXT_PUBLIC_LOCAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5035/api').replace(/\/+$/, '');
  const {
    data: userData,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useApiQuery<UserDetailsData>({
    queryKey: ["user-details"],
    url: `${API_BASE}/user/getUserDetails`,
    enabled: !!token,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

    // Show error toast
    useEffect(() => {
        if (error) {
            toast.error("Failed to load profile details");
        }
    }, [error]);

  const user = userData?.data;
  const fullName = user ? `${user.fname} ${user.lname}`.trim() : '';
  // Normalize email verified status (backend may send either isMailVerified or legacy isVerifiedMail)
  const emailVerified = !!(user?.isMailVerified ?? user?.isVerifiedMail);
  const hasPendingEmail = !!(user?.pendingEmail && user.pendingEmail !== user.email);
    // Edit mode state
  const [editing, setEditing] = useState(false); // general profile editing (excluding email)
  const [emailEditing, setEmailEditing] = useState(false); // isolated email edit flow
  const [emailEditValue, setEmailEditValue] = useState('');
    const [formValues, setFormValues] = useState({
      fname: '', lname: '', email: '', company: '', jobTitle: '', timeZoneId: ''
    });
    const originalEmail = user?.email || '';
    useEffect(() => {
      if (user && !editing) {
        setFormValues({
          fname: user.fname || '',
          lname: user.lname || '',
          email: user.email || '',
          company: user.company || '',
          jobTitle: user.jobTitle || '',
          timeZoneId: user.timeZone?.displayName ? user.timeZone.id || user.timeZone.standardName || '' : ''
        });
      }
      if (user && !emailEditing) {
        setEmailEditValue(user.pendingEmail && user.pendingEmail !== user.email ? user.pendingEmail : user.email);
      }
    }, [user, editing, emailEditing]);
    const startEdit = () => { setEditing(true); };
    const cancelEdit = () => {
      setEditing(false);
      if (user) setFormValues({ fname: user.fname||'', lname: user.lname||'', email: user.email||'', company: user.company||'', jobTitle: user.jobTitle||'', timeZoneId: user.timeZone?.id || ''});
    };
    const startEmailEdit = () => { setEmailEditing(true); if (user) setEmailEditValue(user.pendingEmail && user.pendingEmail !== user.email ? user.pendingEmail : user.email); };
    const cancelEmailEdit = () => { setEmailEditing(false); if (user) setEmailEditValue(user.pendingEmail && user.pendingEmail !== user.email ? user.pendingEmail : user.email); };
    const onChangeField = (field: keyof typeof formValues, value: string) => setFormValues(v => ({ ...v, [field]: value }));
    const [saving, setSaving] = useState(false);
    const saveProfile = async () => {
      setSaving(true);
      try {
        const payload = { ...formValues };
        Object.keys(payload).forEach(k => { (payload as any)[k] = (payload as any)[k]?.trim?.(); });
        // Exclude email from direct update to avoid backend overwrite - rely on verification flow for changes
        payload.email = originalEmail; // keep original email stable
        const res = await fetch(`${API_BASE}/user/updateUserDetails`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`Update failed (${res.status})`);
        const data = await res.json();
        if (data.status !== 'success') {
          toast.error(data.message || 'Profile update failed');
        } else {
          toast.success('Profile updated');
          setEditing(false);
          await refetch();
        }
      } catch (e:any) {
        toast.error(e.message || 'Error updating profile');
      } finally { setSaving(false); }
    };

    const submittingEmail = useState(false)[0]; // dummy state declaration placeholder (will replace)
    const [emailSubmitting, setEmailSubmitting] = useState(false);
    const submitEmailChange = async () => {
      if (!emailEditValue || !token) { toast.error('Enter an email'); return; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailEditValue)) { toast.error('Invalid email format'); return; }
      setEmailSubmitting(true);
      try {
        const reqBody = { newEmail: emailEditValue.trim() };
        const resReq = await fetch(`${API_BASE}/user/requestEmailChange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(reqBody)
        });
        const reqJson = await resReq.json();
        if (!resReq.ok || reqJson.status !== 'success') throw new Error(reqJson.message || 'Failed sending verification');
        toast.success('Verification email sent. Email will update after you verify.');
        setEmailEditing(false);
        await refetch();
      } catch (e:any) {
        toast.error(e.message || 'Error requesting verification');
      } finally { setEmailSubmitting(false); }
    };
    const initials = useMemo(() => fullName.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase(), [fullName]);
  const [avatarSrc, setAvatarSrc] = useState<string>('/default_image.JPG');
  const [avatarVersion, setAvatarVersion] = useState(0); // increment to force refresh
    useEffect(() => {
      let revoke: string | null = null;
      const load = async () => {
        if (user?.profilePicFileResourceId) {
          try {
            const res = await fetch(`${API_BASE}/FileResource/${user.profilePicFileResourceId}?v=${avatarVersion}`, {
              headers: { 'Authorization': `Bearer ${token}`, 'Cache-Control': 'no-cache' },
              cache: 'no-store'
            });
            if (!res.ok) throw new Error('Avatar fetch failed');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            revoke = url;
            setAvatarSrc(url);
          } catch {
            setAvatarSrc('/default_image.JPG');
          }
        } else {
          setAvatarSrc('/default_image.JPG');
        }
      };
      load();
      return () => { if (revoke) URL.revokeObjectURL(revoke); };
    }, [user?.profilePicFileResourceId, token, avatarVersion]);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const handleAvatarChange = async (file: File | null) => {
      if (!file) return;
      if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { toast.error('Allowed types: JPEG, PNG, WEBP'); return; }
      if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2MB'); return; }
      setUploadingAvatar(true);
      try {
        const formData = new FormData();
        formData.append('picture', file);
  const res = await fetch(`${API_BASE}/user/updateProfilePicture`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        const data = await res.json();
        if (!res.ok || data.status !== 'success') {
          throw new Error(data.message || `Upload failed (${res.status})`);
        }
  toast.success('Profile picture updated');
  await refetch();
  // Force avatar reload (ID may stay the same)
  setAvatarVersion(v => v + 1);
      } catch (e:any) {
        toast.error(e.message || 'Failed uploading avatar');
      } finally {
        setUploadingAvatar(false);
      }
    };
    // (Legacy local avatar handler removed)

    // Preferences persistence
    interface AppPreferences {
      lastPage?: string;
      workflowViewMode?: string;
      templateViewMode?: string;
      workflowStatusFilters?: string[];
      templateStatusFilters?: string[];
      // Newly added: sign forms & reports preferences
      signFormsViewMode?: string;
      signFormsStatusFilters?: string[];
      reportsViewMode?: string;
      reportsFilters?: string[];
      sortWorkflow?: { field: string; dir: string };
      sortTemplate?: { field: string; dir: string };
      searchWorkflow?: string;
      searchTemplate?: string;
      theme?: string;
      updatedAt?: string;
    }
    const { theme, setTheme, resolvedTheme } = useTheme();
    const [prefs, setPrefs] = useState<AppPreferences | null>(null);
  const [autoSaveTheme, setAutoSaveTheme] = useState<boolean>(true);
    const loadPrefs = () => {
      try {
        const raw = localStorage.getItem('gridsignPrefs');
        if (raw) setPrefs(JSON.parse(raw)); else setPrefs({});
      } catch { setPrefs({}); }
    };
    useEffect(loadPrefs, []);
    const saveCurrentTheme = () => {
      try {
        const raw = localStorage.getItem('gridsignPrefs');
        const current = raw ? JSON.parse(raw) : {};
        current.theme = resolvedTheme;
        current.updatedAt = new Date().toISOString();
        localStorage.setItem('gridsignPrefs', JSON.stringify(current));
        setPrefs(current);
        toast.success('Theme preference saved');
      } catch { toast.error('Failed saving theme'); }
    };
    const applyThemePref = () => {
      if (prefs?.theme) setTheme(prefs.theme);
    };
    // Auto-save on theme change
    useEffect(() => {
      if (!autoSaveTheme) return;
      if (!resolvedTheme) return;
      try {
        const raw = localStorage.getItem('gridsignPrefs');
        const current = raw ? JSON.parse(raw) : {};
        current.theme = resolvedTheme;
        current.updatedAt = new Date().toISOString();
        localStorage.setItem('gridsignPrefs', JSON.stringify(current));
        setPrefs(current);
      } catch {}
    }, [resolvedTheme, autoSaveTheme]);
    const resetPrefs = () => {
      try { localStorage.removeItem('gridsignPrefs'); loadPrefs(); toast.success('Preferences reset'); } catch {}
    };
    // Avatar is now server-managed; local clear removed.

    // Loading skeleton
    // Until mounted, render a static skeleton (avoids hydration mismatch with client-only data)
    if (!mounted) {
      return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <Card><CardHeader><Skeleton className="h-6 w-40" /></CardHeader><CardContent className="space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></CardContent></Card>
        </div>
      );
    }

    if (isLoading) {
        return (
            <div className="max-w-6xl mx-auto p-6 space-y-6">
                {/* Header Skeleton */}
                <div className="flex items-center justify-between">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-10 w-32" />
                </div>

                {/* Profile Card Skeleton */}
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-40" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-20 w-full" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Error state
  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6">
                <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
                    <CardContent className="pt-6">
                        <div className="text-center space-y-4">
                            <div className="text-red-600 dark:text-red-400">
                                <Shield className="h-12 w-12 mx-auto mb-2" />
                                <p className="text-lg font-semibold">
                                    Failed to load profile
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {error.message || "An error occurred"}
                                </p>
                            </div>
                            <Button onClick={() => refetch()} variant="outline">
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Try Again
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // No data state
  if (!user || userData?.status !== "success") {
    return (
      <div className="max-w-6xl mx-auto p-6">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center text-muted-foreground">
                            <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>No profile data available</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Success state - Display profile
    return (
  <div className="max-w-6xl mx-auto space-y-8 p-6" suppressHydrationWarning>
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
            <p className="text-sm text-muted-foreground">Manage profile, time zone and account details</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => refetch()} variant="outline" size="sm" disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />Refresh
            </Button>
            {!editing ? (
              <Button size="sm" variant="outline" onClick={startEdit}>
                <Edit className="mr-2 h-4 w-4" />Edit Profile
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={cancelEdit} disabled={saving}>Cancel</Button>
                <Button size="sm" onClick={saveProfile} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
              </div>
            )}
          </div>
        </div>

        {/* Overview Card */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center gap-5">
            <div className="relative w-24 h-24 rounded-full bg-muted flex items-center justify-center ring-2 ring-border overflow-hidden">
              {avatarSrc ? <Image src={avatarSrc} alt={fullName || 'User avatar'} fill sizes="96px" className="object-cover" /> : <span className="text-2xl font-semibold text-muted-foreground">{initials}</span>}
              <label className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center cursor-pointer text-xs text-white transition" title="Change avatar">
                <span className="px-2 py-1 bg-white/20 rounded">Change</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleAvatarChange(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>
            <div className="flex-1">
              <CardTitle className="text-xl flex items-center gap-2">
                {fullName || 'Unnamed User'}
                <Badge variant={user.userRole === 'Admin' ? 'default' : 'secondary'} className="flex items-center gap-1 text-[11px]">
                  <Shield className="h-3 w-3" />{user.userRole}
                </Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                <Mail className="h-4 w-4" />
                <span className="font-medium">{user.email}</span>
                {hasPendingEmail && (
                  <Badge variant="secondary" className="text-[10px]" title="Pending verification for new email">Pending: {user.pendingEmail}</Badge>
                )}
                {!emailVerified && !hasPendingEmail && (
                  <Badge variant="destructive" className="text-[10px]">Not Verified</Badge>
                )}
                {emailVerified && !hasPendingEmail && (
                  <Badge variant="outline" className="text-[10px]">Verified</Badge>
                )}
              </p>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="flex flex-col">
                  <span className="text-muted-foreground">Company</span>
                  {editing ? (
                    <input
                      value={formValues.company}
                      onChange={e=>onChangeField('company',e.target.value)}
                      className="h-7 px-2 rounded border bg-background text-[11px]"
                      placeholder="Company name"
                    />
                  ) : (
                    <span className="font-medium">{user.company || '—'}</span>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground">Job Title</span>
                  {editing ? (
                    <input
                      value={formValues.jobTitle}
                      onChange={e=>onChangeField('jobTitle',e.target.value)}
                      className="h-7 px-2 rounded border bg-background text-[11px]"
                      placeholder="Job title"
                    />
                  ) : (
                    <span className="font-medium">{user.jobTitle || '—'}</span>
                  )}
                </div>
                <div className="flex flex-col"><span className="text-muted-foreground">Time Zone</span><span className="font-medium">{user.timeZone.displayName}</span></div>
                <div className="flex flex-col"><span className="text-muted-foreground">UTC Offset</span><span className="font-medium">{user.timeZone.baseUtcOffset === '00:00:00' ? 'UTC +00:00' : `UTC ${user.timeZone.baseUtcOffset}`}</span></div>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex flex-wrap gap-2 text-[11px] items-center">
                  <span className="text-muted-foreground">Theme:</span>
                  <div className="inline-flex rounded-md overflow-hidden border">
                    {['light','dark','system'].map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setTheme(mode)}
                        className={`px-3 h-7 text-[11px] font-medium transition ${resolvedTheme===mode ? 'bg-muted text-foreground' : 'bg-background hover:bg-muted/50 text-muted-foreground'} ${mode!=='system' ? 'border-r border-border/60' : ''}`}
                        aria-pressed={resolvedTheme===mode}
                      >{mode}</button>
                    ))}
                  </div>
                  {/* Auto-save toggle removed per request */}
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Personal */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><User className="h-4 w-4" />Personal</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              {editing ? (
                <div className="space-y-3">
                  <div className="flex flex-col"><span className="text-muted-foreground text-xs">First Name</span><input value={formValues.fname} onChange={e=>onChangeField('fname',e.target.value)} className="h-8 px-2 rounded border bg-background" /></div>
                  <div className="flex flex-col"><span className="text-muted-foreground text-xs">Last Name</span><input value={formValues.lname} onChange={e=>onChangeField('lname',e.target.value)} className="h-8 px-2 rounded border bg-background" /></div>
                  <div className="flex flex-col"><span className="text-muted-foreground text-xs">Email (view only while editing)</span><span className="text-[12px] font-mono bg-muted/40 px-2 py-1 rounded border break-all">{user.email}</span></div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col"><span className="text-muted-foreground text-xs">First Name</span><span className="font-medium">{user.fname}</span></div>
                  <div className="flex flex-col"><span className="text-muted-foreground text-xs">Last Name</span><span className="font-medium">{user.lname}</span></div>
                  <div className="flex flex-col gap-1"><span className="text-muted-foreground text-xs flex items-center gap-2">Email { !emailEditing && <button type="button" data-testid="btn-email-edit" onClick={startEmailEdit} className="inline-flex items-center text-xs px-1 py-0.5 rounded hover:bg-muted border"><Edit className="h-3 w-3" /> Edit</button>}</span>
                    {!emailEditing ? (
                      <div className="font-medium break-all flex items-center gap-2 group relative" data-testid="email-display">
                        <span>{user.email}</span>
                        {emailVerified && !hasPendingEmail ? (
                          <Badge variant="outline" className="text-[9px]" data-testid="badge-verified">Verified</Badge>
                        ) : (
                          <Badge
                            variant="destructive"
                            className="text-[9px]"
                            data-testid={hasPendingEmail ? 'badge-pending' : 'badge-unverified'}
                            title={hasPendingEmail ? 'Email change pending verification' : 'Email address not yet verified'}
                          >
                            {hasPendingEmail ? 'Pending' : 'Not Verified'}
                          </Badge>
                        )}
                        {!emailVerified && !hasPendingEmail && (
                          <button
                            type="button"
                            onClick={startEmailEdit}
                            aria-label="Verify Email"
                            data-testid="icon-verify-hover"
                            className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full border bg-background hover:bg-muted"
                          >
                            <MailCheck className="h-4 w-4 text-amber-600" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="email"
                            value={emailEditValue}
                            onChange={e=>setEmailEditValue(e.target.value)}
                            className="h-8 px-2 rounded border bg-background flex-1"
                            placeholder="Enter new email"
                          />
                          <button
                            type="button"
                            onClick={submitEmailChange}
                            disabled={emailSubmitting}
                            className="inline-flex h-8 w-8 items-center justify-center rounded border bg-background hover:bg-muted disabled:opacity-50"
                            title="Confirm"
                          >
                            {emailSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-600" />}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEmailEdit}
                            disabled={emailSubmitting}
                            className="inline-flex h-8 w-8 items-center justify-center rounded border bg-background hover:bg-muted disabled:opacity-50"
                            title="Cancel"
                          >
                            <X className="h-4 w-4 text-red-600" />
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[10px] text-muted-foreground m-0" data-testid="email-disclaimer">Changing your email will send a verification link. Your current email remains active until you verify.</p>
                          {hasPendingEmail && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400">Pending verification for {user.pendingEmail}</span>
                          )}
                          {!hasPendingEmail && !emailVerified && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400">Unverified address – submit to receive link.</span>
                          )}
                        </div>
                      </div>
                    )}
                    {/* Hover icon replaces explicit verify button */}
                    {!emailEditing && hasPendingEmail && (
                      <div className="mt-2 flex items-center gap-2">
                        <Button size="sm" variant="outline" data-testid="btn-resend-verification" onClick={() => { if(user.pendingEmail){ setEmailEditValue(user.pendingEmail); submitEmailChange(); } }} disabled={emailSubmitting}>
                          {emailSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Resend Verification'}
                        </Button>
                        <span className="text-[10px] text-muted-foreground">Link already sent</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          {/* Time Zone */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Clock className="h-4 w-4" />Time Zone</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex flex-col"><span className="text-muted-foreground text-xs">Display Name</span><span className="font-medium">{user.timeZone.displayName}</span></div>
              <div className="flex flex-col"><span className="text-muted-foreground text-xs">Standard Name</span><span className="font-medium">{user.timeZone.standardName}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground text-xs">Daylight Saving</span><Badge variant={user.timeZone.supportsDaylightSavingTime ? 'default' : 'secondary'}>{user.timeZone.supportsDaylightSavingTime ? 'Supported' : 'Not Supported'}</Badge></div>
            </CardContent>
          </Card>
          {/* Account */}
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Shield className="h-4 w-4" />Account</CardTitle></CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex flex-col"><span className="text-muted-foreground text-xs">User ID</span><span className="font-mono text-[11px] bg-muted/40 px-2 py-1 rounded border">{user.userId}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground text-xs">Role</span><Badge variant={user.userRole === 'Admin' ? 'default' : 'secondary'}>{user.userRole}</Badge></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground text-xs">Auth Status</span><Badge variant={token ? 'default' : 'secondary'}>{token ? 'Signed In' : 'Guest'}</Badge></div>
                  {editing && (
                    <div className="flex flex-col"><span className="text-muted-foreground text-xs">Time Zone ID</span><input value={formValues.timeZoneId} onChange={e=>onChangeField('timeZoneId',e.target.value)} className="h-8 px-2 rounded border bg-background" placeholder="e.g. Pacific Standard Time" /></div>
                  )}
                </CardContent>
            </Card>
        </div>
        {/* Preferences Management */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Preferences & Persistence</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-xs">
            <p className="text-muted-foreground">These preferences are stored locally in your browser. They persist across refreshes.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="font-medium">Saved Theme</div>
                <div className="text-muted-foreground">{prefs?.theme || 'Not saved yet'}</div>
              </div>
              <div className="space-y-1">
                <div className="font-medium">Last Page</div>
                <div className="text-muted-foreground">{prefs?.lastPage || '—'}</div>
              </div>
              <div className="space-y-1">
                <div className="font-medium">Workflow View</div>
                <div className="text-muted-foreground">{prefs?.workflowViewMode || '—'}</div>
              </div>
              <div className="space-y-1">
                <div className="font-medium">Template View</div>
                <div className="text-muted-foreground">{prefs?.templateViewMode || '—'}</div>
              </div>
              <div className="space-y-1">
                <div className="font-medium">Workflow Filters</div>
                <div className="text-muted-foreground break-all">{(prefs?.workflowStatusFilters || []).join(', ') || '—'}</div>
              </div>
              <div className="space-y-1">
                <div className="font-medium">Template Filters</div>
                <div className="text-muted-foreground break-all">{(prefs?.templateStatusFilters || []).join(', ') || '—'}</div>
              </div>
              <div className="space-y-1">
                <div className="font-medium">Sign Forms View</div>
                <div className="text-muted-foreground">{prefs?.signFormsViewMode || '—'}</div>
              </div>
              <div className="space-y-1">
                <div className="font-medium">Sign Forms Filters</div>
                <div className="text-muted-foreground break-all">{(prefs?.signFormsStatusFilters || []).join(', ') || '—'}</div>
              </div>
              <div className="space-y-1">
                <div className="font-medium">Reports Filters</div>
                <div className="text-muted-foreground break-all">{(prefs?.reportsFilters || []).join(', ') || '—'}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <Button size="sm" variant="outline" onClick={loadPrefs}>Reload</Button>
              <Button size="sm" variant="outline" onClick={resetPrefs}>Reset</Button>
            </div>
            {prefs?.updatedAt && <p className="text-muted-foreground">Last updated: {new Date(prefs.updatedAt).toLocaleString()}</p>}
          </CardContent>
        </Card>
  <div className="text-[11px] text-muted-foreground">Preferences saved locally. Avatar synced with your account.</div>
      </div>
    );
};

export default Profilepage;

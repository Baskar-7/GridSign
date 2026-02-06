"use client";
import React, { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import { useApiQuery } from '@/hooks/useApiQuery';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { RefreshCw, Edit, Shield, User, Mail, Building2, Briefcase, Clock, Globe2, Activity, Fingerprint } from 'lucide-react';
// Small hook to read and react to global prefs
const useGlobalPrefs = () => {
  const [prefs, setPrefs] = useState<any>({}); // eslint-disable-line @typescript-eslint/no-explicit-any
  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem('gridsignPrefs');
        setPrefs(raw ? JSON.parse(raw) : {});
      } catch { setPrefs({}); }
    };
    if (typeof window !== 'undefined') {
      read();
      const handler = (e: StorageEvent) => { if (e.key === 'gridsignPrefs') read(); };
      window.addEventListener('storage', handler);
      return () => window.removeEventListener('storage', handler);
    }
  }, []);
  return prefs;
};

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
  company: string | null;
  jobTitle: string | null;
  timeZone: TimeZone;
  userRole: string;
  avatarUrl?: string | null;
}

const ProfileDashboard: React.FC = () => {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => { setToken(typeof window !== 'undefined' ? localStorage.getItem('token') : null); }, []);

  const { data, isLoading, error, refetch, isFetching } = useApiQuery<UserDetailsData>({
    queryKey: ['user-details','dashboard'],
    url: `${process.env.NEXT_PUBLIC_API_URL}/user/getUserDetails`,
    enabled: !!token,
    staleTime: 1000 * 60 * 5,
  });
  useEffect(() => { if (error) toast.error('Failed to load profile details'); }, [error]);

  const user = data?.data;
  const globalPrefs = useGlobalPrefs();
  const fullName = user ? `${user.fname} ${user.lname}`.trim() : '';
  const initials = useMemo(() => fullName.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase(), [fullName]);
  const avatarSrc = user?.avatarUrl || '/default_image.jpg';

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 p-6">
        <div className="flex items-start justify-between">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-8 w-24" />
        </div>
        <Card>
          <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/30">
          <CardContent className="pt-6 text-center space-y-4">
            <Shield className="h-12 w-12 mx-auto text-red-600 dark:text-red-400" />
            <p className="text-lg font-semibold">Failed to load profile</p>
            <p className="text-sm text-muted-foreground">{error.message || 'An error occurred'}</p>
            <Button onClick={() => refetch()} variant="outline"><RefreshCw className="mr-2 h-4 w-4" />Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-muted-foreground">No profile data available</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
          <p className="text-muted-foreground text-sm">View and manage your profile, organization and security details</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => refetch()} variant="outline" size="sm" disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm"><Edit className="mr-2 h-4 w-4" />Edit Profile</Button>
        </div>
      </div>

      {/* Overview Card */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="relative w-20 h-20 rounded-full ring-2 ring-primary/30 bg-muted overflow-hidden flex items-center justify-center">
            {avatarSrc ? (
              <Image src={avatarSrc} alt={fullName || 'User avatar'} fill className="object-cover" />
            ) : (
              <span className="text-xl font-semibold text-muted-foreground">{initials}</span>
            )}
          </div>
          <div className="flex-1">
            <CardTitle className="text-xl flex items-center gap-2">
              {fullName || 'Unnamed User'}
              <Badge variant={user.userRole === 'Admin' ? 'default' : 'secondary'} className="flex items-center gap-1">
                <Shield className="h-3 w-3" />{user.userRole}
              </Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground flex items-center gap-2"><Mail className="h-4 w-4" />{user.email}</p>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-0">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground flex items-center gap-1"><Briefcase className="h-3 w-3" />Job Title</label>
            <p className="text-sm font-medium">{user.jobTitle || <span className="text-muted-foreground">Not specified</span>}</p>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3" />Company</label>
            <p className="text-sm font-medium">{user.company || <span className="text-muted-foreground">Not specified</span>}</p>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Time Zone</label>
            <p className="text-sm font-medium">{user.timeZone.displayName}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Personal Information */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-4 w-4" />Personal</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">First Name</p>
              <p className="font-medium">{user.fname}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Last Name</p>
              <p className="font-medium">{user.lname}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Email</p>
              <p className="font-medium break-all flex items-center gap-1"><Mail className="h-3 w-3" />{user.email}</p>
            </div>
          </CardContent>
        </Card>

        {/* Time Zone */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Globe2 className="h-4 w-4" />Time Zone</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Display Name</p>
              <p className="font-medium">{user.timeZone.displayName}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Standard Name</p>
              <p className="font-medium">{user.timeZone.standardName}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-xs">DST Support</p>
              <Badge variant={user.timeZone.supportsDaylightSavingTime ? 'default' : 'secondary'}>
                {user.timeZone.supportsDaylightSavingTime ? 'Supported' : 'Not Supported'}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">UTC Offset</p>
              <p className="font-medium">{user.timeZone.baseUtcOffset === '00:00:00' ? 'UTC +00:00' : `UTC ${user.timeZone.baseUtcOffset}`}</p>
            </div>
          </CardContent>
        </Card>

        {/* Account / Security */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-4 w-4" />Account</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">User ID</p>
              <p className="font-mono text-xs bg-muted/50 px-2 py-1 rounded border">{user.userId}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-xs flex items-center gap-1"><Activity className="h-3 w-3" />Role</p>
              <Badge variant={user.userRole === 'Admin' ? 'default' : 'secondary'}>{user.userRole}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-xs flex items-center gap-1"><Fingerprint className="h-3 w-3" />Auth</p>
              <Badge variant={token ? 'default' : 'secondary'}>{token ? 'Signed In' : 'Guest'}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Future sections placeholder */}
      <Separator />
      {/* Preferences & Persistence */}
      <Card className="border-muted/60">
        <CardHeader>
          <CardTitle className="text-sm">Preferences & Persistence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-3 rounded-md border bg-muted/30 space-y-2">
              <h3 className="font-semibold text-[11px]">Workflows</h3>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">View Mode: <span className="font-medium text-foreground">{globalPrefs.workflowViewMode || 'grid'}</span></span>
                <span className="text-muted-foreground">Status Filters: {Array.isArray(globalPrefs.workflowStatusFilters) && globalPrefs.workflowStatusFilters.length ? globalPrefs.workflowStatusFilters.length : 'All'}</span>
              </div>
            </div>
            <div className="p-3 rounded-md border bg-muted/30 space-y-2">
              <h3 className="font-semibold text-[11px]">Sign Forms</h3>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">View Mode: <span className="font-medium text-foreground">{globalPrefs.signFormsViewMode || 'grid'}</span></span>
                <span className="text-muted-foreground">Status Filters: {Array.isArray(globalPrefs.signFormsStatusFilters) && globalPrefs.signFormsStatusFilters.length ? globalPrefs.signFormsStatusFilters.length : 'All'}</span>
              </div>
            </div>
            <div className="p-3 rounded-md border bg-muted/30 space-y-2">
              <h3 className="font-semibold text-[11px]">Reports</h3>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">Filters: {Array.isArray(globalPrefs.reportsFilters) && globalPrefs.reportsFilters.length ? globalPrefs.reportsFilters.length : 'None'}</span>
              </div>
            </div>
          </div>
          <div className="pt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => {
              try {
                const raw = localStorage.getItem('gridsignPrefs');
                const prefs = raw ? JSON.parse(raw) : {};
                delete prefs.workflowViewMode;
                delete prefs.workflowStatusFilters;
                delete prefs.signFormsViewMode;
                delete prefs.signFormsStatusFilters;
                delete prefs.reportsViewMode;
                delete prefs.reportsFilters;
                prefs.updatedAt = new Date().toISOString();
                localStorage.setItem('gridsignPrefs', JSON.stringify(prefs));
                window.dispatchEvent(new StorageEvent('storage', { key: 'gridsignPrefs', newValue: JSON.stringify(prefs) }));
                toast.success('Cleared stored view/filter preferences');
              } catch (e:any) {
                toast.error('Failed to clear preferences');
              }
            }}>Clear Stored Preferences</Button>
            <Button size="sm" variant="ghost" onClick={() => window.location.reload()}>Refresh</Button>
          </div>
          <p className="text-[10px] text-muted-foreground">Preferences auto-sync whenever you change a view or filter. Clearing removes persisted view & status/filter selections across modules.</p>
        </CardContent>
      </Card>
      <div className="text-xs text-muted-foreground">More settings modules coming soon (notifications, preferences, connected apps).</div>
    </div>
  );
};

export default ProfileDashboard;

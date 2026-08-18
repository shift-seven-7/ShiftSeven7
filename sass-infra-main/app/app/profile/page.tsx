'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, Phone, User } from 'lucide-react';
import { toast } from 'sonner';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FormField } from '@/components/ui/form-field';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useUploadFile } from '@/hooks/queries/useUploadFile';
import { queryKeys } from '@/hooks/queries/keys';
import { getRoleDisplayName } from '@/lib/constants/roles';
import { BUCKETS } from '@/lib/storage/config';
import { identityLabel } from '@/lib/utils';

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const { user, role, isLoading } = usePermissions();
  const upload = useUploadFile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName ?? '');
    setPhone(user.phone ?? '');
  }, [user]);

  /**
   * Self-service edit goes to PATCH /api/users/me, not the admin route — a
   * user editing their own name is not an administrative action.
   */
  async function saveProfile(patch: Record<string, unknown>) {
    const response = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });

    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'עדכון הפרופיל נכשל');

    // The shell reads the name and avatar from /api/users/me.
    await queryClient.invalidateQueries({ queryKey: queryKeys.users.me() });
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);

    try {
      await saveProfile({ full_name: fullName, phone });
      toast.success('הפרופיל עודכן');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'עדכון הפרופיל נכשל');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    try {
      const uploaded = await upload.mutateAsync({
        file,
        bucket: BUCKETS.AVATARS,
        entityType: 'avatar',
        entityId: user.id,
      });

      await saveProfile({ avatar_url: uploaded.url });
      toast.success('התמונה עודכנה');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'העלאת התמונה נכשלה');
    } finally {
      // Allows re-selecting the same file after a failure.
      event.target.value = '';
    }
  }

  const initials =
    user?.fullName
      ?.split(' ')
      .slice(0, 2)
      .map((part) => part[0])
      .join('') || identityLabel(user?.email, user?.phone)[0]?.toUpperCase();

  return (
    <PageLayout title="הפרופיל שלי" isLoading={isLoading}>
      <div className="space-y-4">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 pt-6">
            <div className="relative">
              <Avatar className="h-20 w-20">
                {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={upload.isPending}
                aria-label="החלפת תמונת פרופיל"
                className="absolute -bottom-1 -end-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-colors hover:bg-primary-hover disabled:opacity-60"
              >
                <Camera className="h-4 w-4" />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">
                {user?.fullName || identityLabel(user?.email, user?.phone)}
              </p>
              <p className="truncate text-sm text-muted-foreground" dir="ltr">
                {identityLabel(user?.email, user?.phone)}
              </p>
              <Badge variant="secondary" className="mt-2">
                {getRoleDisplayName(role)}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">פרטים אישיים</CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <FormField label="שם מלא" icon={User}>
                <Input value={fullName} onChange={(event) => setFullName(event.target.value)} />
              </FormField>

              <FormField label="טלפון" icon={Phone}>
                <Input
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  className="text-start"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </FormField>

              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'שומר...' : 'שמירה'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}

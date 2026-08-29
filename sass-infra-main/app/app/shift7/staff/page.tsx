'use client';

import { useEffect, useState } from 'react';
import { KeyRound, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TableSearchInput } from '@/components/ui/table-search-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StaffFormDialog } from '@/components/features/shift7/StaffFormDialog';
import { DeleteStaffDialog } from '@/components/features/shift7/DeleteStaffDialog';
import { CreateStaffLoginDialog } from '@/components/features/shift7/CreateStaffLoginDialog';
import { useShift7Staff, type StaffWithFacilities } from '@/hooks/queries/useShift7Staff';
import { useShift7Facilities } from '@/hooks/queries/useShift7Facilities';
import { useMyShift7Staff } from '@/hooks/queries/useMyShift7Staff';

const ROLE_LABELS: Record<string, string> = { guard: 'מאבטח', dispatcher: 'מוקדן' };
const STATUS_LABELS: Record<string, string> = {
  active: 'פעיל',
  on_leave: 'בחופשה',
  inactive: 'לא פעיל',
};
const ACCESS_LABELS: Record<string, string> = {
  admin: 'מנהל מערכת',
  scheduler: 'משבץ',
  employee: 'עובד',
  no_access: 'ללא גישה',
};

/**
 * Staff roster — the reference implementation for the rest of Shift7's pages.
 * CSS grid rows (not a <table>), matching /app/users — the same markup
 * collapses to stacked cards on mobile. See the `data-table-pages` skill.
 */
export default function Shift7StaffPage() {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StaffWithFacilities | null>(null);
  const [deleting, setDeleting] = useState<StaffWithFacilities | null>(null);
  const [creatingLoginFor, setCreatingLoginFor] = useState<StaffWithFacilities | null>(null);
  const [facilityFilter, setFacilityFilter] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.length >= 3 ? searchInput : '');
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data: allStaff = [], isPending, isFetching } = useShift7Staff(debouncedSearch);
  const { data: facilities = [] } = useShift7Facilities();
  const { data: myStaff } = useMyShift7Staff();
  const canGrantAdmin = myStaff?.access_level === 'admin';

  const staff = facilityFilter
    ? allStaff.filter((member) => member.facility_ids.includes(facilityFilter))
    : allStaff;

  const facilityName = (id: string) => facilities.find((f) => f.id === id)?.name ?? '—';

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (member: StaffWithFacilities) => {
    setEditing(member);
    setDialogOpen(true);
  };

  return (
    <PageLayout
      title="צוות העובדים"
      subtitle="ניהול מאבטחים ומוקדנים"
      actions={
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">הוסף עובד</span>
        </Button>
      }
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <TableSearchInput
            value={searchInput}
            onChange={setSearchInput}
            isLoading={isFetching}
            placeholder="חיפוש לפי שם או מספר עובד..."
          />
        </div>
        <Select
          value={facilityFilter || 'all'}
          onValueChange={(v) => setFacilityFilter(v === 'all' ? '' : v)}
        >
          <SelectTrigger className="sm:w-[180px]">
            <SelectValue placeholder="כל המתקנים" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל המתקנים</SelectItem>
            {facilities.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[1fr_110px_140px_100px_140px_70px] gap-4 border-b border-border/60 px-4 py-3 text-xs font-semibold text-muted-foreground md:grid">
          <span>שם</span>
          <span>מספר עובד</span>
          <span>תפקיד</span>
          <span>סטטוס</span>
          <span>הרשאות גישה</span>
          <span className="sr-only">פעולות</span>
        </div>

        {isPending ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : staff.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Users className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {debouncedSearch ? 'לא נמצאו עובדים התואמים לחיפוש' : 'לא נמצאו עובדים'}
            </p>
            {!debouncedSearch && (
              <Button onClick={openCreate} className="gap-2">
                <Plus className="h-4 w-4" /> הוסף עובד
              </Button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {staff.map((member) => (
              <li
                key={member.id}
                className="grid grid-cols-1 gap-1 px-4 py-3 text-sm md:grid-cols-[1fr_110px_140px_100px_140px_70px] md:items-center md:gap-4"
              >
                <span className="font-medium text-foreground">{member.full_name}</span>

                <span className="font-mono text-xs text-muted-foreground" dir="ltr">
                  {member.employee_id}
                </span>

                <span className="flex flex-wrap items-center gap-1 text-muted-foreground">
                  <span>{ROLE_LABELS[member.role] ?? member.role}</span>
                  {member.facility_ids.slice(0, 2).map((facilityId) => (
                    <Badge key={facilityId} variant="secondary" className="text-[10px]">
                      {facilityName(facilityId)}
                    </Badge>
                  ))}
                  {member.facility_ids.length > 2 && (
                    <Badge variant="secondary" className="text-[10px]">
                      +{member.facility_ids.length - 2}
                    </Badge>
                  )}
                </span>

                <span className="md:contents">
                  <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                    {STATUS_LABELS[member.status] ?? member.status}
                  </Badge>
                </span>

                <span>
                  <Badge variant="outline">{ACCESS_LABELS[member.access_level] ?? member.access_level}</Badge>
                </span>

                <div className="flex items-center gap-1 justify-self-end">
                  {(canGrantAdmin || member.access_level !== 'admin') && (
                    <>
                      {!member.user_id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          aria-label="יצירת חשבון התחברות"
                          onClick={() => setCreatingLoginFor(member)}
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        aria-label="עריכה"
                        onClick={() => openEdit(member)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400"
                        aria-label="מחיקה"
                        onClick={() => setDeleting(member)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <StaffFormDialog
        staff={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        facilities={facilities}
        canGrantAdmin={canGrantAdmin}
      />
      <DeleteStaffDialog staff={deleting} onOpenChange={() => setDeleting(null)} />
      <CreateStaffLoginDialog
        staff={creatingLoginFor}
        onOpenChange={() => setCreatingLoginFor(null)}
      />
    </PageLayout>
  );
}

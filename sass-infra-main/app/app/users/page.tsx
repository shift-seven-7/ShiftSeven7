'use client';

import { useState } from 'react';
import { MoreVertical, Pencil, Trash2, UserPlus } from 'lucide-react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TableSearchInput } from '@/components/ui/table-search-input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InviteUserDialog } from '@/components/features/users/InviteUserDialog';
import { EditUserDialog } from '@/components/features/users/EditUserDialog';
import { DeleteUserDialog } from '@/components/features/users/DeleteUserDialog';
import { useUsers } from '@/hooks/queries/useUsers';
import { identityLabel } from '@/lib/utils';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { getRoleDisplayName } from '@/lib/constants/roles';
import type { UserRow } from '@/types/database.types';

const PAGE_SIZE = 20;

/**
 * User directory.
 *
 * CSS grid rows rather than a <table>: the same markup collapses to stacked
 * cards on mobile without duplicating the list. See the `data-table-pages`
 * skill.
 */
export default function UsersPage() {
  const { isAdmin } = usePermissions();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);

  const { data, isPending } = useUsers({ search, page, pageSize: PAGE_SIZE });

  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PageLayout
      title="משתמשים"
      subtitle={total > 0 ? `${total} משתמשים` : undefined}
      actions={
        isAdmin && (
          <Button onClick={() => setIsInviteOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">הוספת משתמש</span>
          </Button>
        )
      }
    >
      <div className="mb-4">
        <TableSearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(0);
          }}
          placeholder="חיפוש לפי שם או אימייל"
        />
      </div>

      <Card className="overflow-hidden">
        {/* Column headers — desktop only; the mobile layout is self-labelling. */}
        <div className="hidden grid-cols-[1fr_1fr_140px_100px_48px] gap-4 border-b border-border/60 px-4 py-3 text-xs font-semibold text-muted-foreground md:grid">
          <span>שם</span>
          <span>אימייל</span>
          <span>תפקיד</span>
          <span>סטטוס</span>
          <span className="sr-only">פעולות</span>
        </div>

        {isPending ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : users.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {search ? 'לא נמצאו משתמשים התואמים לחיפוש' : 'אין עדיין משתמשים'}
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {users.map((user) => (
              <li
                key={user.id}
                className="grid grid-cols-1 gap-1 px-4 py-3 text-sm md:grid-cols-[1fr_1fr_140px_100px_48px] md:items-center md:gap-4"
              >
                <span className="font-medium text-foreground">
                  {user.full_name || '—'}
                </span>

                <span className="truncate text-muted-foreground" dir="ltr">
                  {identityLabel(user.email, user.phone)}
                </span>

                <span className="md:contents">
                  <Badge variant={user.app_role ? 'secondary' : 'outline'}>
                    {getRoleDisplayName(user.app_role)}
                  </Badge>
                </span>

                <span>
                  <Badge variant={user.is_active ? 'default' : 'outline'}>
                    {user.is_active ? 'פעיל' : 'מושבת'}
                  </Badge>
                </span>

                {isAdmin && (
                  <div className="justify-self-end">
                    <DropdownMenu dir="rtl">
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="פעולות">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="cursor-pointer gap-2"
                          onClick={() => setEditing(user)}
                        >
                          <Pencil className="h-4 w-4" />
                          עריכה
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                          onClick={() => setDeleting(user)}
                        >
                          <Trash2 className="h-4 w-4" />
                          מחיקה
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((value) => value - 1)}
          >
            הקודם
          </Button>
          <span className="text-sm text-muted-foreground">
            {page + 1} מתוך {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount - 1}
            onClick={() => setPage((value) => value + 1)}
          >
            הבא
          </Button>
        </div>
      )}

      <InviteUserDialog open={isInviteOpen} onOpenChange={setIsInviteOpen} />
      <EditUserDialog user={editing} onOpenChange={() => setEditing(null)} />
      <DeleteUserDialog user={deleting} onOpenChange={() => setDeleting(null)} />
    </PageLayout>
  );
}

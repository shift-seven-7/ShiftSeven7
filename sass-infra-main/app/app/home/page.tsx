'use client';

import { LayoutDashboard } from 'lucide-react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Home — intentionally empty.
 *
 * This is the infrastructure's landing page. A project replaces the card below
 * with whatever its dashboard should be; the route, the nav entry and the
 * permission wiring are already in place.
 */
export default function HomePage() {
  return (
    <PageLayout title="עמוד הבית">
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <LayoutDashboard className="h-7 w-7 text-primary" />
          </div>

          <p className="text-sm text-muted-foreground">
            כאן יופיע תוכן עמוד הבית של המערכת.
          </p>
        </CardContent>
      </Card>
    </PageLayout>
  );
}

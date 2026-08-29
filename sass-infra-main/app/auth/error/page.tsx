'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AuthErrorPage() {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-error-background">
          <AlertTriangle className="h-7 w-7 text-error" />
        </div>

        <h1 className="text-lg font-semibold text-foreground">ההתחברות נכשלה</h1>

        <p className="text-sm leading-relaxed text-muted-foreground">
          ייתכן שהקישור פג תוקף או שכבר נעשה בו שימוש. נסה להתחבר שוב.
        </p>

        <Button asChild className="w-full">
          <Link href="/auth/login">חזרה להתחברות</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

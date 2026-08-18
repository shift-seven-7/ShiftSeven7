'use client';

import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function SignUpSuccessPage() {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success-background">
          <MailCheck className="h-7 w-7 text-success" />
        </div>

        <h1 className="text-lg font-semibold text-foreground">בדוק את תיבת הדואר</h1>

        <p className="text-sm leading-relaxed text-muted-foreground">
          שלחנו לך קישור לאימות כתובת האימייל. לאחר האימות, החשבון יועבר לאישור
          מנהל המערכת בארגון.
        </p>

        <Link href="/auth/login" className="inline-block text-sm text-primary hover:underline">
          חזרה להתחברות
        </Link>
      </CardContent>
    </Card>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isPasswordEnabled } from '@/lib/auth/methods';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [isPending, setIsPending] = useState(false);

  // Nothing to reset on a deployment that does not use passwords. The API route
  // refuses too — this only saves the user a pointless round trip.
  if (!isPasswordEnabled()) {
    return (
      <Card>
        <CardContent className="space-y-4 pt-6 text-center">
          <p className="text-sm text-muted-foreground">
            המערכת אינה משתמשת בסיסמאות.
          </p>
          <Link href="/auth/login" className="text-sm text-primary hover:underline">
            חזרה להתחברות
          </Link>
        </CardContent>
      </Card>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsPending(true);

    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, origin: window.location.origin }),
    });

    // Always shows the same confirmation, whether or not the address exists —
    // the endpoint deliberately does not reveal which.
    setSent(true);
    setIsPending(false);
  }

  if (sent) {
    return (
      <Card>
        <CardContent className="space-y-4 pt-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success-background">
            <MailCheck className="h-7 w-7 text-success" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">הקישור נשלח</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            אם קיים חשבון עם הכתובת הזו, ישלח אליה קישור לאיפוס הסיסמה.
          </p>
          <Link
            href="/auth/login"
            className="inline-block text-sm text-primary hover:underline"
          >
            חזרה להתחברות
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">איפוס סיסמה</CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField
            label="אימייל"
            icon={Mail}
            required
            hint="נשלח אליך קישור לבחירת סיסמה חדשה"
          >
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              dir="ltr"
              className="text-start"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </FormField>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'שולח...' : 'שליחת קישור'}
          </Button>

          <p className="text-center text-sm">
            <Link href="/auth/login" className="text-muted-foreground hover:text-foreground">
              חזרה להתחברות
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginMethods } from '@/components/auth/LoginMethods';
import { isSignUpAvailable } from '@/lib/auth/methods';

/**
 * Self-registration, through whichever enabled methods support it.
 *
 * The account is created without a role (`app_role` stays NULL), so the user
 * lands on /app/pending-approval until an admin assigns one.
 */
export default function SignUpPage() {
  if (!isSignUpAvailable()) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">הרשמה</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            הרשמה עצמית אינה זמינה. פנה למנהל המערכת לקבלת הזמנה.
          </p>
          <Link href="/auth/login" className="text-sm text-primary hover:underline">
            חזרה להתחברות
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">הרשמה</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <LoginMethods mode="sign-up" />

        <p className="pt-1 text-center text-sm text-muted-foreground">
          כבר יש לך חשבון?{' '}
          <Link href="/auth/login" className="text-primary hover:underline">
            התחברות
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

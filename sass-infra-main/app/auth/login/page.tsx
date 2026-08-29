'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginMethods } from '@/components/auth/LoginMethods';
import { isPasswordEnabled, isSignUpAvailable } from '@/lib/auth/methods';

/**
 * The screen knows nothing about how people sign in — LoginMethods renders
 * whatever the deployment enabled. The two footer links are conditional for the
 * same reason: "forgot password" is meaningless without a password method, and
 * "sign up" is meaningless when no enabled method allows self-registration.
 */
function LoginScreen() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? undefined;
  const wasDisabled = searchParams.get('disabled') === '1';

  const showForgotPassword = isPasswordEnabled();
  const showSignUp = isSignUpAvailable();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">התחברות</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {wasDisabled && (
          <div className="flex items-start gap-2 rounded-lg bg-error-background p-3 text-sm text-error">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>החשבון שלך הושבת. פנה למנהל המערכת.</span>
          </div>
        )}

        <LoginMethods mode="sign-in" next={next} />

        {(showForgotPassword || showSignUp) && (
          <div className="flex items-center justify-between pt-1 text-sm">
            {showForgotPassword ? (
              <Link
                href="/auth/forgot-password"
                className="text-muted-foreground hover:text-foreground"
              >
                שכחתי סיסמה
              </Link>
            ) : (
              <span />
            )}

            {showSignUp && (
              <Link href="/auth/sign-up" className="text-primary hover:underline">
                הרשמה
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<div className="text-center text-muted-foreground">טוען...</div>}>
      <LoginScreen />
    </Suspense>
  );
}

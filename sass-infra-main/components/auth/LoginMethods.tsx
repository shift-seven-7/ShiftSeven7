'use client';

import { Separator } from '@/components/ui/separator';
import { getEnabledMethods } from '@/lib/auth/methods';
import type { AuthMethodDescriptor } from '@/lib/auth/types';
import { GoogleButton } from '@/components/auth/methods/GoogleButton';
import { OtpForm } from '@/components/auth/methods/OtpForm';
import { PasswordForm } from '@/components/auth/methods/PasswordForm';

/**
 * Renders whatever `NEXT_PUBLIC_AUTH_METHODS` enabled — this is the only place
 * that maps a method to a component.
 *
 * Primary methods (a form) come first, provider buttons after, with the "או"
 * divider between them only when both are present. A deployment running just
 * one method gets a screen with no divider and no dead options, which is the
 * whole point of the registry.
 */
export function LoginMethods({
  mode,
  next,
}: {
  mode: 'sign-in' | 'sign-up';
  next?: string;
}) {
  const methods = getEnabledMethods().filter((method) =>
    mode === 'sign-up' ? method.supportsSignUp : true
  );

  const primary = methods.filter((method) => method.kind !== 'oauth');
  const providers = methods.filter((method) => method.kind === 'oauth');

  if (methods.length === 0) {
    return (
      <p className="text-sm text-error">
        לא הוגדרה שיטת התחברות. בדוק את NEXT_PUBLIC_AUTH_METHODS.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {primary.map((method, index) => (
        <div key={method.id} className="space-y-4">
          {/* Two form-based methods on one screen need labelling; one does not. */}
          {primary.length > 1 && (
            <p className="text-sm font-medium text-muted-foreground">{method.label}</p>
          )}
          <MethodForm method={method} mode={mode} next={next} />
          {index < primary.length - 1 && <Separator />}
        </div>
      ))}

      {primary.length > 0 && providers.length > 0 && (
        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">או</span>
          <Separator className="flex-1" />
        </div>
      )}

      {providers.map((method) => (
        <MethodForm key={method.id} method={method} mode={mode} next={next} />
      ))}
    </div>
  );
}

function MethodForm({
  method,
  mode,
  next,
}: {
  method: AuthMethodDescriptor;
  mode: 'sign-in' | 'sign-up';
  next?: string;
}) {
  switch (method.id) {
    case 'password':
      return <PasswordForm mode={mode} next={next} />;
    case 'google':
      return <GoogleButton next={next} />;
    case 'email_otp':
    case 'phone_otp':
      return <OtpForm method={method} mode={mode} next={next} />;
  }
}

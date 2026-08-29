'use client';

import { useState } from 'react';
import { AlertTriangle, KeyRound, Mail, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { completeAuth, postAuth } from '@/components/auth/auth-client';
import type { AuthMethodDescriptor } from '@/lib/auth/types';

/**
 * Two-step one-time code, for any method whose `kind` is 'otp' — email or SMS.
 *
 * Generic on purpose: implementing a new OTP method should not require a new
 * form. The descriptor supplies the label, the identifier type and the
 * keyboard, and this component supplies the two steps.
 *
 * When the method is a placeholder it renders in a disabled state with the
 * reason. The deployment asked for it, so hiding it silently would look like a
 * bug; the server refuses it too, with the same message.
 */
export function OtpForm({
  method,
  mode,
  next,
}: {
  method: AuthMethodDescriptor;
  mode: 'sign-in' | 'sign-up';
  next?: string;
}) {
  const isPhone = method.identifier === 'phone';

  const [phase, setPhase] = useState<'identifier' | 'code'>('identifier');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  if (!method.implemented) {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-warning-background p-3 text-sm text-warning">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{method.todo ?? 'שיטת ההתחברות אינה מוטמעת'}</span>
      </div>
    );
  }

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    try {
      const result = await postAuth(`/api/auth/${method.id}/start`, {
        mode,
        identifier,
        next,
      });

      if (completeAuth(result, next) === 'navigating') return;
      setPhase('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שליחת הקוד נכשלה');
    } finally {
      setIsPending(false);
    }
  }

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    try {
      const result = await postAuth(`/api/auth/${method.id}/verify`, {
        identifier,
        code,
      });

      if (completeAuth(result, next) === 'navigating') return;
      // A verify that resolves to anything else means the handler is
      // misbehaving — say so rather than leaving a spinner running.
      setError('אימות הקוד לא הושלם. נסה שוב.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'אימות הקוד נכשל');
    } finally {
      setIsPending(false);
    }
  }

  if (phase === 'code') {
    return (
      <form onSubmit={handleVerify} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          שלחנו קוד אל <span dir="ltr">{identifier}</span>
        </p>

        <FormField label="קוד אימות" icon={KeyRound} required>
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            className="text-start tracking-widest"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
          />
        </FormField>

        {error && <p className="text-sm text-error">{error}</p>}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'מאמת...' : 'אימות והתחברות'}
        </Button>

        <Button
          type="button"
          variant="ghost"
          className="w-full"
          disabled={isPending}
          onClick={() => {
            setCode('');
            setError(null);
            setPhase('identifier');
          }}
        >
          שינוי {isPhone ? 'מספר' : 'כתובת'}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSend} className="space-y-4">
      <FormField
        label={isPhone ? 'מספר טלפון' : 'אימייל'}
        icon={isPhone ? Smartphone : Mail}
        required
      >
        <Input
          type={isPhone ? 'tel' : 'email'}
          inputMode={isPhone ? 'tel' : 'email'}
          autoComplete={isPhone ? 'tel' : 'email'}
          dir="ltr"
          className="text-start"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          required
        />
      </FormField>

      {error && <p className="text-sm text-error">{error}</p>}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'שולח...' : 'שליחת קוד'}
      </Button>
    </form>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Mail, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { completeAuth, postAuth } from '@/components/auth/auth-client';

/**
 * Email + password, both modes.
 *
 * Sign-in and sign-up share this component because they share everything that
 * matters — the same endpoint, the same error handling, the same navigation
 * rules. Only three extra fields separate them.
 */
export function PasswordForm({
  mode,
  next,
}: {
  mode: 'sign-in' | 'sign-up';
  next?: string;
}) {
  const router = useRouter();
  const isSignUp = mode === 'sign-up';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const mismatch = isSignUp && confirm.length > 0 && password !== confirm;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (mismatch) return;

    setError(null);
    setIsPending(true);

    try {
      const result = await postAuth('/api/auth/password/start', {
        mode,
        identifier: email,
        password,
        fullName: isSignUp ? fullName : undefined,
        next,
      });

      if (completeAuth(result, next) === 'navigating') return;

      // The only outcome left for this method: email confirmation is on, so
      // the account exists but the session does not.
      router.push('/auth/sign-up-success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'הפעולה נכשלה');
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isSignUp && (
        <FormField label="שם מלא" icon={User}>
          <Input
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </FormField>
      )}

      <FormField label="אימייל" icon={Mail} required>
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

      <FormField
        label="סיסמה"
        icon={KeyRound}
        required
        hint={isSignUp ? 'לפחות 8 תווים' : undefined}
      >
        <Input
          type="password"
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          dir="ltr"
          className="text-start"
          minLength={isSignUp ? 8 : undefined}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </FormField>

      {isSignUp && (
        <FormField
          label="אימות סיסמה"
          icon={KeyRound}
          required
          error={mismatch && 'הסיסמאות אינן תואמות'}
        >
          <Input
            type="password"
            autoComplete="new-password"
            dir="ltr"
            className="text-start"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            required
          />
        </FormField>
      )}

      {error && <p className="text-sm text-error">{error}</p>}

      <Button type="submit" className="w-full" disabled={isPending || mismatch}>
        {isPending
          ? isSignUp
            ? 'נרשם...'
            : 'מתחבר...'
          : isSignUp
            ? 'הרשמה'
            : 'התחברות'}
      </Button>
    </form>
  );
}

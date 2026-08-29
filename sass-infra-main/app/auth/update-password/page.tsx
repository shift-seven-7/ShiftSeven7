'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Reached from the reset email, where the recovery token has already
 * established a session, so no token handling is needed here.
 */
export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const mismatch = confirm.length > 0 && password !== confirm;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (mismatch) return;

    setError(null);
    setIsPending(true);

    try {
      const response = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'עדכון הסיסמה נכשל');

      // Full navigation so the proxy re-evaluates the session and picks the
      // landing page.
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'עדכון הסיסמה נכשל');
      setIsPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">בחירת סיסמה חדשה</CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="סיסמה חדשה" icon={KeyRound} required hint="לפחות 8 תווים">
            <Input
              type="password"
              autoComplete="new-password"
              dir="ltr"
              className="text-start"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </FormField>

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

          {error && <p className="text-sm text-error">{error}</p>}

          <Button type="submit" className="w-full" disabled={isPending || mismatch}>
            {isPending ? 'שומר...' : 'שמירה'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

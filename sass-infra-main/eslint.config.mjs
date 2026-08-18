import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  {
    // Server-only modules must never be pulled into a client bundle.
    //
    // This lint rule is the ONLY mechanism enforcing that — deliberately, not
    // `import 'server-only'`. Several of these modules are legitimately used by
    // the CLI scripts under scripts/, and `server-only` throws when imported
    // outside a React Server Component, which would break every one of them.
    // A lint rule draws the same line and explains itself when it fires.
    files: ['components/**/*.{ts,tsx}', 'hooks/**/*.{ts,tsx}', 'app/**/page.tsx'],
    rules: {
      // The @typescript-eslint variant, not the base rule, because of
      // `allowTypeImports`: `import type { X }` is erased at build time and
      // pulls nothing into the client bundle. Sharing a response type between
      // a route and the hook that calls it is the intended pattern.
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/lib/crypto/*', '**/lib/crypto/*'],
              message:
                'lib/crypto is server-only. Tenant secrets are decrypted in API routes; the client receives masked values via toTenantPublic().',
              allowTypeImports: true,
            },
            {
              group: ['@/lib/supabase/master-client', '**/lib/supabase/master-client'],
              message:
                'The master registry client is server-only. Fetch tenant data through an /api/* route.',
              allowTypeImports: true,
            },
            {
              group: ['@/lib/supabase/service', '**/lib/supabase/service'],
              message:
                'The service-role client is server-only. It bypasses RLS and must never be constructed in the browser.',
              allowTypeImports: true,
            },
            {
              group: ['@/lib/services/*', '**/lib/services/*'],
              message:
                'lib/services talks to the Supabase Management API and Vercel with privileged tokens. Call it from an /api/* route.',
              allowTypeImports: true,
            },
            {
              group: ['@/lib/auth/server/*', '**/lib/auth/server/*'],
              message:
                'Auth method handlers are server-only. The login screen renders from lib/auth/methods.ts (descriptors) and posts to /api/auth/[method]/*.',
              allowTypeImports: true,
            },
            {
              group: ['@/lib/constants/migrations', '**/lib/constants/migrations'],
              message:
                'lib/constants/migrations reads the filesystem. It cannot run in the browser.',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },

  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
];

export default eslintConfig;

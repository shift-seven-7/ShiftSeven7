'use client';

import { useState } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  MutationCache,
  QueryCache,
} from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * TanStack Query setup.
 *
 * One client per browser session, created inside state so React's strict-mode
 * double render does not build two.
 *
 * All fetching goes through /api/* routes — see the `tanstack-query` skill.
 * Query keys come from hooks/queries/keys.ts and nowhere else.
 */

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 1000 * 60 * 60 * 24,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
    queryCache: new QueryCache({
      onError: (error) => {
        console.error('[query]', error);
      },
    }),
    mutationCache: new MutationCache({
      // A failed mutation is user-visible by default. A hook can opt out with
      // meta: { silentError: true } when it renders its own error state.
      onError: (error, _vars, _ctx, mutation) => {
        if (mutation.meta?.silentError) return;
        const message = error instanceof Error ? error.message : 'הפעולה נכשלה';
        toast.error(message);
      },
    }),
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

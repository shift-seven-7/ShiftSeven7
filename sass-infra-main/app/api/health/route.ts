import { NextResponse } from 'next/server';
import { checkMasterConnection, hasMasterConfig } from '@/lib/supabase/master-client';
import { checkSecretsKey } from '@/lib/crypto/secrets';
import { BASE_DOMAIN, BASE_DOMAIN_WARNING, HAS_BASE_DOMAIN } from '@/lib/constants/domain';

/**
 * Liveness / readiness probe.
 *
 * proxy.ts skips this path, so it answers without resolving a tenant — which is
 * the point: it tells you whether the deployment itself and the registry are
 * reachable, independently of any one tenant.
 *
 * The encryption key is checked here because it is the other single point of
 * failure: the proxy opens a sealed anon key on every request, so a missing or
 * malformed TENANT_SECRETS_KEY takes down every tenant at once. Better to see
 * it on a probe right after deploying than in the first user's error.
 *
 * The base domain is reported for the same reason. Unset, it silently falls
 * back to `localhost`, and nothing fails loudly: tenant links point at
 * `*.localhost`, and — worse — provisioning writes `https://acme.localhost`
 * into a tenant project's auth Site URL, so its password-reset emails carry a
 * dead link. That is expensive to notice later and free to notice here.
 *
 * Deliberately leaks nothing: no keys, no tenant names. The base domain is
 * public by construction — it is in every URL.
 */
export async function GET() {
  const configured = hasMasterConfig();
  const registryReachable = configured ? await checkMasterConnection() : false;
  const secretsKey = await checkSecretsKey();

  // Not fatal on its own: a deployment can legitimately be mid-setup, and
  // everything except URL generation still works.
  const baseDomain = {
    configured: HAS_BASE_DOMAIN,
    value: BASE_DOMAIN,
    // Present when the configured value had to be corrected — a full URL where
    // a bare host was expected, most often.
    warning: BASE_DOMAIN_WARNING,
  };

  const healthy = registryReachable && secretsKey.ok;

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      registry: { configured, reachable: registryReachable },
      encryption: { ok: secretsKey.ok, reason: secretsKey.reason },
      baseDomain,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 }
  );
}

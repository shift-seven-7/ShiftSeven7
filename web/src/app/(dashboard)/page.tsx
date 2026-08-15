import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { FacilitiesList } from "@/components/facilities-list";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">GuardSync</h1>
          <p className="text-muted-foreground text-sm">
            {claims?.email} &middot; role: <code>{String(claims?.user_role ?? "unknown")}</code>
          </p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </header>

      <FacilitiesList />
    </div>
  );
}

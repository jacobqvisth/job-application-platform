import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ExtensionConnectClient } from "@/components/extension/extension-connect-client";

export default async function ExtensionPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return (
    <>
      {/* Hidden auth bridge for extension content script */}
      {session && (
        <div
          id="ext-auth-bridge"
          data-access-token={session.access_token}
          data-refresh-token={session.refresh_token}
          data-expires-at={session.expires_at}
          data-user-id={session.user.id}
          style={{ display: "none" }}
          aria-hidden="true"
        />
      )}

      <ExtensionConnectClient isAuthenticated={!!session} />
    </>
  );
}

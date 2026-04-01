import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NavRail } from "@/components/layout/nav-rail";
import { ContextSidebar } from "@/components/layout/context-sidebar";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch pending leads count for badge
  const { count: pendingLeadsCount } = await supabase
    .from("job_listings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("lead_status", "pending");

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <NavRail
        email={user.email ?? ""}
        fullName={user.user_metadata?.full_name ?? null}
        avatarUrl={user.user_metadata?.avatar_url ?? null}
        pendingLeadsCount={pendingLeadsCount ?? 0}
      />
      <main className="flex-1 overflow-y-auto min-w-0 pb-16 md:pb-0">
        <div className="p-4 md:p-6 h-full">{children}</div>
      </main>
      <ContextSidebar />
    </div>
  );
}

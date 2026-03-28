import { createClient } from "@/lib/supabase/server";
import { getApplications } from "@/lib/data/applications";
import { ApplicationsPageClient } from "./applications-client";

export default async function ApplicationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [applications, linkedInResult] = await Promise.all([
    getApplications(supabase),
    user
      ? supabase
          .from("linkedin_connections")
          .select("id")
          .eq("user_id", user.id)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  const linkedInConnected = !!linkedInResult.data;

  return (
    <ApplicationsPageClient
      initialApplications={applications}
      linkedInConnected={linkedInConnected}
    />
  );
}

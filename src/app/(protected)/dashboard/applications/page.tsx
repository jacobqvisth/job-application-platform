import { createClient } from "@/lib/supabase/server";
import { getApplications } from "@/lib/data/applications";
import { ApplicationsPageClient } from "./applications-client";

export default async function ApplicationsPage() {
  const supabase = await createClient();
  const applications = await getApplications(supabase);

  return <ApplicationsPageClient initialApplications={applications} />;
}

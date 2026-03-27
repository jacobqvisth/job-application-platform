import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getApplicationById } from "@/lib/data/applications";
import { getPrepPack } from "@/lib/data/prep";
import { getUserProfile } from "@/lib/data/profile";
import { ApplicationDetailPage } from "@/components/applications/application-detail-page";

export default async function ApplicationDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [application, prepPack, profile] = await Promise.all([
    getApplicationById(id, user.id),
    getPrepPack(id),
    getUserProfile(user.id),
  ]);

  if (!application) redirect("/dashboard/applications");

  return (
    <ApplicationDetailPage
      application={application}
      events={application.application_events ?? []}
      prepPack={prepPack}
      profile={profile}
    />
  );
}

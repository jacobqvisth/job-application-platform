import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/data/profile";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const profile = await getUserProfile(user.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Your professional data used to build and tailor resumes
        </p>
      </div>
      <ProfileForm initialProfile={profile} />
    </div>
  );
}

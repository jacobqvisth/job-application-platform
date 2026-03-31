import { createClient } from "@/lib/supabase/server";
import { getUserSavedSearches } from "@/lib/data/saved-searches";
import { getNewJobListings } from "@/lib/data/job-listings";
import { getPrimaryMarket } from "@/lib/data/markets";
import { JobSearchClient } from "@/components/jobs/job-search-client";

export default async function JobsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [savedSearches, discoveredListings, primaryMarket] = await Promise.all([
    getUserSavedSearches(user.id).catch(() => []),
    getNewJobListings(user.id).catch(() => []),
    getPrimaryMarket(supabase, user.id).catch(() => null),
  ]);

  return (
    <JobSearchClient
      initialSavedSearches={savedSearches}
      initialDiscoveredListings={discoveredListings}
      initialCountry={primaryMarket?.market_code.toLowerCase() ?? "gb"}
    />
  );
}

"use client";

import { useState, useCallback } from "react";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { JobCard, JobCardSkeleton } from "./job-card";
import { SavedSearchesPanel } from "./saved-searches-panel";
import type {
  AdzunaJobResult,
  JobListing,
  SavedSearch,
  CreateSavedSearchData,
} from "@/lib/types/database";

const COUNTRIES = [
  { code: "gb", label: "United Kingdom" },
  { code: "us", label: "United States" },
  { code: "de", label: "Germany" },
  { code: "nl", label: "Netherlands" },
  { code: "ca", label: "Canada" },
  { code: "au", label: "Australia" },
  { code: "at", label: "Austria" },
  { code: "be", label: "Belgium" },
  { code: "br", label: "Brazil" },
  { code: "in", label: "India" },
  { code: "it", label: "Italy" },
  { code: "nz", label: "New Zealand" },
  { code: "pl", label: "Poland" },
  { code: "sg", label: "Singapore" },
  { code: "za", label: "South Africa" },
];

interface JobSearchClientProps {
  initialSavedSearches: SavedSearch[];
  initialDiscoveredListings: JobListing[];
}

export function JobSearchClient({
  initialSavedSearches,
  initialDiscoveredListings,
}: JobSearchClientProps) {
  // Search form state
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [country, setCountry] = useState("gb");
  const [salaryMin, setSalaryMin] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);

  // Results state
  const [results, setResults] = useState<AdzunaJobResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Saved searches state
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(initialSavedSearches);

  // Discovered listings state
  const [discoveredListings, setDiscoveredListings] = useState<JobListing[]>(
    initialDiscoveredListings
  );
  const [discoveredFilter, setDiscoveredFilter] = useState<"all" | "multi-source">("all");

  async function fetchResults(p: number, append: boolean) {
    const params = new URLSearchParams({ q: query, country, page: String(p) });
    if (location) params.set("location", location);
    if (remoteOnly) params.set("remote", "true");
    if (salaryMin) params.set("salary_min", salaryMin);

    const res = await fetch(`/api/jobs/search?${params.toString()}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error ?? "Search failed");
    }

    const newResults: AdzunaJobResult[] = data.results ?? [];
    setTotal(data.total ?? 0);
    setPage(p);

    if (append) {
      setResults((prev) => [...(prev ?? []), ...newResults]);
    } else {
      setResults(newResults);
    }
  }

  async function handleSearch() {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      await fetchResults(1, false);
    } catch (err) {
      toast.error((err as Error).message || "Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  }

  async function handleLoadMore() {
    setIsLoadingMore(true);
    try {
      await fetchResults(page + 1, true);
    } catch (err) {
      toast.error((err as Error).message || "Failed to load more results.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  function handleClear() {
    setQuery("");
    setLocation("");
    setCountry("gb");
    setSalaryMin("");
    setRemoteOnly(false);
    setResults(null);
    setTotal(0);
    setPage(1);
  }

  function handleRunSavedSearch(search: SavedSearch) {
    setQuery(search.query);
    setLocation(search.location ?? "");
    setCountry(search.country);
    setSalaryMin(search.salary_min ? String(search.salary_min) : "");
    setRemoteOnly(search.remote_only);
    // Trigger search after state updates
    setTimeout(() => {
      document.getElementById("job-search-submit")?.click();
    }, 50);
  }

  const handleSaveJob = useCallback(
    async (job: AdzunaJobResult | JobListing) => {
      const res = await fetch("/api/jobs/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: job.title,
          company: job.company,
          url: job.url,
          location: job.location,
          description: job.description,
          salary_min: job.salary_min,
          salary_max: job.salary_max,
          remote_type: job.remote_type,
          external_id: job.external_id,
          source: "source" in job ? job.source : "adzuna",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      return { alreadySaved: data.alreadySaved ?? false };
    },
    []
  );

  async function handleCreateSavedSearch(formData: CreateSavedSearchData) {
    const res = await fetch("/api/jobs/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to create search");
    setSavedSearches((prev) => [data.search, ...prev]);
  }

  function handleDeleteSavedSearch(id: string) {
    setSavedSearches((prev) => prev.filter((s) => s.id !== id));
  }

  const hasMore = results !== null && results.length < total;

  const currentFilters = { query, location, country, remoteOnly, salaryMin };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Find Jobs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search for jobs and browse results ranked by your profile match.
        </p>
      </div>

      <Tabs defaultValue="search">
        <TabsList>
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="discovered">
            Discovered
            {discoveredListings.length > 0 && (
              <span className="ml-1.5 rounded-full bg-primary text-primary-foreground text-xs px-1.5 py-0.5 font-semibold">
                {discoveredListings.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* SEARCH TAB */}
        <TabsContent value="search" className="mt-4 space-y-4">
          {/* Search form */}
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
            {/* Main query row */}
            <div className="flex gap-2">
              <Input
                placeholder="Job title, keywords, skills..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1"
              />
              <Button
                id="job-search-submit"
                onClick={handleSearch}
                disabled={!query.trim() || isSearching}
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span className="ml-2 hidden sm:inline">Search</span>
              </Button>
            </div>

            {/* Filters row */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1.5 col-span-1">
                <Label className="text-xs">Location</Label>
                <Input
                  placeholder="e.g. London"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 col-span-1">
                <Label className="text-xs">Country</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-1">
                <Label className="text-xs">Min salary (annual)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 50000"
                  value={salaryMin}
                  onChange={(e) => setSalaryMin(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 col-span-1">
                <Label className="text-xs">Options</Label>
                <div className="flex items-center h-9 gap-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={remoteOnly}
                      onChange={(e) => setRemoteOnly(e.target.checked)}
                      className="rounded"
                    />
                    Remote only
                  </label>
                </div>
              </div>
            </div>

            {/* Actions row */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!query.trim()) {
                    toast.error("Enter a search query first");
                    return;
                  }
                  document.querySelector<HTMLButtonElement>('[data-open-save-search]')?.click();
                }}
              >
                ☆ Save this search
              </Button>
              <Button variant="ghost" size="sm" onClick={handleClear}>
                Clear
              </Button>
            </div>
          </div>

          {/* Saved searches panel */}
          <SavedSearchesPanel
            savedSearches={savedSearches}
            currentFilters={currentFilters}
            onRun={handleRunSavedSearch}
            onDelete={handleDeleteSavedSearch}
            onCreate={handleCreateSavedSearch}
          />

          {/* Results */}
          {isSearching && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">Searching...</div>
              {Array.from({ length: 5 }).map((_, i) => (
                <JobCardSkeleton key={i} />
              ))}
            </div>
          )}

          {!isSearching && results !== null && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {total.toLocaleString()} result{total !== 1 ? "s" : ""}, sorted by match
              </p>
              {results.length === 0 ? (
                <div className="rounded-xl border bg-card p-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    No results found. Try different keywords or broaden your filters.
                  </p>
                </div>
              ) : (
                results.map((job) => (
                  <JobCard
                    key={job.external_id}
                    job={job}
                    onSave={handleSaveJob}
                    alreadyApplied={job.alreadyApplied}
                  />
                ))
              )}
              {hasMore && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading more...
                    </>
                  ) : (
                    "Load more"
                  )}
                </Button>
              )}
            </div>
          )}

          {!isSearching && results === null && (
            <div className="rounded-xl border bg-card p-10 text-center space-y-2">
              <Search className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Enter keywords above to search for jobs.
              </p>
            </div>
          )}
        </TabsContent>

        {/* DISCOVERED TAB */}
        <TabsContent value="discovered" className="mt-4 space-y-4">
          {discoveredListings.length === 0 ? (
            <div className="rounded-xl border bg-card p-10 text-center space-y-3">
              <Search className="mx-auto h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">No discovered jobs yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Save a search with daily alerts enabled. New matching jobs will appear here
                  each morning.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Filter row */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setDiscoveredFilter("all")}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    discoveredFilter === "all"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  All ({discoveredListings.length})
                </button>
                {discoveredListings.some((l) => (l.all_sources ?? []).length > 1) && (
                  <button
                    onClick={() => setDiscoveredFilter("multi-source")}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      discoveredFilter === "multi-source"
                        ? "bg-amber-600 text-white"
                        : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                    }`}
                  >
                    Multi-platform ({discoveredListings.filter((l) => (l.all_sources ?? []).length > 1).length})
                  </button>
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                New jobs found by your saved searches while you were away.
              </p>
              <div className="space-y-3">
                {discoveredListings
                  .filter((l) =>
                    discoveredFilter === "multi-source"
                      ? (l.all_sources ?? []).length > 1
                      : true
                  )
                  .map((listing) => (
                    <JobCard
                      key={listing.id}
                      job={listing}
                      onSave={async (job) => {
                        const result = await handleSaveJob(job);
                        if (!result.alreadySaved) {
                          setDiscoveredListings((prev) =>
                            prev.filter((l) => l.id !== listing.id)
                          );
                        }
                        return result;
                      }}
                      isSaved={listing.is_saved}
                    />
                  ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

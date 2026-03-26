"use client";

import { useState } from "react";
import { Play, Trash2, ChevronDown, ChevronUp, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { SavedSearch, CreateSavedSearchData } from "@/lib/types/database";

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

interface SavedSearchesPanelProps {
  savedSearches: SavedSearch[];
  currentFilters?: {
    query: string;
    location: string;
    country: string;
    remoteOnly: boolean;
    salaryMin: string;
  };
  onRun: (search: SavedSearch) => void;
  onDelete: (id: string) => void;
  onCreate: (data: CreateSavedSearchData) => Promise<void>;
}

function formatLastRun(dateStr: string | null): string {
  if (!dateStr) return "Never run";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffH < 1) return "Just now";
  if (diffH < 24) return `${diffH} hour${diffH > 1 ? "s" : ""} ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD} day${diffD > 1 ? "s" : ""} ago`;
}

export function SavedSearchesPanel({
  savedSearches,
  currentFilters,
  onRun,
  onDelete,
  onCreate,
}: SavedSearchesPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // New search form state — pre-fill from current filters
  const [newName, setNewName] = useState("");
  const [newQuery, setNewQuery] = useState(currentFilters?.query ?? "");
  const [newLocation, setNewLocation] = useState(currentFilters?.location ?? "");
  const [newCountry, setNewCountry] = useState(currentFilters?.country ?? "gb");
  const [newRemote, setNewRemote] = useState(currentFilters?.remoteOnly ?? false);
  const [newSalaryMin, setNewSalaryMin] = useState(currentFilters?.salaryMin ?? "");
  const [newActive, setNewActive] = useState(true);

  function openDialog() {
    // Re-sync with current filters when opening
    setNewQuery(currentFilters?.query ?? "");
    setNewLocation(currentFilters?.location ?? "");
    setNewCountry(currentFilters?.country ?? "gb");
    setNewRemote(currentFilters?.remoteOnly ?? false);
    setNewSalaryMin(currentFilters?.salaryMin ?? "");
    setNewName("");
    setDialogOpen(true);
  }

  async function handleCreate() {
    if (!newName.trim() || !newQuery.trim()) {
      toast.error("Name and search query are required");
      return;
    }
    setCreating(true);
    try {
      await onCreate({
        name: newName.trim(),
        query: newQuery.trim(),
        location: newLocation.trim() || null,
        country: newCountry,
        remote_only: newRemote,
        salary_min: newSalaryMin ? parseInt(newSalaryMin) : null,
        is_active: newActive,
      });
      setDialogOpen(false);
      toast.success("Saved search created");
    } catch {
      toast.error("Failed to create saved search");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/jobs/saved-searches/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onDelete(id);
      toast.success("Search deleted");
    } catch {
      toast.error("Failed to delete search");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          className="flex items-center gap-2 text-sm font-semibold hover:text-foreground text-foreground"
          onClick={() => setCollapsed((v) => !v)}
        >
          🔍 My Saved Searches
          {collapsed ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        <Button size="sm" variant="outline" onClick={openDialog}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          New
        </Button>
      </div>

      {/* List */}
      {!collapsed && (
        <div className="border-t divide-y">
          {savedSearches.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted-foreground">
              No saved searches yet. Save a search to run it again quickly.
            </p>
          ) : (
            savedSearches.map((search) => (
              <div key={search.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{search.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {COUNTRIES.find((c) => c.code === search.country)?.label ?? search.country}
                    {search.remote_only && " · Remote"}
                    {search.last_run_at && ` · Last run: ${formatLastRun(search.last_run_at)}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2"
                    onClick={() => onRun(search)}
                    title="Run this search"
                  >
                    <Play className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(search.id)}
                    disabled={deleting === search.id}
                    title="Delete search"
                  >
                    {deleting === search.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Search</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="search-name">Name *</Label>
              <Input
                id="search-name"
                placeholder="e.g. Senior PM London"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="search-query">Keywords / job title *</Label>
              <Input
                id="search-query"
                placeholder="e.g. Product Manager"
                value={newQuery}
                onChange={(e) => setNewQuery(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="search-location">Location</Label>
                <Input
                  id="search-location"
                  placeholder="e.g. London"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Country</Label>
                <Select value={newCountry} onValueChange={setNewCountry}>
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
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="search-salary">Min salary (annual)</Label>
                <Input
                  id="search-salary"
                  type="number"
                  placeholder="e.g. 50000"
                  value={newSalaryMin}
                  onChange={(e) => setNewSalaryMin(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Options</Label>
                <div className="flex items-center gap-4 h-9">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newRemote}
                      onChange={(e) => setNewRemote(e.target.checked)}
                      className="rounded"
                    />
                    Remote only
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newActive}
                      onChange={(e) => setNewActive(e.target.checked)}
                      className="rounded"
                    />
                    Daily alerts
                  </label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Search
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

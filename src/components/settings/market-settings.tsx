'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Star, Pencil, Trash2 } from 'lucide-react';
import {
  addMarketAction,
  removeMarketAction,
  setPrimaryMarketAction,
  updateMarketPreferencesAction,
} from '@/app/(protected)/dashboard/settings/actions';
import { getAllMarkets, getMarketConfig } from '@/lib/markets';
import type { UserMarketSetting, MarketPreferences } from '@/lib/types/database';

interface MarketSettingsProps {
  userMarkets: UserMarketSetting[];
}

interface EditState {
  marketCode: string;
  language_preference: string;
  job_search_radius_km: number;
  salary_currency: string;
  resume_format: string;
}

export function MarketSettings({ userMarkets: initialMarkets }: MarketSettingsProps) {
  const [markets, setMarkets] = useState(initialMarkets);
  const [editOpen, setEditOpen] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const allMarkets = getAllMarkets();
  const addedCodes = new Set(markets.map((m) => m.market_code));
  const availableToAdd = allMarkets.filter((m) => !addedCodes.has(m.code));

  function handleAdd(marketCode: string) {
    startTransition(async () => {
      try {
        await addMarketAction(marketCode);
        const config = getMarketConfig(marketCode)!;
        setMarkets((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            user_id: '',
            market_code: marketCode,
            is_primary: prev.length === 0,
            language_preference: config.defaultLanguage,
            job_search_radius_km: 50,
            salary_currency: config.currency,
            resume_format: config.resumeFormats.default,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);
        toast.success(`${config.name} added`);
      } catch {
        toast.error('Failed to add market');
      }
    });
  }

  function handleSetPrimary(marketCode: string) {
    startTransition(async () => {
      try {
        await setPrimaryMarketAction(marketCode);
        setMarkets((prev) =>
          prev.map((m) => ({ ...m, is_primary: m.market_code === marketCode }))
        );
        const config = getMarketConfig(marketCode);
        toast.success(`${config?.name ?? marketCode} set as primary market`);
      } catch {
        toast.error('Failed to update primary market');
      }
    });
  }

  function handleRemove(marketCode: string) {
    startTransition(async () => {
      try {
        await removeMarketAction(marketCode);
        setMarkets((prev) => prev.filter((m) => m.market_code !== marketCode));
        setRemoveConfirm(null);
        const config = getMarketConfig(marketCode);
        toast.success(`${config?.name ?? marketCode} removed`);
      } catch {
        toast.error('Failed to remove market');
      }
    });
  }

  function openEdit(market: UserMarketSetting) {
    setEditState({
      marketCode: market.market_code,
      language_preference: market.language_preference,
      job_search_radius_km: market.job_search_radius_km,
      salary_currency: market.salary_currency,
      resume_format: market.resume_format,
    });
    setEditOpen(true);
  }

  function handleSaveEdit() {
    if (!editState) return;
    const { marketCode, ...prefs } = editState;
    startTransition(async () => {
      try {
        await updateMarketPreferencesAction(marketCode, prefs as Partial<MarketPreferences>);
        setMarkets((prev) =>
          prev.map((m) =>
            m.market_code === marketCode ? { ...m, ...prefs } : m
          )
        );
        setEditOpen(false);
        toast.success('Market preferences saved');
      } catch {
        toast.error('Failed to save preferences');
      }
    });
  }

  return (
    <div className="space-y-4">
      {markets.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No markets configured. Add a market to start discovering jobs.
        </p>
      )}

      {markets.map((market, idx) => {
        const config = getMarketConfig(market.market_code);
        if (!config) return null;

        return (
          <div key={market.market_code}>
            {idx > 0 && <Separator className="mb-4" />}
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{config.flag}</span>
                  <span className="font-medium">{config.name}</span>
                  {market.is_primary && (
                    <Badge variant="secondary" className="text-xs">
                      <Star className="h-3 w-3 mr-1" />
                      Primary
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!market.is_primary && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleSetPrimary(market.market_code)}
                      title="Set as primary"
                    >
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => openEdit(market)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending || markets.length === 1}
                    onClick={() => setRemoveConfirm(market.market_code)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                <span>Language: {market.language_preference.toUpperCase()}</span>
                <span>Currency: {market.salary_currency}</span>
                <span>CV format: {market.resume_format}</span>
                <span>Radius: {market.job_search_radius_km} km</span>
              </div>
            </div>
          </div>
        );
      })}

      {availableToAdd.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isPending}>
              <Plus className="h-4 w-4 mr-2" />
              Add Market
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {availableToAdd.map((m) => (
              <DropdownMenuItem key={m.code} onClick={() => handleAdd(m.code)}>
                <span className="mr-2">{m.flag}</span>
                {m.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {availableToAdd.length === 0 && markets.length > 0 && (
        <p className="text-xs text-muted-foreground">All available markets added.</p>
      )}

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editState && getMarketConfig(editState.marketCode)
                ? `Edit ${getMarketConfig(editState.marketCode)!.flag} ${getMarketConfig(editState.marketCode)!.name} preferences`
                : 'Edit market preferences'}
            </DialogTitle>
          </DialogHeader>
          {editState && (
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label htmlFor="language">Language</Label>
                <Input
                  id="language"
                  value={editState.language_preference}
                  onChange={(e) =>
                    setEditState((s) => s && { ...s, language_preference: e.target.value })
                  }
                  placeholder="e.g. sv, en"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="radius">Search radius (km)</Label>
                <Input
                  id="radius"
                  type="number"
                  min={0}
                  value={editState.job_search_radius_km}
                  onChange={(e) =>
                    setEditState((s) =>
                      s && { ...s, job_search_radius_km: Number(e.target.value) }
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="currency">Salary currency</Label>
                <Input
                  id="currency"
                  value={editState.salary_currency}
                  onChange={(e) =>
                    setEditState((s) => s && { ...s, salary_currency: e.target.value })
                  }
                  placeholder="e.g. SEK, GBP, USD"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="resumeFormat">CV format</Label>
                <Select
                  value={editState.resume_format}
                  onValueChange={(v) =>
                    setEditState((s) => s && { ...s, resume_format: v })
                  }
                >
                  <SelectTrigger id="resumeFormat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="swedish">Swedish</SelectItem>
                    <SelectItem value="international">International</SelectItem>
                    <SelectItem value="german">German</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirmation dialog */}
      <Dialog open={!!removeConfirm} onOpenChange={() => setRemoveConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove market?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {removeConfirm && getMarketConfig(removeConfirm)
              ? `Remove ${getMarketConfig(removeConfirm)!.flag} ${getMarketConfig(removeConfirm)!.name} from your active markets?`
              : 'Remove this market?'}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => removeConfirm && handleRemove(removeConfirm)}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

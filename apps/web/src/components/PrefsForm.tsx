import {
  DEFAULT_SPLIT_THRESHOLD_CENTS,
  formatZAR,
  MAX_BUDGET_CENTS,
  parseRandsToCents,
  REGIONS,
  type RegionId,
  type UserPrefs,
} from '@cart-wise/shared';
import { type SubmitEvent, useState } from 'react';
import { useSavePrefs } from '../lib/prefs';
import { Alert, Button, SelectField, TextField } from './ui';

interface Props {
  initial: UserPrefs | null;
  /** Onboarding only asks for the region; settings shows everything. */
  mode: 'onboarding' | 'settings';
  submitLabel: string;
  onSaved?: () => void;
}

type Errors = Partial<Record<'regionId' | 'budget' | 'splitThreshold', string>>;

function toRandsInput(cents: number | null): string {
  return cents === null ? '' : formatZAR(cents).slice(1);
}

export function PrefsForm({ initial, mode, submitLabel, onSaved }: Props) {
  const save = useSavePrefs();
  const [regionId, setRegionId] = useState<RegionId | ''>(initial?.regionId ?? '');
  const [budget, setBudget] = useState(toRandsInput(initial?.budgetCents ?? null));
  const [splitThreshold, setSplitThreshold] = useState(
    toRandsInput(initial?.splitThresholdCents ?? DEFAULT_SPLIT_THRESHOLD_CENTS),
  );
  const [errors, setErrors] = useState<Errors>({});
  const [saved, setSaved] = useState(false);

  function validate(): UserPrefs | null {
    const next: Errors = {};
    if (!regionId) next.regionId = 'Choose your province.';

    const budgetCents = budget.trim() === '' ? null : parseRandsToCents(budget);
    if (budget.trim() !== '' && (budgetCents === null || budgetCents > MAX_BUDGET_CENTS)) {
      next.budget = 'Enter an amount like 800 or 1 250.50.';
    }
    const splitThresholdCents = parseRandsToCents(splitThreshold);
    if (splitThresholdCents === null || splitThresholdCents > MAX_BUDGET_CENTS) {
      next.splitThreshold = 'Enter an amount like 50.';
    }

    setErrors(next);
    if (Object.keys(next).length > 0 || !regionId || splitThresholdCents === null) return null;
    return { regionId, budgetCents, splitThresholdCents };
  }

  function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    setSaved(false);
    const prefs = validate();
    if (!prefs) return;
    save.mutate(prefs, {
      onSuccess: () => {
        setSaved(true);
        onSaved?.();
      },
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {save.isError && <Alert>{save.error.message}</Alert>}
      <SelectField
        label="Province"
        hint="Pamphlets and prices differ by region."
        value={regionId}
        error={errors.regionId}
        onChange={(e) => {
          setRegionId(e.target.value as RegionId);
        }}
      >
        <option value="" disabled>
          Choose…
        </option>
        {REGIONS.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </SelectField>

      {mode === 'settings' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Monthly grocery budget (R)"
            hint="Optional. We'll flag lists that go over."
            inputMode="decimal"
            placeholder="e.g. 800"
            value={budget}
            error={errors.budget}
            onChange={(e) => {
              setBudget(e.target.value);
            }}
          />
          <TextField
            label="Split my shop when it saves at least (R)"
            hint="Only suggest visiting two stores if it saves this much."
            inputMode="decimal"
            value={splitThreshold}
            error={errors.splitThreshold}
            onChange={(e) => {
              setSplitThreshold(e.target.value);
            }}
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : submitLabel}
        </Button>
        {saved && mode === 'settings' && (
          <span role="status" className="text-sm text-brand-700">
            Saved
          </span>
        )}
      </div>
    </form>
  );
}

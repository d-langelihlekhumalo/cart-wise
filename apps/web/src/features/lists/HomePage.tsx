import { formatZAR, regionName } from '@cart-wise/shared';
import { Link } from 'react-router';
import { CheckIcon, ListIcon } from '../../components/icons';
import { PageHeader } from '../../components/Layout';
import { Card, Spinner } from '../../components/ui';
import { usePrefs } from '../../lib/prefs';
import { useAppSession } from '../../lib/session';
import { useLists } from './hooks';
import { ListCard } from './ListsPage';

const RECENT_LISTS = 4;

export function Component() {
  const { user } = useAppSession();
  const { data: prefs } = usePrefs();
  const lists = useLists();
  if (!user || !prefs || lists === undefined) return <Spinner />;

  const setupSteps = [
    { label: 'Create your account', done: true },
    { label: 'Choose your province', done: true },
    { label: 'Make your first shopping list', done: lists.length > 0, to: '/lists' },
    { label: 'Set a monthly budget', done: prefs.budgetCents !== null, to: '/settings' },
    { label: 'Add your loyalty cards', done: false, soon: true },
  ];

  return (
    <>
      <PageHeader title={`Hi ${user.name}`} description="Here's where your shopping stands." />

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <Card className="flex min-h-72 flex-col lg:col-span-2 lg:row-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Your shopping lists</h2>
            {lists.length > 0 && (
              <Link to="/lists" className="text-sm font-medium text-brand-700 hover:underline">
                See all
              </Link>
            )}
          </div>
          {lists.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <ListIcon className="size-6" />
              </span>
              <div className="space-y-1">
                <p className="font-medium">No lists yet</p>
                <p className="max-w-sm text-sm text-stone-600">
                  Make a list, then tick items off in the shop, even without data.
                </p>
              </div>
              <Link
                to="/lists"
                className="rounded-lg bg-brand-700 px-4 py-2.5 font-medium text-white hover:bg-brand-800"
              >
                Create a list
              </Link>
            </div>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {lists.slice(0, RECENT_LISTS).map((list) => (
                <li key={list.id}>
                  <ListCard list={list} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Your setup</h2>
            <Link to="/settings" className="text-sm font-medium text-brand-700 hover:underline">
              Edit
            </Link>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Province" value={regionName(prefs.regionId)} />
            <Stat
              label="Monthly budget"
              value={prefs.budgetCents === null ? 'Not set' : formatZAR(prefs.budgetCents)}
              muted={prefs.budgetCents === null}
            />
            <Stat label="Split shops when saving" value={formatZAR(prefs.splitThresholdCents)} />
            <Stat label="Loyalty cards" value="Coming soon" muted />
          </dl>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-semibold">Getting started</h2>
          <ol className="space-y-2 text-sm">
            {setupSteps.map((step) => (
              <li key={step.label} className="flex items-center gap-3">
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
                    step.done ? 'bg-brand-600 text-white' : 'ring-1 ring-stone-300'
                  }`}
                >
                  {step.done && <CheckIcon className="size-4" />}
                </span>
                {step.to && !step.done ? (
                  <Link to={step.to} className="font-medium text-brand-700 hover:underline">
                    {step.label}
                  </Link>
                ) : (
                  <span className={step.done ? 'text-stone-500 line-through' : ''}>
                    {step.label}
                  </span>
                )}
                {step.soon && (
                  <span className="ml-auto rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500">
                    Soon
                  </span>
                )}
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-lg bg-stone-50 p-3">
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className={`mt-0.5 font-medium ${muted ? 'text-stone-400' : ''}`}>{value}</dd>
    </div>
  );
}

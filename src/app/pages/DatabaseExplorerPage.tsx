import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft, Download, KeyRound, Search, ShieldCheck, Sigma, Table2,
} from 'lucide-react';
import {
  countRows, describeTable, exportDatabaseBytes, listTables, readTable, type ColumnInfo,
} from '../utils/db';
import { OPENING_BALANCE, getAllTransactions, walletBalanceFrom } from '../utils/transactionStorage';
import { getXPStats } from '../utils/rewardStorage';
import { getAllUsers, roleOf } from '../utils/userStorage';
import { useAppEvents } from '../utils/useAppEvents';

/**
 * Every table the app actually keeps, live.
 *
 * Nothing here is a fixture: the tables, their columns and their rows are read
 * from the running SQLite database through `PRAGMA` and `SELECT *`, so a table
 * added tomorrow appears without this page being touched. The only hard-coded
 * thing is the one-line explanation of what each table is for, which is
 * documentation rather than data.
 */

const PURPOSE: Record<string, string> = {
  users: 'Every account — customers, the two stalls and the admin. The password column is deliberately empty: credentials live on the server, never in the browser copy.',
  transactions: 'The ledger. One row per payment, top-up, transfer, cashback or goal movement. The wallet balance is the sum of these, never a stored figure.',
  processed_payments: 'Payment ids already applied, so pressing back on a success screen cannot charge the same bill twice.',
  reminders: 'Money owed between friends after a split, and whether it has been settled.',
  reminder_settings: 'Per-account nudge frequency and quiet hours.',
  notifications: 'The Notification Centre, including the voucher-expiry warnings the scheduler raises.',
  notification_preferences: 'Which channels each account wants to hear from.',
  payment_methods: 'Linked cards and bank accounts, which is default, and which are frozen.',
  cards: 'The NETS cards on Home — the Prepaid Card and Motoring CashCard hold their own float; the vCashCard is the wallet itself.',
  user_preferences: 'Per-account settings, including the four Quick Actions each customer picked for their Home screen.',
  merchants: 'The stalls and shops a QR code can resolve to, with the XP rate and multiplier each awards.',
  merchant_items: 'Each stall\'s menu — what a customer can pick when paying by NETS.',
  item_sales: 'The line-level record of what sold: item, price, quantity, when. Both the merchant dashboard and the per-dish report read this one table.',
  deals: 'The reward catalogue in the XP store, with cost, terms and outlet.',
  reward_redemptions: 'Vouchers and cashback customers have redeemed, with expiry and whether they have been used.',
  reward_promotions: 'Paid Featured and Spotlight placements merchants have bought, with impressions and what they paid.',
  redemptions: 'Legacy deal redemptions kept for older saved records.',
  saved_deals: 'Rewards a customer has bookmarked.',
  activities: 'The Hangouts catalogue of things to do.',
  saved_activities: 'Activities a customer has shortlisted.',
  hangouts: 'Planned outings — who is invited, what is shortlisted, what was confirmed.',
  hangout_votes: 'One row per participant per vote, so a tie can be resolved by the organiser.',
  savings_goals: 'Money set aside. Contributions leave the spendable balance as a real ledger entry.',
  budgets: 'Monthly spending caps per category.',
  insights: 'Derived spending observations shown on the dashboard.',
  contact_groups: 'Named groups of friends for repeat splits.',
  contact_group_members: 'Who is in each group.',
  app_meta: 'Housekeeping flags — what has been seeded, what has been reconciled, which expiry reminders were already sent.',
};

/** Columns that would be a secret if they ever held one. */
const SECRET = /(password|pin|hash|token|secret|salt)$/i;

const PAGE = 12;

export function DatabaseExplorerPage() {
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);
  // Every write event the app raises, so no table on this screen can go stale
  // while it is open — the point of the page is that it shows the live database.
  useAppEvents(
    ['transactionsUpdated', 'itemSalesUpdated', 'menuUpdated', 'merchantsUpdated',
      'rewardRedemptionsUpdated', 'redemptionsUpdated', 'promotionsUpdated',
      'dealsUpdated', 'savedDealsUpdated', 'notificationsUpdated',
      'notificationPreferencesUpdated', 'remindersUpdated', 'reminderSettingsUpdated',
      'hangoutsUpdated', 'activitiesUpdated', 'savedActivitiesUpdated',
      'goalsUpdated', 'budgetsUpdated', 'cardsUpdated', 'paymentMethodsUpdated',
      'quickActionsUpdated', 'userSwitched', 'databaseReady'],
    () => setTick(n => n + 1),
  );

  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const tables = useMemo(
    () => listTables().map(name => ({ name, rows: countRows(name) })),
    [tick],
  );
  const totalRows = tables.reduce((sum, table) => sum + table.rows, 0);

  const shown = tables
    .filter(table => table.name.toLowerCase().includes(filter.trim().toLowerCase()))
    .sort((a, b) => b.rows - a.rows || a.name.localeCompare(b.name));

  if (open) return <TableView table={open} tick={tick} onBack={() => setOpen(null)} />;

  return (
    <div className="flex h-full flex-col bg-white">
      <header data-dark-surface className="flex-shrink-0 bg-gradient-to-b from-[#1e2a4a] to-[#2d3f6a] px-4 pb-4 pt-12">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-white/15"
          >
            <ArrowLeft size={18} className="text-white" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold text-white min-[360px]:text-base">Database</h1>
            <p className="truncate text-xs text-white/60">Everything the app has stored, live</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Headline value={String(tables.length)} label="Tables" />
          <Headline value={totalRows.toLocaleString()} label="Rows" />
          <Headline value={fileSize()} label="On disk" />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <p className="mb-4 text-[11px] leading-relaxed text-muted-foreground">
          This is the real SQLite database the prototype runs on, read live through{' '}
          <code className="rounded bg-secondary px-1">PRAGMA table_info</code> and{' '}
          <code className="rounded bg-secondary px-1">SELECT *</code>. Nothing on this screen is a
          mock-up, and a table added later shows up here without this page changing.
        </p>

        <DerivedFigures tick={tick} />

        <h2 className="mb-2 text-sm font-black text-foreground">Every table</h2>

        <div className="mb-3 flex items-center gap-2 rounded-xl bg-secondary px-3">
          <Search size={15} className="flex-shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            value={filter}
            onChange={event => setFilter(event.target.value)}
            aria-label="Filter tables by name"
            placeholder="Find a table…"
            className="min-h-11 w-full bg-transparent text-xs outline-none"
          />
        </div>

        <ul className="space-y-2">
          {shown.map(table => (
            <li key={table.name}>
              <button
                onClick={() => setOpen(table.name)}
                className="w-full rounded-2xl border-2 border-border bg-white p-3 text-left transition-transform active:scale-[0.99]"
              >
                <div className="flex items-center gap-2">
                  <Table2 size={15} className="flex-shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs font-black text-foreground">
                    {table.name}
                  </span>
                  <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${table.rows > 0 ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                    {table.rows.toLocaleString()} {table.rows === 1 ? 'row' : 'rows'}
                  </span>
                </div>
                {PURPOSE[table.name] && (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                    {PURPOSE[table.name]}
                  </p>
                )}
              </button>
            </li>
          ))}
        </ul>

        {shown.length === 0 && (
          <p className="rounded-2xl border-2 border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            No table matches "{filter}".
          </p>
        )}

        <button
          onClick={downloadDatabase}
          className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-border text-xs font-black text-foreground"
        >
          <Download size={14} aria-hidden="true" /> Download nets.sqlite
        </button>
        <p className="mt-1.5 flex items-start gap-1 text-[10px] leading-relaxed text-muted-foreground">
          <ShieldCheck size={11} className="mt-0.5 flex-shrink-0 text-primary" aria-hidden="true" />
          A genuine SQLite file — openable in DB Browser or any SQL client. It carries no PIN and
          no password: authentication is server-side, so those columns are empty in the browser's
          copy.
        </p>
      </div>
    </div>
  );
}

// ─── Derived, not stored ─────────────────────────────────────────────────────

/**
 * The claim this codebase makes everywhere — that a figure on screen is
 * computed from rows rather than kept as a number somebody typed — shown with
 * its arithmetic, per account.
 *
 * The "no such column" check at the bottom is not a promise: it scans every
 * column of every table at render time and counts the matches. If someone ever
 * adds a `balance` column, this panel will say so.
 */
function DerivedFigures({ tick }: { tick: number }) {
  const accounts = useMemo(
    () => getAllUsers()
      .filter(user => roleOf(user) === 'customer')
      .map(user => {
        const transactions = getAllTransactions(user.id);
        const xp = getXPStats(user.id);
        return {
          id: user.id,
          name: user.name,
          rows: transactions.length,
          balance: walletBalanceFrom(transactions),
          movement: transactions.reduce((sum, transaction) => sum + transaction.amount, 0),
          xp,
        };
      }),
    [tick],
  );

  // Column names that would mean the wallet or an XP total was being kept as a
  // number instead of derived. `cards.balance` is deliberately not one of them:
  // a prepaid card's float is its own holding, not a copy of the wallet, and
  // every pound moved in or out of it is still a ledger transaction.
  const stored = useMemo(
    () => listTables().flatMap(table =>
      describeTable(table)
        .filter(column => /^(balance|wallet_balance|xp|points|total_xp|current_xp)$/i.test(column.name))
        .map(column => `${table}.${column.name}`))
      .filter(column => column !== 'cards.balance'),
    [tick],
  );

  const money = (n: number) =>
    `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <section className="mb-5">
      <h2 className="mb-1 text-sm font-black text-foreground">Derived, not stored</h2>
      <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
        Every balance and XP total in the app is computed from the rows above, each time it is
        shown. Here is that arithmetic for each account, run right now.
      </p>

      <ul className="space-y-2">
        {accounts.map(account => (
          <li key={account.id} className="rounded-2xl border-2 border-border bg-white p-3">
            <div className="mb-2 flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-xs font-black text-foreground">{account.name}</p>
              <span className="flex-shrink-0 font-mono text-[10px] text-muted-foreground">
                users.id = {account.id}
              </span>
            </div>

            <Derivation
              expression={`${money(OPENING_BALANCE)} opening ${account.movement < 0 ? '−' : '+'} ${money(Math.abs(account.movement))} over ${account.rows} ${account.rows === 1 ? 'row' : 'rows'}`}
              result={money(account.balance)}
              label="wallet balance"
            />
            <Derivation
              expression={`${account.xp.lifetimeXP.toLocaleString()} earned − ${account.xp.spentXP.toLocaleString()} spent`}
              result={`${account.xp.currentXP.toLocaleString()} XP`}
              label="spendable now"
            />
          </li>
        ))}
      </ul>

      <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-primary/5 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
        <Sigma size={12} className="mt-0.5 flex-shrink-0 text-primary" aria-hidden="true" />
        {stored.length === 0 ? (
          <span>
            Checked just now, across all {listTables().length} tables:{' '}
            <b className="text-foreground">no wallet-balance or XP column exists</b>. There is
            nowhere to keep a figure, so no screen can disagree with the ledger. The one stored
            amount is <code className="rounded bg-secondary px-1">cards.balance</code> — a prepaid
            card's own float, which is not a copy of the wallet, and every top-up or unload out of
            it is still written as a transaction.
          </span>
        ) : (
          <span>
            These columns keep a figure that could drift from the ledger:{' '}
            <b className="text-foreground">{stored.join(', ')}</b>.
          </span>
        )}
      </p>
    </section>
  );
}

/** One sum and its answer, kept on separate lines so neither wraps mid-figure. */
function Derivation({ expression, result, label }: {
  expression: string; result: string; label: string;
}) {
  return (
    <div className="mt-1.5 first:mt-0">
      <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">{expression}</p>
      <p className="font-mono text-[10px] leading-relaxed">
        <span className="text-muted-foreground">= </span>
        <b className="text-foreground">{result}</b>
        <span className="text-muted-foreground"> {label}</span>
      </p>
    </div>
  );
}

function Headline({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-white/10 p-2 text-center">
      <p className="text-base font-black leading-none text-white">{value}</p>
      <p className="mt-1 text-[10px] text-white/60">{label}</p>
    </div>
  );
}

// ─── One table ───────────────────────────────────────────────────────────────

function TableView({ table, tick, onBack }: { table: string; tick: number; onBack: () => void }) {
  const [shown, setShown] = useState(PAGE);
  const columns = useMemo(() => describeTable(table), [table, tick]);
  const total = useMemo(() => countRows(table), [table, tick]);
  const rows = useMemo(() => readTable(table, shown), [table, shown, tick]);
  const hasSecret = columns.some(column => SECRET.test(column.name));

  return (
    <div className="flex h-full flex-col bg-white">
      <header data-dark-surface className="flex-shrink-0 bg-gradient-to-b from-[#1e2a4a] to-[#2d3f6a] px-4 pb-4 pt-12">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            aria-label="Back to all tables"
            className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-white/15"
          >
            <ArrowLeft size={18} className="text-white" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-mono text-sm font-bold text-white">{table}</h1>
            <p className="truncate text-xs text-white/60">
              {total.toLocaleString()} {total === 1 ? 'row' : 'rows'} · {columns.length} columns
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {PURPOSE[table] && (
          <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">{PURPOSE[table]}</p>
        )}

        <h2 className="mb-2 text-sm font-black text-foreground">Columns</h2>
        <ul className="mb-4 space-y-1">
          {columns.map(column => (
            <li key={column.name} className="flex items-center gap-2 rounded-xl bg-secondary px-2.5 py-2">
              {column.primaryKey && <KeyRound size={11} className="flex-shrink-0 text-primary" aria-label="Primary key" />}
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] font-bold text-foreground">
                {column.name}
              </span>
              <span className="flex-shrink-0 font-mono text-[10px] text-muted-foreground">
                {column.type}{column.notNull ? ' · required' : ''}
              </span>
            </li>
          ))}
        </ul>

        {hasSecret && (
          <p className="mb-4 flex items-start gap-1.5 rounded-xl bg-primary/5 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
            <ShieldCheck size={12} className="mt-0.5 flex-shrink-0 text-primary" aria-hidden="true" />
            This table has a credential column. It is empty here by design — PINs are hashed and
            held by the server, and never written to the browser's database. Any value that did
            appear would be masked below rather than displayed.
          </p>
        )}

        <h2 className="mb-2 text-sm font-black text-foreground">
          Rows <span className="font-normal text-muted-foreground">(newest first)</span>
        </h2>

        {rows.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            This table is empty. Use the feature that writes to it and the rows appear here.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row, index) => (
              <li key={index} className="rounded-2xl border-2 border-border bg-white p-3">
                <dl className="space-y-1">
                  {columns.map(column => (
                    <div key={column.name} className="flex gap-2">
                      <dt className="w-[38%] flex-shrink-0 truncate font-mono text-[10px] text-muted-foreground">
                        {column.name}
                      </dt>
                      <dd className="min-w-0 flex-1 break-words font-mono text-[10px] text-foreground">
                        {display(column, row[column.name])}
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        )}

        {rows.length < total && (
          <button
            onClick={() => setShown(count => count + PAGE)}
            className="mt-3 min-h-11 w-full rounded-xl border-2 border-border text-xs font-black text-foreground"
          >
            Show more ({(total - rows.length).toLocaleString()} left)
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * A cell as text. Nulls are shown as null rather than as a blank — an empty
 * column is often the point — and anything in a credential column is masked
 * even though nothing should ever put a value there.
 */
function display(column: ColumnInfo, value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (SECRET.test(column.name)) return '••••••';
  const text = String(value);
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

function fileSize(): string {
  try {
    const kb = exportDatabaseBytes().byteLength / 1024;
    return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
  } catch {
    return '—';
  }
}

function downloadDatabase(): void {
  const bytes = exportDatabaseBytes();
  // Copy into a fresh buffer: the export is backed by WASM memory, which the
  // Blob must not hold a live view of.
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/x-sqlite3' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'nets.sqlite';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

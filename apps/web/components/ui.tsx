// Tiny set of shared UI pieces (no component library needed for this prototype).

type Tone = 'neutral' | 'brand' | 'green' | 'amber' | 'red';

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-100',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}

const buttonVariants = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-600/60',
  secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50',
  danger: 'bg-white text-red-700 ring-1 ring-inset ring-red-300 hover:bg-red-50',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonVariants }) {
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed ${buttonVariants[variant]} ${className}`}
      {...props}
    />
  );
}

export function Alert({ tone = 'red', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <div role="alert" className={`rounded-lg px-4 py-3 text-sm ring-1 ring-inset ${toneClasses[tone]}`}>
      {children}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-sm text-slate-500" role="status">
      <span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
      {label}
    </div>
  );
}

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      </div>
      {/* self-start: badges and buttons keep their natural width on phones instead of stretching */}
      {children && <div className="self-start sm:self-auto">{children}</div>}
    </div>
  );
}

export const LEVEL_NAMES: Record<number, string> = { 1: 'Aware', 2: 'Working', 3: 'Proficient', 4: 'Expert' };

export function levelLabel(level: number | null) {
  return level === null ? 'No claim' : `L${level} ${LEVEL_NAMES[level] ?? ''}`.trim();
}

// Pinned to the bottom of the screen, so it is visible even when the user has
// scrolled far down a list on a phone. Announced to screen readers.
export function Toast({ tone, children, onClose }: { tone: Tone; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 sm:justify-end">
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg px-4 py-3 text-sm shadow-lg ring-1 ring-inset ${toneClasses[tone]}`}
      >
        <p className="flex-1">{children}</p>
        <button onClick={onClose} className="-m-1 p-1 opacity-60 hover:opacity-100" aria-label="Dismiss">
          ✕
        </button>
      </div>
    </div>
  );
}

// ── Form building blocks ───────────────────────────────────

const controlClass =
  'mt-1 block w-full rounded-lg border-0 bg-white px-3 py-2.5 text-base ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-brand-600 sm:text-sm';

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${controlClass} ${props.className ?? ''}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={`${controlClass} ${props.className ?? ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${controlClass} ${props.className ?? ''}`} />;
}

export function Card({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">{children}</p>;
}

// Status of a certificate / qualification / claim, in plain words.
export function VerificationBadge({ status }: { status: 'PENDING' | 'VERIFIED' | 'REJECTED' }) {
  if (status === 'VERIFIED') return <Badge tone="green">Verified</Badge>;
  if (status === 'REJECTED') return <Badge tone="red">Rejected</Badge>;
  return <Badge tone="amber">Pending verification</Badge>;
}

export function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

// First element on every page: lets keyboard users jump past the navigation.
// Invisible until it receives focus (first Tab press).
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-brand-700 focus:shadow-lg focus:ring-2 focus:ring-brand-600"
    >
      Skip to main content
    </a>
  );
}

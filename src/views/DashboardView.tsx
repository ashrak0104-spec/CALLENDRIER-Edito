import { useMemo } from 'react';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { PILLAR_META, PILLARS, PLATFORMS, PLATFORM_META, STATUSES, STATUS_META } from '../constants';
import { formatDayMonth, formatTime, monthKeyOf } from '../lib/dates';
import { cx, percent } from '../lib/utils';
import { useEditorial } from '../store/editorial';

interface DashboardViewProps {
  onOpen: (id: string) => void;
  onGoToCalendar: () => void;
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  accent: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${accent}18`, color: accent }}
        >
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted">{hint}</p>
    </div>
  );
}

function DonutChart({ data }: { data: Array<{ label: string; value: number; color: string }> }) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="relative shrink-0">
      <svg viewBox="0 0 140 140" className="h-40 w-40 -rotate-90">
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="rgb(var(--c-raised))"
          strokeWidth="16"
        />
        {data.map((entry) => {
          const length = total > 0 ? (entry.value / total) * circumference : 0;
          const node = (
            <circle
              key={entry.label}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={entry.color}
              strokeWidth="16"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
            />
          );
          offset += length;
          return node;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums">{total}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted">contenus</span>
      </div>
    </div>
  );
}

export default function DashboardView({ onOpen, onGoToCalendar }: DashboardViewProps) {
  const { items } = useEditorial();
  const currentMonth = monthKeyOf(new Date());

  const stats = useMemo(() => {
    const now = new Date();
    const monthItems = items.filter(
      (item) => item.scheduledDate && monthKeyOf(item.scheduledDate) === currentMonth,
    );
    const publishedMonth = monthItems.filter((item) => item.status === 'Publié').length;
    const inProduction = items.filter(
      (item) => item.status === 'Rédaction / Création' || item.status === 'En révision',
    ).length;
    const scheduled = items.filter((item) => Boolean(item.scheduledDate)).length;

    const checklistTotal = monthItems.reduce((sum, item) => sum + item.checklist.length, 0);
    const checklistDone = monthItems.reduce(
      (sum, item) => sum + item.checklist.filter((task) => task.done).length,
      0,
    );

    const pillarData = PILLARS.map((pillar) => ({
      label: pillar,
      value: items.filter((item) => item.pillar === pillar).length,
      color: PILLAR_META[pillar].color,
    }));

    const platformData = PLATFORMS.map((platform) => ({
      platform,
      value: items.filter((item) => item.platform === platform).length,
      color: PLATFORM_META[platform].color,
    })).sort((a, b) => b.value - a.value);

    const valueCount = items.filter(
      (item) => PILLAR_META[item.pillar].family === 'valeur',
    ).length;
    const saleCount = items.length - valueCount;

    const statusData = STATUSES.map((status) => ({
      status,
      value: items.filter((item) => item.status === status).length,
      color: STATUS_META[status].color,
    }));

    const next = [...items]
      .filter(
        (item) =>
          item.scheduledDate && new Date(item.scheduledDate).getTime() >= now.getTime(),
      )
      .sort(
        (a, b) =>
          new Date(a.scheduledDate ?? 0).getTime() - new Date(b.scheduledDate ?? 0).getTime(),
      )
      .slice(0, 4);

    return {
      monthTotal: monthItems.length,
      publishedMonth,
      inProduction,
      scheduled,
      checklistTotal,
      checklistDone,
      completion: percent(checklistDone, checklistTotal),
      pillarData,
      platformData,
      valueCount,
      saleCount,
      statusData,
      next,
    };
  }, [items, currentMonth]);

  const maxPlatform = Math.max(1, ...stats.platformData.map((entry) => entry.value));
  const valueRatio = percent(stats.valueCount, items.length);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={BarChart3}
          label="Contenus"
          value={String(items.length)}
          hint={`${stats.scheduled} planifiés · ${items.length - stats.scheduled} sans date`}
          accent="#6366F1"
        />
        <Kpi
          icon={CheckCircle2}
          label="Publiés ce mois"
          value={`${stats.publishedMonth}/${stats.monthTotal}`}
          hint={`${percent(stats.publishedMonth, stats.monthTotal)}% du planning mensuel`}
          accent="#8B5CF6"
        />
        <Kpi
          icon={TrendingUp}
          label="En production"
          value={String(stats.inProduction)}
          hint="Rédaction et révision en cours"
          accent="#F59E0B"
        />
        <Kpi
          icon={CalendarDays}
          label="Complétion checklists"
          value={`${stats.completion}%`}
          hint={`${stats.checklistDone}/${stats.checklistTotal} étapes ce mois`}
          accent="#10B981"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="card p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Répartition par pilier</h2>
              <p className="text-[11px] text-muted">Équilibre valeur vs vente</p>
            </div>
            <span className="rounded-full bg-raised px-2 py-0.5 text-[10px] font-semibold text-muted">
              {items.length} contenus
            </span>
          </div>

          <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row">
            <DonutChart data={stats.pillarData} />
            <div className="min-w-0 flex-1 space-y-1.5">
              {stats.pillarData.map((entry) => (
                <div key={entry.label} className="flex items-center gap-2 text-xs">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-muted">{entry.label}</span>
                  <span className="font-semibold tabular-nums">{entry.value}</span>
                  <span className="w-8 text-right text-[10px] tabular-nums text-muted">
                    {percent(entry.value, items.length)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-line bg-raised/50 p-3">
            <div className="flex items-center justify-between text-[11px] font-medium">
              <span className="text-muted">Valeur</span>
              <span className="text-muted">Vente</span>
            </div>
            <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-line">
              <div
                className="h-full bg-indigo-500"
                style={{ width: `${items.length ? valueRatio : 0}%` }}
              />
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${items.length ? 100 - valueRatio : 0}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-muted">
              <span>
                {stats.valueCount} contenus · {valueRatio}%
              </span>
              <span>
                {stats.saleCount} contenus · {items.length ? 100 - valueRatio : 0}%
              </span>
            </div>
          </div>
        </div>

        <div className="card p-4 lg:col-span-3">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold">Volume par plateforme</h2>
              <p className="text-[11px] text-muted">Tous contenus confondus</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-raised px-2 py-0.5 text-[10px] font-semibold text-muted">
              <BarChart3 size={11} /> {PLATFORMS.length} canaux
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {stats.platformData.map((entry) => (
              <div key={entry.platform}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    {entry.platform}
                  </span>
                  <span className="tabular-nums text-muted">
                    {entry.value} · {percent(entry.value, items.length)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${entry.value > 0 ? Math.max(4, (entry.value / maxPlatform) * 100) : 0}%`,
                      backgroundColor: entry.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="card p-4 lg:col-span-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Complétion du mois en cours</h2>
              <p className="text-[11px] text-muted">
                Étapes de validation cochées sur les contenus planifiés ce mois-ci
              </p>
            </div>
            <span className="text-2xl font-bold tabular-nums text-accent">{stats.completion}%</span>
          </div>

          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-line">
            <div
              className={cx(
                'h-full rounded-full transition-all',
                stats.completion === 100 ? 'bg-emerald-500' : 'bg-accent',
              )}
              style={{ width: `${stats.completion}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
            <span>
              {stats.checklistDone} étapes validées sur {stats.checklistTotal} planifiées
            </span>
            <span>
              {stats.monthTotal} contenu{stats.monthTotal > 1 ? 's' : ''} ce mois
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {stats.statusData.map((entry) => (
              <div
                key={entry.status}
                className="flex items-center gap-2 rounded-lg border border-line bg-raised/40 px-2 py-1.5"
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="min-w-0 flex-1 truncate text-[10px] text-muted">{entry.status}</span>
                <span className="text-[11px] font-semibold tabular-nums">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Prochaines publications</h2>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
              onClick={onGoToCalendar}
            >
              Calendrier <ArrowRight size={12} />
            </button>
          </div>

          <div className="mt-3 space-y-1.5">
            {stats.next.length === 0 && (
              <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs text-muted">
                Aucune publication à venir. Planifiez un contenu depuis le calendrier.
              </p>
            )}
            {stats.next.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpen(item.id)}
                className="flex w-full items-center gap-2.5 rounded-lg border border-line bg-surface px-2.5 py-2 text-left transition hover:border-accent/40 hover:bg-raised/50"
              >
                <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-raised text-[9px] font-semibold uppercase leading-tight text-muted">
                  <span>{formatDayMonth(item.scheduledDate ?? '')}</span>
                  <span className="text-[9px] tabular-nums text-ink">
                    {formatTime(item.scheduledDate ?? '')}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-ink">
                    {item.title || 'Sans titre'}
                  </p>
                  <p className="truncate text-[10px] text-muted">
                    {item.platform} · {item.pillar}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

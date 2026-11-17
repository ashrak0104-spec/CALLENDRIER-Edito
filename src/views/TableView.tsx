import { useMemo, useState } from 'react';
import { ArrowUpDown, Filter, Pencil, Plus, Search, X } from 'lucide-react';
import { ChecklistProgress, PillarBadge, PlatformBadge } from '../components/Badges';
import { FORMATS, PILLARS, PLATFORMS, STATUSES, STATUS_ORDER } from '../constants';
import {
  formatDayMonth,
  formatTime,
  monthKeyOf,
  parseTime,
} from '../lib/dates';
import { cx } from '../lib/utils';
import { useEditorial } from '../store/editorial';
import type { Format, Pillar, Platform, Status } from '../types';

interface TableViewProps {
  onOpen: (id: string) => void;
  onCreate: () => void;
}

type SortKey = 'title' | 'platform' | 'status' | 'pillar' | 'scheduledDate';

const COLUMNS: Array<{ key: string; label: string; sortKey?: SortKey; className?: string }> = [
  { key: 'title', label: 'Contenu', sortKey: 'title', className: 'min-w-[240px]' },
  { key: 'platform', label: 'Plateforme', sortKey: 'platform' },
  { key: 'format', label: 'Format' },
  { key: 'status', label: 'Statut', sortKey: 'status' },
  { key: 'pillar', label: 'Pilier', sortKey: 'pillar' },
  { key: 'scheduledDate', label: 'Date planifiée', sortKey: 'scheduledDate' },
  { key: 'checklist', label: 'Checklist' },
  { key: 'actions', label: '' },
];

function SortButton({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={cx(
        'inline-flex items-center gap-1 font-semibold uppercase tracking-wider transition hover:text-ink',
        activeKey === sortKey ? 'text-accent' : 'text-muted',
        className,
      )}
    >
      {label}
      <ArrowUpDown size={11} className={activeKey === sortKey && direction === 'desc' ? 'rotate-180' : ''} />
    </button>
  );
}

export default function TableView({ onOpen, onCreate }: TableViewProps) {
  const { items, updateItem, deleteItem } = useEditorial();
  const [platform, setPlatform] = useState<'all' | Platform>('all');
  const [status, setStatus] = useState<'all' | Status>('all');
  const [pillar, setPillar] = useState<'all' | Pillar>('all');
  const [format, setFormat] = useState<'all' | Format>('all');
  const [month, setMonth] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'scheduledDate',
    direction: 'asc',
  });
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const toggleSort = (key: SortKey) => {
    setSort((previous) =>
      previous.key === key
        ? { key, direction: previous.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    );
  };

  const hasFilters =
    platform !== 'all' ||
    status !== 'all' ||
    pillar !== 'all' ||
    format !== 'all' ||
    month !== '' ||
    query.trim() !== '';

  const resetFilters = () => {
    setPlatform('all');
    setStatus('all');
    setPillar('all');
    setFormat('all');
    setMonth('');
    setQuery('');
  };

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    const list = items.filter((item) => {
      if (platform !== 'all' && item.platform !== platform) return false;
      if (status !== 'all' && item.status !== status) return false;
      if (pillar !== 'all' && item.pillar !== pillar) return false;
      if (format !== 'all' && item.format !== format) return false;
      if (month && (!item.scheduledDate || monthKeyOf(item.scheduledDate) !== month)) return false;
      if (search) {
        const haystack = [item.title, item.content, item.assignee, item.tags.join(' ')]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });

    const factor = sort.direction === 'asc' ? 1 : -1;
    return list.sort((a, b) => {
      switch (sort.key) {
        case 'title':
          return (a.title || 'Sans titre').localeCompare(b.title || 'Sans titre', 'fr') * factor;
        case 'platform':
          return a.platform.localeCompare(b.platform, 'fr') * factor;
        case 'status':
          return (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) * factor;
        case 'pillar':
          return a.pillar.localeCompare(b.pillar, 'fr') * factor;
        default:
          return (parseTime(a.scheduledDate) - parseTime(b.scheduledDate)) * factor;
      }
    });
  }, [items, platform, status, pillar, format, month, query, sort]);

  const selectClass = 'field-sm w-full max-w-[190px]';

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              className="field pl-8"
              placeholder="Rechercher un titre, un tag, un auteur…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <Filter size={13} /> Filtres
          </span>
          <select
            className={selectClass}
            value={platform}
            onChange={(event) => setPlatform(event.target.value as 'all' | Platform)}
            aria-label="Filtrer par plateforme"
          >
            <option value="all">Toutes les plateformes</option>
            {PLATFORMS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={status}
            onChange={(event) => setStatus(event.target.value as 'all' | Status)}
            aria-label="Filtrer par statut"
          >
            <option value="all">Tous les statuts</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={pillar}
            onChange={(event) => setPillar(event.target.value as 'all' | Pillar)}
            aria-label="Filtrer par pilier"
          >
            <option value="all">Tous les piliers</option>
            {PILLARS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={format}
            onChange={(event) => setFormat(event.target.value as 'all' | Format)}
            aria-label="Filtrer par format"
          >
            <option value="all">Tous les formats</option>
            {FORMATS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <input
            type="month"
            className={selectClass}
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            aria-label="Filtrer par mois"
          />
          {hasFilters && (
            <button type="button" className="btn-ghost !px-2.5 !py-1.5 text-xs" onClick={resetFilters}>
              <X size={13} />
              Réinitialiser
            </button>
          )}
          <button type="button" className="btn-primary ml-auto !px-3 !py-1.5 text-xs" onClick={onCreate}>
            <Plus size={14} />
            Nouveau
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted">
          {filtered.length} contenu{filtered.length > 1 ? 's' : ''} affiché
          {filtered.length > 1 ? 's' : ''} sur {items.length}
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-raised/60 text-[10px] uppercase">
                {COLUMNS.map((column) => (
                  <th key={column.key} className={cx('whitespace-nowrap px-3 py-2.5', column.className)}>
                    {column.sortKey ? (
                      <SortButton
                        label={column.label}
                        sortKey={column.sortKey}
                        activeKey={sort.key}
                        direction={sort.direction}
                        onSort={toggleSort}
                      />
                    ) : (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                        {column.label}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const done = item.checklist.filter((task) => task.done).length;
                return (
                  <tr
                    key={item.id}
                    className="border-b border-line/70 transition last:border-b-0 hover:bg-raised/50"
                  >
                    <td className="max-w-[340px] px-3 py-2.5">
                      <button
                        type="button"
                        className="block w-full truncate text-left font-semibold text-ink hover:text-accent"
                        onClick={() => onOpen(item.id)}
                        title={item.title || 'Sans titre'}
                      >
                        {item.title || 'Sans titre'}
                      </button>
                      <div className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-muted">
                        {item.assignee && <span className="truncate">{item.assignee}</span>}
                        {item.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="rounded bg-raised px-1 py-0.5 text-[10px] text-muted">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <PlatformBadge platform={item.platform} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted">{item.format}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <select
                        className="field-sm max-w-[168px]"
                        value={item.status}
                        onChange={(event) =>
                          updateItem(item.id, { status: event.target.value as Status })
                        }
                        aria-label={`Statut de ${item.title || 'ce contenu'}`}
                      >
                        {STATUSES.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <PillarBadge pillar={item.pillar} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs tabular-nums text-muted">
                      {item.scheduledDate ? (
                        <>
                          <span className="font-medium text-ink">
                            {formatDayMonth(item.scheduledDate)}
                          </span>{' '}
                          · {formatTime(item.scheduledDate)}
                        </>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">Non planifié</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="w-[110px]">
                        <ChecklistProgress done={done} total={item.checklist.length} />
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => onOpen(item.id)}
                          title="Ouvrir l'éditeur"
                        >
                          <Pencil size={14} />
                        </button>
                        {confirmId === item.id ? (
                          <button
                            type="button"
                            className="rounded-md px-1.5 py-1 text-[11px] font-semibold text-rose-500 hover:bg-rose-500/10"
                            onClick={() => {
                              deleteItem(item.id);
                              setConfirmId(null);
                            }}
                          >
                            Confirmer
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="icon-btn hover:text-rose-500"
                            onClick={() => setConfirmId(item.id)}
                            title="Supprimer"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
            <p className="text-sm font-medium text-ink">Aucun contenu ne correspond aux filtres</p>
            <p className="text-xs text-muted">
              Ajustez les filtres ou créez un nouveau contenu pour compléter votre calendrier.
            </p>
            <button type="button" className="btn-ghost mt-1" onClick={resetFilters}>
              Réinitialiser les filtres
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

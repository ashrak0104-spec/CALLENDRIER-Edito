import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { PLATFORM_META } from '../constants';
import { PillarBadge, PlatformBadge } from '../components/Badges';
import {
  addDays,
  addMonths,
  formatMonthYear,
  formatTime,
  formatWeekRange,
  fromDateKey,
  isSameDay,
  isSameMonth,
  mergeDayWithTime,
  monthGrid,
  startOfWeek,
  toDateKey,
  weekDays,
  WEEKDAYS_LONG,
  WEEKDAYS_SHORT,
} from '../lib/dates';
import { useCardSensors, useDragClickGuard } from '../lib/drag';
import { cx } from '../lib/utils';
import { useEditorial } from '../store/editorial';
import type { PostItem } from '../types';

interface CalendarViewProps {
  onOpen: (id: string) => void;
  onCreate: (date: Date) => void;
}

function groupByDay(items: PostItem[]): Map<string, PostItem[]> {
  const map = new Map<string, PostItem[]>();
  for (const item of items) {
    if (!item.scheduledDate) continue;
    const date = new Date(item.scheduledDate);
    if (Number.isNaN(date.getTime())) continue;
    const key = toDateKey(date);
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  for (const list of map.values()) {
    list.sort(
      (a, b) =>
        new Date(a.scheduledDate ?? 0).getTime() - new Date(b.scheduledDate ?? 0).getTime(),
    );
  }
  return map;
}

function PostChip({ item, onOpen }: { item: PostItem; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `item:${item.id}`,
    data: { itemId: item.id },
  });
  const { pointerHandlers, handleClick } = useDragClickGuard();

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      {...pointerHandlers}
      role="button"
      tabIndex={0}
      onClick={(event) => handleClick(event, () => onOpen(item.id))}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpen(item.id);
      }}
      title={`${item.title || 'Sans titre'} · ${item.platform}`}
      className={cx(
        'w-full cursor-grab touch-none truncate rounded-md border border-line border-l-[3px] bg-raised px-1.5 py-1 text-left text-[11px] font-medium leading-tight text-ink transition hover:bg-accent-soft active:cursor-grabbing',
        isDragging && 'opacity-30',
      )}
      style={{
        transform: CSS.Translate.toString(transform),
        borderLeftColor: PLATFORM_META[item.platform].color,
      }}
    >
      <span className="tabular-nums text-muted">
        {item.scheduledDate ? formatTime(item.scheduledDate) : '--:--'}
      </span>
      <span className="mx-1 text-muted">·</span>
      {item.title || 'Sans titre'}
    </div>
  );
}

function DayCell({
  day,
  items,
  isOutside,
  onOpen,
  onCreate,
}: {
  day: Date;
  items: PostItem[];
  isOutside: boolean;
  onOpen: (id: string) => void;
  onCreate: (date: Date) => void;
}) {
  const key = toDateKey(day);
  const { setNodeRef, isOver } = useDroppable({ id: `day:${key}` });
  const isToday = isSameDay(day, new Date());
  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
  const hidden = Math.max(0, items.length - 3);
  const isEmpty = items.length === 0 && !isOutside;

  return (
    <div
      ref={setNodeRef}
      className={cx(
        'group relative flex min-h-[128px] flex-col gap-1 border-b border-r border-line p-1.5 transition',
        isOutside ? 'bg-raised/40 text-muted/50' : 'bg-surface',
        isWeekend && !isOutside && 'bg-raised/30',
        isEmpty && 'bg-amber-500/[0.035]',
        isOver && 'bg-accent/10 ring-2 ring-inset ring-accent/60',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className={cx(
              'flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums',
              isToday ? 'bg-accent text-white dark:text-slate-950' : 'text-muted',
            )}
          >
            {day.getDate()}
          </span>
          {isEmpty && (
            <span
              className="h-1.5 w-1.5 rounded-full bg-amber-400/80"
              title="Aucun contenu planifié"
            />
          )}
        </div>
        <button
          type="button"
          onClick={() => onCreate(day)}
          className="icon-btn h-5 w-5 rounded-md opacity-0 transition focus-visible:opacity-100 group-hover:opacity-100"
          title="Ajouter un contenu à cette date"
          aria-label={`Ajouter un contenu le ${day.getDate()}`}
        >
          <Plus size={13} />
        </button>
      </div>

      <div className="flex flex-col gap-1">
        {items.slice(0, 3).map((item) => (
          <PostChip key={item.id} item={item} onOpen={onOpen} />
        ))}
        {hidden > 0 && (
          <span className="pl-1 text-[10px] font-medium text-muted">+{hidden} autre{hidden > 1 ? 's' : ''}</span>
        )}
      </div>
    </div>
  );
}

function WeekColumn({
  day,
  items,
  onOpen,
  onCreate,
}: {
  day: Date;
  items: PostItem[];
  onOpen: (id: string) => void;
  onCreate: (date: Date) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${toDateKey(day)}` });
  const isToday = isSameDay(day, new Date());

  return (
    <div
      ref={setNodeRef}
      className={cx(
        'flex min-h-[420px] min-w-0 flex-col rounded-xl border border-line bg-surface transition',
        isOver && 'bg-accent/5 ring-2 ring-accent/50',
      )}
    >
      <div
        className={cx(
          'flex items-center justify-between rounded-t-xl border-b border-line px-2.5 py-2',
          isToday ? 'bg-accent-soft' : 'bg-raised/50',
        )}
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            {WEEKDAYS_LONG[(day.getDay() + 6) % 7]}
          </p>
          <p className={cx('text-sm font-bold', isToday && 'text-accent')}>{day.getDate()}</p>
        </div>
        <button
          type="button"
          className="icon-btn h-6 w-6"
          onClick={() => onCreate(day)}
          title="Ajouter un contenu"
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-1.5">
        {items.map((item) => (
          <PostChip key={item.id} item={item} onOpen={onOpen} />
        ))}
        {items.length === 0 && (
          <button
            type="button"
            onClick={() => onCreate(day)}
            className="flex flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-[10px] text-muted transition hover:border-amber-400/60 hover:text-amber-600"
          >
            <AlertTriangle size={13} />
            Aucun contenu
          </button>
        )}
      </div>
    </div>
  );
}

export default function CalendarView({ onOpen, onCreate }: CalendarViewProps) {
  const { items, updateItem } = useEditorial();
  const [mode, setMode] = useState<'month' | 'week'>('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useCardSensors();

  const grouped = useMemo(() => groupByDay(items), [items]);
  const grid = useMemo(() => monthGrid(cursor), [cursor]);
  const week = useMemo(() => weekDays(cursor), [cursor]);

  const monthItems = items.filter(
    (item) => item.scheduledDate && isSameMonth(new Date(item.scheduledDate), cursor),
  );
  const emptyDays = grid.filter(
    (day) => isSameMonth(day, cursor) && (grouped.get(toDateKey(day))?.length ?? 0) === 0,
  ).length;
  const unscheduled = items.filter((item) => !item.scheduledDate).length;
  const activeItem = items.find((item) => item.id === activeId) ?? null;

  const shift = (direction: -1 | 1) => {
    setCursor((previous) =>
      mode === 'month'
        ? addMonths(previous, direction)
        : addDays(startOfWeek(previous), direction * 7),
    );
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id).replace('item:', ''));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const target = event.over?.id;
    const itemId = String(event.active.id).replace('item:', '');
    if (typeof target !== 'string' || !target.startsWith('day:')) return;
    const source = items.find((item) => item.id === itemId);
    if (!source) return;
    const day = fromDateKey(target.slice(4));
    const next = mergeDayWithTime(source.scheduledDate, day);
    if (source.scheduledDate === next) return;
    updateItem(itemId, { scheduledDate: next });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1 shadow-sm">
          <button type="button" className="icon-btn" onClick={() => shift(-1)} aria-label="Période précédente">
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className="min-w-[170px] px-2 text-center text-sm font-semibold"
            onClick={() => setCursor(new Date())}
            title="Revenir à aujourd'hui"
          >
            {mode === 'month' ? formatMonthYear(cursor) : formatWeekRange(cursor)}
          </button>
          <button type="button" className="icon-btn" onClick={() => shift(1)} aria-label="Période suivante">
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex rounded-xl border border-line bg-surface p-1 shadow-sm">
          {(['month', 'week'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={cx(
                'rounded-lg px-3 py-1 text-xs font-semibold transition',
                mode === value
                  ? 'bg-accent text-white dark:text-slate-950'
                  : 'text-muted hover:text-ink',
              )}
            >
              {value === 'month' ? 'Mensuel' : 'Hebdomadaire'}
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 font-medium text-muted">
            {monthItems.length} contenu{monthItems.length > 1 ? 's' : ''} ce mois
          </span>
          <span
            className={cx(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium',
              emptyDays > 0
                ? 'border-amber-400/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
            )}
            title="Jours du mois sans aucun contenu planifié"
          >
            <AlertTriangle size={12} />
            {emptyDays} jour{emptyDays > 1 ? 's' : ''} sans contenu
          </span>
          {unscheduled > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 font-medium text-muted">
              {unscheduled} non planifié{unscheduled > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        {mode === 'month' ? (
          <div className="card overflow-hidden">
            <div className="grid grid-cols-7 border-b border-line bg-raised/60">
              {WEEKDAYS_SHORT.map((label) => (
                <div
                  key={label}
                  className="px-2.5 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted"
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {grid.map((day) => (
                <DayCell
                  key={toDateKey(day)}
                  day={day}
                  items={grouped.get(toDateKey(day)) ?? []}
                  isOutside={!isSameMonth(day, cursor)}
                  onOpen={onOpen}
                  onCreate={onCreate}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {week.map((day) => (
              <WeekColumn
                key={toDateKey(day)}
                day={day}
                items={grouped.get(toDateKey(day)) ?? []}
                onOpen={onOpen}
                onCreate={onCreate}
              />
            ))}
          </div>
        )}

        <DragOverlay dropAnimation={null}>
          {activeItem ? (
            <div className="w-[240px] rotate-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-xs font-medium shadow-pop">
              <div className="mb-1 flex items-center gap-2">
                <PlatformBadge platform={activeItem.platform} />
                <PillarBadge pillar={activeItem.pillar} />
              </div>
              <p className="truncate">{activeItem.title || 'Sans titre'}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

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
import { CalendarClock, Plus } from 'lucide-react';
import { ChecklistProgress, PillarBadge, PlatformBadge } from '../components/Badges';
import { STATUSES, STATUS_META } from '../constants';
import { formatDayMonth, formatTime } from '../lib/dates';
import { useCardSensors, useDragClickGuard } from '../lib/drag';
import { bySchedule, cx } from '../lib/utils';
import { useEditorial } from '../store/editorial';
import type { PostItem, Status } from '../types';

interface KanbanViewProps {
  onOpen: (id: string) => void;
  onCreate: () => void;
}

function KanbanCard({
  item,
  onOpen,
  overlay = false,
}: {
  item: PostItem;
  onOpen?: (id: string) => void;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `item:${item.id}`,
    data: { itemId: item.id },
    disabled: overlay,
  });
  const { pointerHandlers, handleClick } = useDragClickGuard();
  const done = item.checklist.filter((task) => task.done).length;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      {...pointerHandlers}
      role="button"
      tabIndex={overlay ? -1 : 0}
      onClick={(event) => handleClick(event, () => onOpen?.(item.id))}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onOpen?.(item.id);
      }}
      className={cx(
        'group cursor-grab rounded-xl border border-line bg-surface p-2.5 shadow-sm transition hover:border-accent/50 hover:shadow-md active:cursor-grabbing',
        isDragging && 'opacity-30',
        overlay && 'rotate-1 cursor-grabbing shadow-pop',
      )}
      style={{ transform: CSS.Translate.toString(transform) }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-ink">
          {item.title || 'Sans titre'}
        </p>
        <PlatformBadge platform={item.platform} />
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        <PillarBadge pillar={item.pillar} />
        <span className="inline-flex items-center gap-1 rounded-full border border-line px-1.5 py-0.5 text-[10px] font-medium text-muted">
          {item.format}
        </span>
      </div>

      <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted">
        <CalendarClock size={12} />
        {item.scheduledDate
          ? `${formatDayMonth(item.scheduledDate)} · ${formatTime(item.scheduledDate)}`
          : 'Non planifié'}
      </div>

      {item.checklist.length > 0 ? (
        <ChecklistProgress done={done} total={item.checklist.length} />
      ) : (
        <p className="text-[10px] text-muted/70">Aucune sous-tâche</p>
      )}
    </div>
  );
}

function KanbanColumn({
  status,
  items,
  onOpen,
  onCreate,
}: {
  status: Status;
  items: PostItem[];
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `status:${status}` });
  const meta = STATUS_META[status];

  return (
    <div
      ref={setNodeRef}
      className={cx(
        'flex w-[272px] shrink-0 flex-col rounded-2xl border border-line bg-raised/40 transition',
        isOver && 'border-accent/50 bg-accent/5 ring-2 ring-accent/30',
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
          <p className="truncate text-xs font-bold text-ink">{status}</p>
        </div>
        <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted">
          {items.length}
        </span>
      </div>
      <p className="px-3 pb-2 text-[10px] leading-snug text-muted/80">{meta.hint}</p>

      <div className="flex min-h-[140px] flex-1 flex-col gap-2 px-2 pb-2">
        {items.map((item) => (
          <KanbanCard key={item.id} item={item} onOpen={onOpen} />
        ))}
        {items.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-line px-3 py-6 text-center text-[11px] text-muted">
            Glissez un contenu ici
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onCreate}
        className="mx-2 mb-2 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-line py-1.5 text-[11px] font-medium text-muted transition hover:border-accent/50 hover:text-accent"
      >
        <Plus size={13} />
        Ajouter
      </button>
    </div>
  );
}

export default function KanbanView({ onOpen, onCreate }: KanbanViewProps) {
  const { items, updateItem } = useEditorial();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useCardSensors();

  const columns = useMemo(
    () =>
      STATUSES.map((status) => ({
        status,
        items: items.filter((item) => item.status === status).sort(bySchedule),
      })),
    [items],
  );

  const activeItem = items.find((item) => item.id === activeId) ?? null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id).replace('item:', ''));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const overId = event.over?.id;
    const itemId = String(event.active.id).replace('item:', '');
    if (typeof overId !== 'string' || !overId.startsWith('status:')) return;
    const nextStatus = overId.slice('status:'.length) as Status;
    const item = items.find((entry) => entry.id === itemId);
    if (!item || item.status === nextStatus) return;
    updateItem(itemId, { status: nextStatus });
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-3">
        {columns.map((column) => (
          <KanbanColumn
            key={column.status}
            status={column.status}
            items={column.items}
            onOpen={onOpen}
            onCreate={onCreate}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeItem ? <div className="w-[260px]"><KanbanCard item={activeItem} overlay /></div> : null}
      </DragOverlay>
    </DndContext>
  );
}

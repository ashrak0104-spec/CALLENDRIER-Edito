import { PILLAR_META, PLATFORM_META, STATUS_META } from '../constants';
import { cx, percent } from '../lib/utils';
import type { Pillar, Platform, Status } from '../types';

export function PillarBadge({ pillar, className }: { pillar: Pillar; className?: string }) {
  const meta = PILLAR_META[pillar];
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        className,
      )}
      style={{
        color: meta.color,
        borderColor: `${meta.color}44`,
        backgroundColor: `${meta.color}14`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {pillar}
    </span>
  );
}

export function PlatformBadge({ platform, className }: { platform: Platform; className?: string }) {
  const meta = PLATFORM_META[platform];
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-md border border-line bg-raised px-1.5 py-0.5 text-[11px] font-semibold text-ink',
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.short}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        className,
      )}
      style={{
        color: meta.color,
        borderColor: `${meta.color}55`,
        backgroundColor: `${meta.color}16`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {status}
    </span>
  );
}

export function ChecklistProgress({
  done,
  total,
  className,
}: {
  done: number;
  total: number;
  className?: string;
}) {
  const ratio = percent(done, total);
  return (
    <div className={cx('flex items-center gap-2', className)}>
      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-line">
        <div
          className={cx('h-full rounded-full transition-all', ratio === 100 ? 'bg-emerald-500' : 'bg-accent')}
          style={{ width: `${ratio}%` }}
        />
      </div>
      <span className="shrink-0 text-[10px] font-semibold tabular-nums text-muted">
        {done}/{total}
      </span>
    </div>
  );
}

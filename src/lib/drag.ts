import {
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { PointerSensor, useSensor, useSensors } from '@dnd-kit/core';

/** Movement (px) needed before dnd-kit starts a drag instead of a click. */
const DRAG_THRESHOLD = 6;

export function useCardSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_THRESHOLD } }),
  );
}

/**
 * A drop makes the browser fire a click on the card, which would open the
 * editor. Compare the click position with the pointer-down position of the
 * same gesture: past the drag threshold it was a drag, not a click.
 */
export function useDragClickGuard() {
  const origin = useRef<{ x: number; y: number } | null>(null);

  return {
    pointerHandlers: {
      onPointerDownCapture: (event: ReactPointerEvent<HTMLElement>) => {
        origin.current = { x: event.clientX, y: event.clientY };
      },
    },
    handleClick: (event: ReactMouseEvent<HTMLElement>, action: () => void) => {
      const start = origin.current;
      origin.current = null;
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) >= DRAG_THRESHOLD) {
        return;
      }
      action();
    },
  };
}

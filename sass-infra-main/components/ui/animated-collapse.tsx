'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedCollapseProps {
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
}

/** Matches the `duration-300` transition below, plus a little slack. */
const CLOSE_ANIMATION_MS = 320;

export function AnimatedCollapse({
  isOpen,
  children,
  className,
}: AnimatedCollapseProps) {
  // Children are unmounted while closed, and kept mounted through the closing
  // animation.
  const [shouldRender, setShouldRender] = useState(isOpen);
  // Drives the transition. Distinct from `isOpen` because opening has to happen
  // in two steps: mount collapsed, then expand on a later frame. A CSS
  // transition needs a starting value that the browser has already rendered —
  // mounting straight into `1fr` gives it nothing to animate from, which is why
  // only the close used to animate.
  const [expanded, setExpanded] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // Two frames: the first lets React commit the collapsed DOM, the second
      // flips it open. One frame can be batched into the same paint.
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setExpanded(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }

    setExpanded(false);
    const timer = setTimeout(() => setShouldRender(false), CLOSE_ANIMATION_MS);
    return () => clearTimeout(timer);
  }, [isOpen]);

  if (!shouldRender && !isOpen) return null;

  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows] duration-300 ease-out',
        className
      )}
      style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

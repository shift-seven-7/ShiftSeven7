'use client';

import { Draggable, Droppable } from '@hello-pangea/dnd';
import { cn } from '@/lib/utils';
import type { Shift7Category, ShiftTemplateRow } from '@/types/database.types';

const CATEGORY_STYLES: Record<Shift7Category, string> = {
  morning:
    'bg-amber-50 border-amber-300 text-amber-900 shadow-amber-100 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200',
  afternoon:
    'bg-blue-50 border-blue-300 text-blue-900 shadow-blue-100 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-200',
  night:
    'bg-violet-50 border-violet-300 text-violet-900 shadow-violet-100 dark:bg-violet-950/40 dark:border-violet-800 dark:text-violet-200',
};
const CATEGORY_LABELS: Record<Shift7Category, string> = { morning: 'בוקר', afternoon: 'צהריים', night: 'לילה' };
const CATEGORY_DOT: Record<Shift7Category, string> = {
  morning: 'bg-amber-400',
  afternoon: 'bg-blue-400',
  night: 'bg-violet-400',
};
const CATEGORY_ORDER: Shift7Category[] = ['morning', 'afternoon', 'night'];

interface ShiftCardsPanelProps {
  templates: ShiftTemplateRow[];
  hasControlRoom: boolean;
}

/** Draggable shift-template palette — drag a card onto a WeeklyMatrix cell to schedule it. */
export function ShiftCardsPanel({ templates, hasControlRoom }: ShiftCardsPanelProps) {
  const flat = templates.filter((t) => hasControlRoom || t.applicable_roles.includes('guard'));
  const grouped = CATEGORY_ORDER.reduce<Partial<Record<Shift7Category, ShiftTemplateRow[]>>>((acc, cat) => {
    const items = flat.filter((t) => t.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  return (
    <div className="flex w-48 shrink-0 flex-col overflow-hidden">
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="shrink-0 border-b border-border bg-muted/30 px-3 py-3">
          <p className="text-xs font-bold uppercase tracking-wider">תבניות משמרת</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">גרור לתא בטבלה לשיבוץ</p>
        </div>

        <Droppable droppableId="panel" isDropDisabled>
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="flex-1 space-y-4 overflow-y-auto p-2"
            >
              {(Object.entries(grouped) as [Shift7Category, ShiftTemplateRow[]][]).map(([cat, items]) => (
                <div key={cat}>
                  <div className="mb-2 flex items-center gap-1.5 px-1">
                    <div className={cn('h-2 w-2 shrink-0 rounded-full', CATEGORY_DOT[cat])} />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {CATEGORY_LABELS[cat]}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {items.map((t) => {
                      const idx = flat.findIndex((f) => f.id === t.id);
                      return (
                        <Draggable key={t.id} draggableId={`tpl-${t.id}`} index={idx}>
                          {(dragProvided, snapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className={cn(
                                'flex cursor-grab select-none items-center gap-2 rounded-lg border px-2 py-2 shadow-sm transition-all active:cursor-grabbing',
                                CATEGORY_STYLES[cat],
                                snapshot.isDragging && 'z-50 scale-105 rotate-1 opacity-90 shadow-xl'
                              )}
                            >
                              <span className="w-7 shrink-0 text-center text-lg font-black leading-none">
                                {t.code}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-[11px] font-bold leading-tight">{t.name}</p>
                                <p className="mt-0.5 text-[10px] opacity-60">
                                  {t.start_time.slice(0, 5)}–{t.end_time.slice(0, 5)}
                                </p>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                  </div>
                </div>
              ))}
              {provided.placeholder}
              {flat.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">אין תבניות</p>}
            </div>
          )}
        </Droppable>
      </div>
    </div>
  );
}

import { Droppable, Draggable } from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";

const CATEGORY_STYLES = {
  morning: "bg-amber-50 border-amber-300 text-amber-900 shadow-amber-100",
  afternoon: "bg-blue-50 border-blue-300 text-blue-900 shadow-blue-100",
  night: "bg-violet-50 border-violet-300 text-violet-900 shadow-violet-100"
};
const CATEGORY_LABELS = { morning: "בוקר", afternoon: "צהריים", night: "לילה" };
const CATEGORY_DOT = { morning: "bg-amber-400", afternoon: "bg-blue-400", night: "bg-violet-400" };
const CATEGORY_ORDER = ["morning", "afternoon", "night"];

export default function ShiftCardsPanel({ templates, hasControlRoom }) {
  const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
    const items = templates.filter(t => {
      if (!hasControlRoom && !(t.applicable_roles || []).includes("guard")) return false;
      return t.category === cat;
    });
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  const flat = templates.filter(t => hasControlRoom || (t.applicable_roles || []).includes("guard"));

  return (
    <div className="w-48 shrink-0 flex flex-col overflow-hidden">
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
        <div className="px-3 py-3 border-b border-border bg-muted/30 shrink-0">
          <p className="text-xs font-bold uppercase tracking-wider">תבניות משמרת</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">גרור לתא בטבלה לשיבוץ</p>
        </div>

        <Droppable droppableId="panel" isDropDisabled={true}>
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="flex-1 overflow-y-auto p-2 space-y-4"
            >
              {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat}>
                  <div className="flex items-center gap-1.5 px-1 mb-2">
                    <div className={cn("w-2 h-2 rounded-full shrink-0", CATEGORY_DOT[cat])} />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {CATEGORY_LABELS[cat]}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {items.map(t => {
                      const idx = flat.findIndex(f => f.id === t.id);
                      const style = CATEGORY_STYLES[cat] || "bg-gray-50 border-gray-200 text-gray-800";
                      return (
                        <Draggable key={t.id} draggableId={`tpl-${t.id}`} index={idx}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={cn(
                                "flex items-center gap-2 px-2 py-2 rounded-lg border cursor-grab active:cursor-grabbing select-none transition-all shadow-sm",
                                style,
                                snapshot.isDragging && "shadow-xl scale-105 rotate-1 opacity-90 z-50"
                              )}
                            >
                              <span className="text-lg font-black leading-none w-7 text-center shrink-0">{t.code}</span>
                              <div className="min-w-0">
                                <p className="text-[11px] font-bold leading-tight truncate">{t.name}</p>
                                <p className="text-[10px] opacity-60 mt-0.5">{t.start_time}–{t.end_time}</p>
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
              {flat.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">אין תבניות</p>
              )}
            </div>
          )}
        </Droppable>
      </div>
    </div>
  );
}
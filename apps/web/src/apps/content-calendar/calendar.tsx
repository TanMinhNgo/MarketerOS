"use client";

import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, pointerWithin, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import type { ContentResponse } from "@marketos/shared";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api-client";
import { mergeById, schedulePatch, type ContentStatus } from "@/lib/calendar-api";
import { addDays, addMonths, groupByDay, monthGrid, moveToDay, toKey, weekDays } from "@/lib/calendar-utils";
import { notify } from "@/lib/notify/notify";
import { cn } from "@/lib/utils";
import { CHANNELS } from "../content-studio/channels";
import { channelColor } from "./channel-colors";
import { ChipPreview, ItemChip } from "./item-chip";
import { ItemDialog } from "./item-dialog";
import { useCalendarRange, useReschedule, useUnscheduled } from "./use-calendar";

type View = "month" | "week";
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const rangeLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

function DayCell({ day, inMonth, today, items, view, onOpen }: { day: Date; inMonth: boolean; today: boolean; items: ContentResponse[]; view: View; onOpen: (i: ContentResponse) => void }) {
  const key = toKey(day);
  const { setNodeRef, isOver } = useDroppable({ id: `day:${key}` });
  const shown = view === "month" ? items.slice(0, 3) : items;
  return (
    <div
      ref={setNodeRef}
      role="gridcell"
      aria-label={`${day.toDateString()}, ${items.length} item${items.length === 1 ? "" : "s"}`}
      className={cn("flex min-h-0 flex-col gap-1 border-b border-r p-1.5 transition-colors", !inMonth && "bg-muted/30 text-muted-foreground", isOver && "bg-primary/15 ring-2 ring-inset ring-primary")}
    >
      <span className={cn("grid size-6 place-items-center self-end rounded-full text-xs font-semibold", today && "bg-primary text-primary-foreground")}>{day.getDate()}</span>
      <div className="flex min-h-0 flex-col gap-1 overflow-hidden">
        {shown.map((i) => <ItemChip key={i.id} item={i} onOpen={onOpen} compact={view === "month"} />)}
        {view === "month" && items.length > shown.length && <span className="px-1 text-[10px] font-semibold text-muted-foreground">+{items.length - shown.length} more</span>}
      </div>
    </div>
  );
}

function Sidebar({ items, onOpen }: { items: ContentResponse[]; onOpen: (i: ContentResponse) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: "unscheduled" });
  return (
    <aside ref={setNodeRef} aria-label="Unscheduled drafts" className={cn("flex min-h-0 flex-col rounded-2xl border-2 p-3 transition-colors", isOver ? "border-primary bg-primary/10" : "border-[#3B2A4A]/30")}>
      <h3 className="font-display text-sm font-bold">Unscheduled</h3>
      <p className="mb-2 text-xs text-muted-foreground">Drag approved content onto a day. Drop here to unschedule.</p>
      <div className="flex min-h-0 flex-col gap-1.5 overflow-y-auto">
        {items.length === 0 && <p className="text-xs text-muted-foreground">Nothing waiting. Create and approve content in Content Studio.</p>}
        {items.map((i) => <ItemChip key={i.id} item={i} onOpen={onOpen} />)}
      </div>
    </aside>
  );
}

export function Calendar({ projectId }: { projectId: string }) {
  const reschedule = useReschedule(projectId);
  const [view, setView] = useState<View>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [dragging, setDragging] = useState<ContentResponse | null>(null);
  const [selected, setSelected] = useState<ContentResponse | null>(null);

  const days = useMemo(() => (view === "month" ? monthGrid(anchor.getFullYear(), anchor.getMonth()) : weekDays(anchor)), [view, anchor]);
  const range = useCalendarRange(projectId, days[0], addDays(days[days.length - 1], 1));
  const pool = useUnscheduled(projectId);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  // Gộp hai danh sách: đổi lịch optimistic ở danh sách nào thì mục cũng hiện đúng chỗ (ô ngày hay cột Unscheduled).
  const items = useMemo(() => mergeById(range.data, pool.data), [range.data, pool.data]);
  const byDay = useMemo(() => groupByDay(items), [items]);
  const unscheduled = useMemo(() => items.filter((i) => !i.scheduledAt), [items]);
  const isPending = range.isPending || pool.isPending;
  const error = range.error ?? pool.error;
  const refetch = () => Promise.all([range.refetch(), pool.refetch()]);
  const todayKey = toKey(new Date());

  /** Áp luật duyệt trước khi gửi: bài chưa duyệt không lên lịch được. */
  const move = (item: ContentResponse, status: ContentStatus, scheduledAt: string | null) => {
    const patch = schedulePatch(item, status, scheduledAt);
    if (typeof patch === "string") return notify.error(patch, { description: "Approve it in Content Studio or from its details." });
    if (patch) reschedule.mutate({ id: item.id, patch });
  };

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const item = items.find((i) => i.id === e.active.id);
    const over = e.over?.id;
    if (!item || typeof over !== "string") return;
    if (over === "unscheduled") {
      move(item, item.status === "DRAFT" ? "DRAFT" : "READY", null);
    } else if (over.startsWith("day:")) {
      move(item, item.status === "READY" ? "SCHEDULED" : item.status, moveToDay(item.scheduledAt, over.slice(4)));
    }
  };

  const step = (dir: -1 | 1) => setAnchor((a) => (view === "month" ? addMonths(a, dir) : addDays(a, 7 * dir)));
  const title = view === "month" ? monthLabel.format(anchor) : `${rangeLabel.format(days[0])} – ${rangeLabel.format(days[6])}, ${days[6].getFullYear()}`;

  if (isPending) return <p role="status" className="p-6 text-sm text-muted-foreground">Loading calendar…</p>;
  if (error)
    return (
      <div className="grid h-full place-items-center p-6 text-center text-sm">
        <div>
          <p>{errorMessage(error)}</p>
          <Button className="mt-3" variant="outline" onClick={() => refetch()}>Try again</Button>
        </div>
      </div>
    );

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={(e: DragStartEvent) => setDragging(items.find((i) => i.id === e.active.id) ?? null)} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className="@container flex h-full min-h-0 flex-col">
        <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
          <CalendarDays className="size-4 text-primary" aria-hidden="true" />
          <h2 className="font-display text-base font-bold">{title}</h2>
          <div className="flex-1" />
          <div role="group" aria-label="Change period" className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" aria-label="Previous" onClick={() => step(-1)}><ChevronLeft /></Button>
            <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>Today</Button>
            <Button variant="outline" size="icon-sm" aria-label="Next" onClick={() => step(1)}><ChevronRight /></Button>
          </div>
          <div role="group" aria-label="View" className="flex overflow-hidden rounded-md border">
            {(["month", "week"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={cn("px-3 py-1 text-xs font-semibold capitalize", view === v ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
                {v}
              </button>
            ))}
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-3 p-3 @3xl:grid-cols-[200px_minmax(0,1fr)]">
          <Sidebar items={unscheduled} onOpen={setSelected} />
          <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border">
            <div role="row" className="grid grid-cols-7 border-b bg-muted/40 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {WEEKDAYS.map((d) => <div key={d} role="columnheader" className="py-1.5">{d}</div>)}
            </div>
            <div role="grid" aria-label={title} className={cn("grid min-h-0 flex-1 grid-cols-7 overflow-y-auto", view === "month" ? "auto-rows-fr" : "auto-rows-[minmax(280px,1fr)]")}>
              {days.map((d) => (
                <DayCell key={toKey(d)} day={d} inMonth={view === "week" || d.getMonth() === anchor.getMonth()} today={toKey(d) === todayKey} items={byDay.get(toKey(d)) ?? []} view={view} onOpen={setSelected} />
              ))}
            </div>
          </div>
        </div>

        <footer aria-label="Legend" className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2 text-xs">
          {CHANNELS.map((c) => (
            <span key={c.value} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ background: channelColor(c.value) }} aria-hidden="true" />
              {c.label}
            </span>
          ))}
        </footer>
      </div>

      {/* Cửa sổ dùng transform/backdrop-filter nên `position: fixed` bên trong bị lệch theo cửa sổ: render ra body. */}
      {typeof document !== "undefined" && createPortal(<DragOverlay zIndex={9999} dropAnimation={null}>{dragging && <ChipPreview item={dragging} />}</DragOverlay>, document.body)}
      {selected && <ItemDialog key={selected.id} item={selected} onClose={() => setSelected(null)} onSave={(status, scheduledAt) => move(selected, status, scheduledAt)} />}
    </DndContext>
  );
}

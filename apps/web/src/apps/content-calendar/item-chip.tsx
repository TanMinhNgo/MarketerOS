"use client";

import { useDraggable } from "@dnd-kit/core";
import type { ContentResponse } from "@marketos/shared";
import { timeLabel } from "../../lib/calendar-utils";
import { cn } from "@/lib/utils";
import { channelLabel } from "../content-studio/channels";
import { channelColor } from "./channel-colors";

/** Chip nội dung: kéo để đổi ngày, bấm để mở chi tiết. */
export function ItemChip({ item, onOpen, compact }: { item: ContentResponse; onOpen: (i: ContentResponse) => void; compact?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id });
  const color = channelColor(item.channel);
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      onClick={() => onOpen(item)}
      aria-label={`${item.title}, ${channelLabel(item.channel)}, ${item.status.toLowerCase()}${item.scheduledAt ? `, ${timeLabel(item.scheduledAt)}` : ""}. Press Enter to open.`}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md border-l-4 bg-card px-1.5 py-1 text-left text-[11px] font-medium shadow-sm outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-ring",
        isDragging && "opacity-30",
        item.status === "DONE" && "line-through opacity-60",
      )}
      style={{ borderLeftColor: color }}
    >
      {item.scheduledAt && !compact && <span className="shrink-0 text-muted-foreground">{timeLabel(item.scheduledAt)}</span>}
      <span className="truncate">{item.title}</span>
    </button>
  );
}

/** Bản hiển thị đi theo con trỏ khi đang kéo. */
export function ChipPreview({ item }: { item: ContentResponse }) {
  return (
    <div className="w-44 rounded-md border-l-4 bg-card px-2 py-1.5 text-xs font-semibold shadow-lg" style={{ borderLeftColor: channelColor(item.channel) }}>
      {item.title}
    </div>
  );
}

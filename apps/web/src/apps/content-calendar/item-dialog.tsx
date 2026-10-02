"use client";

import { ContentStatusSchema, type ContentResponse } from "@marketos/shared";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { channelLabel } from "../content-studio/channels";
import type { ContentStatus, SchedulePatch } from "../../lib/calendar-api";
import { fromKey, toKey } from "../../lib/calendar-utils";
import { channelColor } from "./channel-colors";

const STATUSES = ContentStatusSchema.options;
const STATUS_LABEL: Record<ContentStatus, string> = { DRAFT: "Draft", READY: "Ready", SCHEDULED: "Scheduled", DONE: "Done" };
const pad = (n: number) => String(n).padStart(2, "0");

/** Mở một nội dung trên lịch: xem, đổi trạng thái (DRAFT → READY → SCHEDULED → DONE) và ngày giờ. */
export function ItemDialog({ item, onClose, onSave }: { item: ContentResponse; onClose: () => void; onSave: (patch: SchedulePatch) => void }) {
  const initial = item.scheduledAt ? new Date(item.scheduledAt) : null;
  const [status, setStatus] = useState<ContentStatus>(item.status);
  const [date, setDate] = useState(initial ? toKey(initial) : "");
  const [time, setTime] = useState(initial ? `${pad(initial.getHours())}:${pad(initial.getMinutes())}` : "09:00");
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (status === "SCHEDULED" && !date) return setError("Pick a date to schedule this content.");
    let scheduledAt: string | null = null;
    if (date) {
      const d = fromKey(date);
      const [h, m] = (time || "09:00").split(":").map(Number);
      d.setHours(h, m, 0, 0);
      scheduledAt = d.toISOString();
    }
    onSave({ status, scheduledAt });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-6">{item.title}</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: channelColor(item.channel) }} aria-hidden="true" />
            {channelLabel(item.channel)}
          </DialogDescription>
        </DialogHeader>

        <p className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm">{item.body}</p>
        {!!item.hashtags.length && <p className="text-xs text-primary">{item.hashtags.join(" ")}</p>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="cal-status">Status</Label>
            <Select value={status} onValueChange={(v) => { setStatus(v as ContentStatus); setError(null); }}>
              <SelectTrigger id="cal-status" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cal-date">Date</Label>
            <Input id="cal-date" type="date" value={date} onChange={(e) => { setDate(e.target.value); setError(null); }} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cal-time">Time</Label>
            <Input id="cal-time" type="time" value={time} disabled={!date} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" disabled={!item.scheduledAt && !date} onClick={() => { setDate(""); setStatus("DRAFT"); setError(null); }}>
            Remove from calendar
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="button" onClick={save}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { CreateAutomationSchema, PLAN_LIMITS, type Automation, type AutomationSchedule, type UpdateAutomationInput } from "@marketos/shared";
import { Popover } from "radix-ui";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CHANNELS, type ChannelValue } from "../content-studio/channels";
import { notify } from "@/lib/notify/notify";
import { cn } from "@/lib/utils";
import { describeSchedule, deviceTimezone, TYPES, WEEKDAYS } from "./schedule";
import { useSaveAutomation } from "./use-automations";

type Type = Automation["type"];
type Frequency = AutomationSchedule["frequency"];

const TIMEZONES = Intl.supportedValuesOf("timeZone");

function Field({ id, label, hint, children }: Readonly<{ id?: string; label: string; hint?: string; children: React.ReactNode }>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Chọn nhiều bằng checkbox (kênh, thứ trong tuần). */
function Checks<T extends string | number>({ label, options, value, onChange }: Readonly<{ label: string; options: { value: T; label: string }[]; value: T[]; onChange: (v: T[]) => void }>) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" className="accent-primary" checked={value.includes(o.value)} onChange={(e) => onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value))} />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Ô múi giờ gõ để lọc; danh sách hiện trong popover cùng style với Select (datalist native xấu và khác nhau theo trình duyệt). */
function TimezonePicker({ id, value, onChange }: Readonly<{ id: string; value: string; onChange: (v: string) => void }>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const q = value.trim().toLowerCase().replaceAll(" ", "_");
  // ponytail: lọc chuỗi con và chỉ hiện 50 kết quả đầu; đủ cho ~400 múi giờ.
  const matches = (TIMEZONES.some((z) => z.toLowerCase() === q) ? TIMEZONES : TIMEZONES.filter((z) => z.toLowerCase().includes(q))).slice(0, 50);
  const pick = (z: string) => {
    onChange(z);
    setOpen(false);
  };

  return (
    <Popover.Root open={open && matches.length > 0} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <Input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-activedescendant={open && matches[active] ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          value={value}
          placeholder="Type to search, e.g. Ho_Chi_Minh"
          onFocus={(e) => {
            e.target.select();
            setOpen(true);
          }}
          onChange={(e) => {
            onChange(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length);
            } else if (e.key === "Enter" && open && matches[active]) {
              e.preventDefault();
              pick(matches[active]);
            } else if (e.key === "Escape") setOpen(false);
          }}
        />
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.target instanceof Node && document.getElementById(id)?.contains(e.target) && e.preventDefault()}
          className="z-50 max-h-60 w-(--radix-popover-trigger-width) overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <ul id={`${id}-list`} role="listbox">
            {matches.map((z, i) => (
              <li
                key={z}
                role="option"
                aria-selected={i === active}
                id={`${id}-opt-${i}`}
                onPointerDown={(e) => {
                  e.preventDefault(); // giữ focus ở ô nhập
                  pick(z);
                }}
                onPointerEnter={() => setActive(i)}
                className={cn("cursor-pointer rounded-sm px-2 py-1.5 text-sm", i === active && "bg-accent text-accent-foreground", z === value && "font-semibold")}
              >
                {z.replaceAll("_", " ")}
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

type ConfigFields = { channels: ChannelValue[]; count: number; topic: string; times: string[]; daysAhead: number; prompt: string };

function buildSchedule(frequency: Frequency, time: string, timezone: string, weekdays: number[], dayOfMonth: number): AutomationSchedule {
  switch (frequency) {
    case "daily":
      return { frequency, time, timezone };
    case "weekly":
      return { frequency, time, timezone, weekdays };
    case "monthly":
      return { frequency, time, timezone, dayOfMonth };
  }
}

/** Chỉ gửi các trường của đúng loại tác vụ (schema strict). */
function buildConfig(type: Type, f: ConfigFields) {
  switch (type) {
    case "write_posts":
      return { channels: f.channels, count: f.count, topic: f.topic };
    case "schedule_ready":
      return { times: f.times, daysAhead: f.daysAhead, ...(f.channels.length ? { channels: f.channels } : {}) };
    case "custom_prompt":
      return { prompt: f.prompt };
    case "weekly_report":
      return {};
  }
}

/** Tác vụ mới mặc định Facebook; khi sửa thì lấy kênh đã lưu (schedule_ready không lọc kênh = rỗng). */
function initialChannels(a?: Automation): ChannelValue[] {
  if (!a) return ["FACEBOOK"];
  return "channels" in a && a.channels ? a.channels : [];
}

/** Tạo / sửa tác vụ. Loại tác vụ không đổi được sau khi tạo (theo contract). */
export function AutomationForm({ projectId, automation, onClose }: Readonly<{ projectId: string; automation?: Automation; onClose: () => void }>) {
  const a = automation;
  const s = a?.schedule;
  const [name, setName] = useState(a?.name ?? "");
  const [type, setType] = useState<Type>(a?.type ?? "write_posts");
  const [frequency, setFrequency] = useState<Frequency>(s?.frequency ?? "weekly");
  const [time, setTime] = useState(s?.time ?? "09:00");
  const [weekdays, setWeekdays] = useState<number[]>(s?.frequency === "weekly" ? s.weekdays : [1]);
  const [dayOfMonth, setDayOfMonth] = useState(s?.frequency === "monthly" ? s.dayOfMonth : 1);
  const [timezone, setTimezone] = useState(s?.timezone ?? deviceTimezone());
  const [channels, setChannels] = useState<ChannelValue[]>(initialChannels(a));
  const [count, setCount] = useState(a?.type === "write_posts" ? a.count : 3);
  const [topic, setTopic] = useState(a?.type === "write_posts" ? (a.topic ?? "") : "");
  const [times, setTimes] = useState<string[]>(a?.type === "schedule_ready" ? a.times : ["09:00"]);
  const [daysAhead, setDaysAhead] = useState(a?.type === "schedule_ready" ? a.daysAhead : 7);
  const [prompt, setPrompt] = useState(a?.type === "custom_prompt" ? a.prompt : "");
  const [enabled, setEnabled] = useState(a?.enabled ?? true);
  const [invalid, setInvalid] = useState(false);
  const save = useSaveAutomation(projectId);

  const schedule = buildSchedule(frequency, time, timezone, weekdays, dayOfMonth);
  const config = buildConfig(type, { channels, count, topic, times, daysAhead, prompt });
  let submitLabel = a ? "Save" : "Create";
  if (save.isPending) submitLabel = "Saving…";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = CreateAutomationSchema.safeParse({ name, enabled, schedule, type, ...config });
    setInvalid(!parsed.success);
    if (!parsed.success) return;
    // PATCH không nhận `type`; gửi lại cấu hình đầy đủ của đúng loại đó.
    const patch = Object.fromEntries(Object.entries(parsed.data).filter(([k]) => k !== "type" && k !== "enabled")) as UpdateAutomationInput;
    save.mutate(
      { id: a?.id, input: a ? patch : parsed.data },
      {
        onError: (e) => notify.apiError(a ? "Couldn't save the automation" : "Couldn't create the automation", e),
        onSuccess: (x) => {
          notify.success(a ? "Automation saved" : `"${x.name}" created`, { description: x.enabled ? describeSchedule(x.schedule) : "Paused" });
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{a ? "Edit automation" : "New automation"}</DialogTitle>
            <DialogDescription>{TYPES[type].blurb}</DialogDescription>
          </DialogHeader>

          <Field id="au-name" label="Name">
            <Input id="au-name" value={name} maxLength={80} placeholder="e.g. Monday posts" onChange={(e) => setName(e.target.value)} />
          </Field>

          {!a && (
            <Field id="au-type" label="What it does">
              <Select value={type} onValueChange={(v) => setType(v as Type)}>
                <SelectTrigger id="au-type" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPES) as Type[]).map((t) => <SelectItem key={t} value={t}>{TYPES[t].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          )}

          {type === "write_posts" && (
            <>
              <Checks label="Channels (up to 5)" options={CHANNELS.map((c) => ({ value: c.value, label: c.label }))} value={channels} onChange={setChannels} />
              <Field id="au-count" label="Posts per run" hint="Channels take turns, in the order above.">
                <Input id="au-count" type="number" min={1} max={5} value={count} onChange={(e) => setCount(Number(e.target.value))} />
              </Field>
              <Field id="au-topic" label="Topic (optional)">
                <Textarea id="au-topic" value={topic} maxLength={500} rows={2} placeholder="e.g. Tips for first-time customers" onChange={(e) => setTopic(e.target.value)} />
              </Field>
            </>
          )}

          {type === "schedule_ready" && (
            <>
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">Time slots (up to 3)</legend>
                <div className="flex flex-wrap items-center gap-2">
                  {times.map((t, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <Input type="time" aria-label={`Slot ${i + 1}`} className="w-36" value={t} onChange={(e) => setTimes(times.map((x, j) => (j === i ? e.target.value : x)))} />
                      {times.length > 1 && (
                        <Button type="button" size="xs" variant="ghost" aria-label={`Remove slot ${i + 1}`} onClick={() => setTimes(times.filter((_, j) => j !== i))}>×</Button>
                      )}
                    </div>
                  ))}
                  {times.length < 3 && (
                    <Button type="button" size="sm" variant="outline" onClick={() => setTimes([...times, "18:00"])}>Add slot</Button>
                  )}
                </div>
              </fieldset>
              <Field id="au-days" label="Fill the next … days" hint="Slots that already have a post are skipped. Only approved posts are scheduled.">
                <Input id="au-days" type="number" min={1} max={14} value={daysAhead} onChange={(e) => setDaysAhead(Number(e.target.value))} />
              </Field>
              <Checks label="Only these channels (none = all)" options={CHANNELS.map((c) => ({ value: c.value, label: c.label }))} value={channels} onChange={setChannels} />
            </>
          )}

          {type === "custom_prompt" && (
            <Field id="au-prompt" label="Instruction" hint="It can't approve, delete or mark posts as Done.">
              <Textarea id="au-prompt" value={prompt} maxLength={2000} rows={4} placeholder="e.g. Write 2 posts about this week's promotion" onChange={(e) => setPrompt(e.target.value)} />
            </Field>
          )}

          <fieldset className="space-y-3 rounded-xl border p-3">
            <legend className="px-1 text-sm font-semibold">When it runs</legend>
            <div className="grid grid-cols-2 gap-3">
              <Field id="au-freq" label="Repeat">
                <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
                  <SelectTrigger id="au-freq" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Every day</SelectItem>
                    <SelectItem value="weekly">Every week</SelectItem>
                    <SelectItem value="monthly">Every month</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field id="au-time" label="Time">
                <Input id="au-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </Field>
            </div>
            {frequency === "weekly" && <Checks label="On" options={WEEKDAYS.map((label, value) => ({ value, label }))} value={weekdays} onChange={setWeekdays} />}
            {frequency === "monthly" && (
              <Field id="au-dom" label="Day of the month" hint="1–28, so it runs every month.">
                <Input id="au-dom" type="number" min={1} max={28} value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))} />
              </Field>
            )}
            <Field id="au-tz" label="Time zone" hint="Type a city or region to filter the list.">
              <TimezonePicker id="au-tz" value={timezone} onChange={setTimezone} />
            </Field>
          </fieldset>

          {!a && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-primary" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              Turn it on now (you can turn on up to {PLAN_LIMITS.max.automations} across all projects)
            </label>
          )}

          {invalid && <p role="alert" className="text-sm text-destructive">Please check the fields: a name, at least one channel or weekday, a time zone from the list, and values within range.</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

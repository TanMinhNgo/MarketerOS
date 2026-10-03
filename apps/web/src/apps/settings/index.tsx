"use client";

import { Bell, BookOpen, CreditCard, LayoutGrid, Palmtree, UserRound } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { clearLayout } from "@/desktop/layout-storage";
import { NotificationSettings } from "@/desktop/notifications/NotificationBell";
import { VN_TZ } from "@/desktop/sky";
import type { Motion, Scene } from "@/desktop/sky-pref";
import { useSkyPref } from "@/desktop/use-sky";
import { useWindowStore } from "@/desktop/window-store";
import { notify } from "@/lib/notify/notify";

const SCENE_LABEL: Record<Scene, string> = { auto: "Follow the clock", dawn: "Always sunrise", day: "Always daytime", sunset: "Always sunset", night: "Always night" };
const MOTION_LABEL: Record<Motion, string> = { system: "Follow my device", reduce: "Reduce motion", full: "Show all motion" };

function Choice<T extends string>({ id, label, hint, value, options, onChange }: Readonly<{ id: string; label: string; hint?: string; value: T; options: Record<T, string>; onChange: (v: T) => void }>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger id={id} className="w-full sm:w-72"><SelectValue /></SelectTrigger>
        <SelectContent>
          {(Object.keys(options) as T[]).map((k) => <SelectItem key={k} value={k}>{options[k]}</SelectItem>)}
        </SelectContent>
      </Select>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Appearance() {
  const { pref, setPref } = useSkyPref();
  const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
  // Đồng hồ cảnh: giờ Việt Nam hoặc múi giờ của máy (hai múi trùng nhau thì chỉ cần một lựa chọn).
  const clocks: Record<string, string> = { [VN_TZ]: "Vietnam time", [device]: `This device (${device})` };

  return (
    <div className="space-y-4">
      <Choice id="set-scene" label="Beach scene" hint="Follow the clock changes the sky through the day." value={pref.scene} options={SCENE_LABEL} onChange={(scene) => setPref({ scene })} />
      {pref.scene === "auto" && <Choice id="set-clock" label="Scene clock" value={pref.tz in clocks ? pref.tz : VN_TZ} options={clocks} onChange={(tz) => setPref({ tz })} />}
      <Choice id="set-motion" label="Animations" hint="Reduce motion stops the waves, clouds and window effects." value={pref.motion} options={MOTION_LABEL} onChange={(motion) => setPref({ motion })} />
    </div>
  );
}

function WindowLayout() {
  const [confirming, setConfirming] = useState(false);
  const reset = () => {
    clearLayout();
    // Mở lại các cửa sổ đang mở (theo thứ tự chồng) để chúng về kích thước và vị trí mặc định.
    const { windows, close, open } = useWindowStore.getState();
    const ids = [...windows].sort((a, b) => a.z - b.z).map((w) => w.appId);
    for (const id of ids) close(id);
    for (const id of ids) open(id);
    setConfirming(false);
    notify.success("Window layout reset", { description: "Every window is back to its default size and place." });
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">MarketOS remembers where you put each window and how big it is.</p>
      {confirming ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="destructive" onClick={reset}>Reset layout</Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Keep it</Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>Reset window layout</Button>
      )}
    </div>
  );
}

export default function App() {
  const open = useWindowStore((s) => s.open);
  return (
    <div className="mx-auto w-11/12 space-y-4 py-5">
      <header>
        <h2 className="font-display text-xl font-bold">Settings</h2>
        <p className="text-sm text-muted-foreground">Saved in this browser.</p>
      </header>
      <Card icon={Palmtree} title="Desktop">
        <Appearance />
      </Card>
      <Card icon={Bell} title="Notifications">
        <div className="-mx-4 -my-1">
          <NotificationSettings />
        </div>
      </Card>
      <Card icon={LayoutGrid} title="Windows">
        <WindowLayout />
      </Card>
      <Card icon={UserRound} title="More">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => open("account")}><UserRound /> Account</Button>
          <Button size="sm" variant="outline" onClick={() => open("plans-billing")}><CreditCard /> Plans &amp; Billing</Button>
          <Button size="sm" variant="outline" onClick={() => open("docs")}><BookOpen /> Docs</Button>
        </div>
      </Card>
    </div>
  );
}

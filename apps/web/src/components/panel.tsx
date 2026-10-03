import type { LucideIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/** Khung nội dung có icon + tiêu đề, dùng trong Plans & Billing và Reports. */
export function Card({ icon: Icon, title, children, action }: Readonly<{ icon: LucideIcon; title: string; children: React.ReactNode; action?: React.ReactNode }>) {
  return (
    <section aria-label={title} className="rounded-2xl border-2 border-[#3B2A4A]/40 bg-card p-4">
      <header className="mb-3 flex items-center gap-2">
        <Icon className="size-4 text-primary" aria-hidden="true" />
        <h3 className="font-display text-base font-bold">{title}</h3>
        <div className="flex-1" />
        {action}
      </header>
      {children}
    </section>
  );
}

/** Thanh mức dùng: đã dùng / giới hạn, đỏ khi chạm giới hạn. */
export function Meter({ label, used, limit, hint }: Readonly<{ label: string; used: number; limit: number; hint: string }>) {
  const full = used >= limit;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className={cn("tabular-nums", full ? "font-semibold text-destructive" : "text-muted-foreground")}>
          {used} / {limit}
        </span>
      </div>
      <Progress value={Math.min(100, (used / limit) * 100)} aria-label={`${label}: ${used} of ${limit} used`} className={cn(full && "[&>[data-slot=progress-indicator]]:bg-destructive")} />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

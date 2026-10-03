"use client";

import { useUser } from "@clerk/nextjs";
import { PLAN_CATALOG, type PlanKey } from "@marketos/shared";
import { Crown, Sparkles } from "lucide-react";
import { useMe } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useWindowStore } from "./window-store";

/** Gói đang dùng (backend xác minh từ Clerk); chưa tải xong thì coi như Free để không hiện nhầm hiệu ứng. */
const usePlan = (): PlanKey => useMe().data?.plan ?? "free";

/** Viền avatar theo gói: Pro vàng phát sáng, Max cầu vồng xoay. */
const RING: Record<PlanKey, string> = {
  free: "",
  pro: "bg-[#FFC83D] shadow-[0_0_10px_rgba(255,200,61,0.75)]",
  max: "shadow-[0_0_12px_rgba(167,139,250,0.85)]",
};

/** Avatar trên header: bấm để mở app Account (cửa sổ), không dùng menu popup của Clerk. */
export function UserAvatarButton() {
  const { user } = useUser();
  const open = useWindowStore((s) => s.open);
  const plan = usePlan();
  const initial = (user?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? "?").charAt(0).toUpperCase();

  return (
    <span className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-full", plan !== "free" && "p-[2.5px]", RING[plan])}>
      {plan === "max" && <span className="spin-ring absolute inset-[-50%] bg-[conic-gradient(#FF6F9C,#FFC83D,#4ADE80,#38BDF8,#A78BFA,#FF6F9C)]" aria-hidden="true" />}
      <button
        type="button"
        aria-label={plan === "free" ? "Open account" : `Open account (${PLAN_CATALOG[plan].name} plan)`}
        onClick={() => open("account")}
        className="relative grid size-7 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-[#3B2A4A] bg-white/70 text-[11px] font-bold text-[#3B2A4A] shadow-[0_2px_0_rgba(59,42,74,0.3)] transition-transform hover:scale-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      >
        {user?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- ảnh avatar từ CDN của Clerk, không cần tối ưu qua next/image
          <img src={user.imageUrl} alt="" className="size-full object-cover" />
        ) : (
          initial
        )}
      </button>
    </span>
  );
}

/** Nhãn gói cạnh logo MarketOS (chỉ Pro / Max); bấm để mở Plans & Billing. */
export function PlanChip() {
  const plan = usePlan();
  const open = useWindowStore((s) => s.open);
  if (plan === "free") return null;
  const max = plan === "max";
  return (
    <button
      type="button"
      onClick={() => open("plans-billing")}
      className={cn(
        "flex items-center gap-1 rounded-full border-2 border-[#3B2A4A] px-2 py-px text-[10px] font-extrabold uppercase tracking-wider text-[#3B2A4A] shadow-[0_2px_0_rgba(59,42,74,0.3)] transition-transform hover:scale-105",
        max ? "shimmer-bg bg-[linear-gradient(90deg,#FF9EC0,#FFE08A,#9BF0B8,#9AD8FF,#CDB8FF,#FF9EC0)] bg-[length:200%_100%]" : "bg-[#FFC83D]",
      )}
    >
      {max ? <Crown className="size-3" aria-hidden="true" /> : <Sparkles className="size-3" aria-hidden="true" />}
      {max ? "Max" : "Pro"}
    </button>
  );
}

"use client";

import { useUser } from "@clerk/nextjs";
import { useWindowStore } from "./window-store";

/** Avatar trên header: bấm để mở app Account (cửa sổ), không dùng menu popup của Clerk. */
export function UserAvatarButton() {
  const { user } = useUser();
  const open = useWindowStore((s) => s.open);
  const initial = (user?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? "?").charAt(0).toUpperCase();

  return (
    <button
      type="button"
      aria-label="Open account"
      onClick={() => open("account")}
      className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-[#3B2A4A] bg-white/70 text-[11px] font-bold text-[#3B2A4A] shadow-[0_2px_0_rgba(59,42,74,0.3)] transition-transform hover:scale-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
    >
      {user?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- ảnh avatar từ CDN của Clerk, không cần tối ưu qua next/image
        <img src={user.imageUrl} alt="" className="size-full object-cover" />
      ) : (
        initial
      )}
    </button>
  );
}

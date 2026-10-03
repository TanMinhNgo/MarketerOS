import { Show } from "@clerk/nextjs";
import { ActiveProjectPill } from "./ActiveProjectPill";
import { Logo } from "./AppIcon";
import { MenuNav } from "./MenuNav";
import { OpenAppButton } from "./OpenAppButton";
import { SearchButton } from "./search/SearchButton";
import { NotificationBell } from "./notifications/NotificationBell";
import { PlanChip, UserAvatarButton } from "./UserAvatarButton";

export function MenuBar() {
  return (
    <header
      className="absolute inset-x-0 top-0 z-30 flex h-10 items-center gap-6 border-b border-white/25 px-4 backdrop-blur-xl"
      style={{ background: "var(--bar-bg)", color: "var(--bar-ink)" }}
    >
      <div className="flex items-center gap-2">
        <Logo size={22} />
        <span className="font-display text-sm font-bold">MarketOS</span>
        <Show when="signed-in">
          <PlanChip />
        </Show>
      </div>
      <MenuNav />
      <div className="flex-1" />
      <ActiveProjectPill />
      <SearchButton />
      <NotificationBell />
      <Show when="signed-out">
        <OpenAppButton appId="sign-in" size="sm" variant="ghost" className="h-7 rounded-full px-3 text-xs font-bold hover:bg-white/30">
          Sign in
        </OpenAppButton>
        <OpenAppButton appId="sign-up" size="sm" className="h-7 rounded-full px-4 text-xs font-bold">
          Sign up
        </OpenAppButton>
      </Show>
      <Show when="signed-in">
        <UserAvatarButton />
      </Show>
    </header>
  );
}

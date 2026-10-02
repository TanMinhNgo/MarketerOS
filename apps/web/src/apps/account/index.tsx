"use client";

import { UserProfile, useClerk, useUser } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Button } from "@/components/ui/button";
import { useWindowStore } from "@/desktop/window-store";
import { embeddedAppearance } from "@/lib/clerk-appearance";

function AccountApp() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const close = useWindowStore((s) => s.close);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{user?.fullName ?? user?.primaryEmailAddress?.emailAddress}</p>
          {user?.fullName && <p className="truncate text-xs text-muted-foreground">{user.primaryEmailAddress?.emailAddress}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={() => signOut().then(() => close("account"))}>
          <LogOut /> Sign out
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <UserProfile routing="hash" appearance={embeddedAppearance} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthGate>
      <AccountApp />
    </AuthGate>
  );
}

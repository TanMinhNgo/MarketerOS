"use client";

import { SignUp, useAuth } from "@clerk/nextjs";
import { useEffect } from "react";
import { useWindowStore } from "@/desktop/window-store";
import { embeddedAppearance } from "@/lib/clerk-appearance";

export default function App() {
  const { isSignedIn } = useAuth();
  const close = useWindowStore((s) => s.close);

  // Chuyển từ Sign in sang Sign up thì đóng cửa sổ Sign in để không bị hai cửa sổ cùng lúc.
  useEffect(() => {
    close("sign-in");
  }, [close]);

  useEffect(() => {
    if (isSignedIn) close("sign-up");
  }, [isSignedIn, close]);

  return (
    <div className="flex min-h-full items-center justify-center p-2">
      <SignUp routing="hash" signInUrl="/apps/sign-in" fallbackRedirectUrl="/" appearance={embeddedAppearance} />
    </div>
  );
}

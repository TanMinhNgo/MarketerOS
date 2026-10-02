"use client";

import { Show } from "@clerk/nextjs";
import { LogIn } from "lucide-react";
import type { ReactNode } from "react";
import { OpenAppButton } from "@/desktop/OpenAppButton";

function SignInPrompt() {
  return (
    <div className="grid h-full place-items-center p-6">
      <div className="max-w-xs text-center">
        <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl border-2 border-[#3B2A4A] bg-primary/15 text-primary">
          <LogIn className="size-7" />
        </div>
        <h2 className="font-display text-lg font-bold">Sign in to continue</h2>
        <p className="mt-1 text-sm text-muted-foreground">Your projects and Brand Briefs are saved to your account.</p>
        <div className="mt-4 flex justify-center gap-2">
          <OpenAppButton appId="sign-in">Sign in</OpenAppButton>
          <OpenAppButton appId="sign-up" variant="outline">
            Sign up
          </OpenAppButton>
        </div>
      </div>
    </div>
  );
}

/** Bọc app cần đăng nhập: khách thấy lời mời đăng nhập, người dùng thấy nội dung. */
export function AuthGate({ children }: { children: ReactNode }) {
  return (
    <>
      <Show when="signed-in">{children}</Show>
      <Show when="signed-out">
        <SignInPrompt />
      </Show>
    </>
  );
}

"use client";

import { Check, Clock } from "lucide-react";
import { Logo } from "@/desktop/AppIcon";
import { OpenAppButton } from "@/desktop/OpenAppButton";

const SHIPPED = [
  "Desktop with draggable, resizable windows and a taskbar",
  "Sign up and sign in with Google or email",
  "Projects as folders, with Trash and restore",
  "Brand Brief per project",
  "Content Studio: AI writes 3 post variants per request, in the brief's voice and language",
  "Review and approve drafts, then schedule them on the Content Calendar",
  "Free and Pro plans with usage limits, checkout and billing history",
  "AI Assistant (Pro): chat per project, with suggested drafts, edits and schedules you apply in one click",
  "Deep links and browser Back / Forward for every app",
  "Mobile layout with full-screen sheets",
];

const NEXT = [
  { name: "Media Library, Integrations, Reports", note: "Assets, social channels and performance." },
];

const STACK = ["Next.js", "React", "TypeScript", "Tailwind CSS", "Zustand", "TanStack Query", "NestJS", "PostgreSQL", "Clerk", "OpenAI"];

export default function App() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <header className="flex items-center gap-4">
        <Logo size={64} />
        <div>
          <h2 className="font-display text-3xl font-bold leading-tight">MarketOS</h2>
          <p className="text-muted-foreground">AI assistant for solo marketers</p>
        </div>
      </header>

      <section aria-labelledby="about-why">
        <h3 id="about-why" className="font-display text-lg font-bold">Why it exists</h3>
        <p className="mt-1 text-sm leading-relaxed">
          Running marketing alone means juggling brands, ideas and deadlines across scattered tabs. MarketOS puts them on one desktop: each project is a folder, each tool is a window, and the AI
          always knows your brand because it reads your Brand Brief first.
        </p>
      </section>

      <section aria-labelledby="about-who">
        <h3 id="about-who" className="font-display text-lg font-bold">Who it is for</h3>
        <p className="mt-1 text-sm leading-relaxed">Freelancers, founders and one-person marketing teams who manage more than one brand and want consistent content without a big toolset.</p>
      </section>

      <section aria-labelledby="about-now">
        <h3 id="about-now" className="font-display text-lg font-bold">Available today</h3>
        <ul className="mt-2 space-y-1.5">
          {SHIPPED.map((t) => (
            <li key={t} className="flex gap-2 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="about-next">
        <h3 id="about-next" className="font-display text-lg font-bold">Coming next</h3>
        <ul className="mt-2 space-y-1.5">
          {NEXT.map((t) => (
            <li key={t.name} className="flex gap-2 text-sm">
              <Clock className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
              <span>
                <strong>{t.name}.</strong> {t.note}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="about-built">
        <h3 id="about-built" className="font-display text-lg font-bold">Built with</h3>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {STACK.map((s) => (
            <li key={s} className="rounded-full border px-2.5 py-0.5 text-xs font-medium">{s}</li>
          ))}
        </ul>
      </section>

      <footer className="flex flex-wrap items-center gap-3 border-t pt-4">
        <OpenAppButton appId="docs">Read the guide</OpenAppButton>
        <p className="text-xs text-muted-foreground">Mascots and artwork are original to MarketOS.</p>
      </footer>
    </div>
  );
}

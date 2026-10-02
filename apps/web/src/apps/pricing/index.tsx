"use client";

import { useAuth } from "@clerk/nextjs";
import { PLAN_CATALOG, type FeatureKey, type PlanKey } from "@marketos/shared";
import { Check, ChevronDown, CreditCard, Minus, Rocket, ShieldCheck, Sparkles, Undo2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useWindowStore } from "@/desktop/window-store";
import { useMe } from "@/lib/queries";
import { cn } from "@/lib/utils";

type Status = "now" | "soon";

/** Nhãn, mô tả ngắn và trạng thái triển khai thật của từng tính năng (theo packages/docs/01-product-and-scope.md). */
const FEATURES: Record<FeatureKey, { label: string; blurb: string; status: Status }> = {
  brand_brief: { label: "Brand Brief", blurb: "Describe your product, audience and tone once; every project keeps its own brief.", status: "now" },
  content_generation: { label: "AI content generation", blurb: "Draft posts in your brand voice, with several variants to choose from.", status: "now" },
  image_generation: { label: "AI image generation", blurb: "Create visuals that follow the style you describe in your brief.", status: "soon" },
  personalization: { label: "Personalization and references", blurb: "Teach the AI with sample posts and reference material.", status: "soon" },
  content_calendar: { label: "Content calendar", blurb: "Approve drafts, then plan and schedule them on a calendar.", status: "now" },
  more_projects: { label: "More projects", blurb: "Run up to 20 brands or clients side by side (Free: 3).", status: "now" },
  strong_model: { label: "Advanced AI models", blurb: "A stronger model for longer, more nuanced writing.", status: "soon" },
  expanded_references: { label: "Expanded reference storage", blurb: "Keep more brand material close to the AI.", status: "soon" },
  channel_publishing: { label: "Channels and scheduled publishing", blurb: "Connect social channels and publish on schedule.", status: "soon" },
  ai_assistant: { label: "Project-aware AI assistant", blurb: "Ask questions about a project and get answers grounded in its brief.", status: "soon" },
  content_analytics: { label: "Content performance analytics", blurb: "See what is working across channels.", status: "soon" },
};

const PLAN_KEYS: PlanKey[] = ["free", "pro"];
const ALL_FEATURES = Object.keys(FEATURES) as FeatureKey[];

const price = (cents: number) => (cents === 0 ? "$0" : `$${cents / 100}`);

const WHO: Record<PlanKey, string> = {
  free: "Trying MarketOS, or running a single brand on your own.",
  pro: "Freelancers and small businesses who manage several brands and want to publish across channels.",
};

const FAQ: { q: string; a: ReactNode }[] = [
  { q: "Is the Free plan really free?", a: "Yes. You can sign up and use the Free plan without entering a payment card." },
  { q: "How do I upgrade?", a: "Open Plans & Billing and press Upgrade to Pro. A secure checkout opens where you add a card. Your plan updates as soon as the payment goes through." },
  { q: "Can I cancel?", a: "Yes, any time from Plans & Billing. You keep Pro until the end of the period you already paid for, and you are not charged again." },
  { q: "Do you store my card details?", a: "No. Card details are handled by Stripe through Clerk's billing, so MarketOS never sees them." },
  { q: "Where can I see my payments?", a: "In Plans & Billing, under Billing history, with the date, amount and status of every charge." },
  { q: "Which features can I use today?", a: "Projects, Trash, Brand Brief, AI content generation and the Content Calendar are available now. The features marked Coming soon are being built, and the table above shows which plan each one belongs to." },
  { q: "What are the usage limits?", a: "Free: 3 active projects and 10 AI generations a month. Pro: 20 active projects and 200 AI generations a month. One generation writes 3 variants, and every 3 single-variant regenerates count as 1. Generations reset on the 1st of each month (UTC); projects in Trash don't count. You can see your usage in Plans & Billing." },
  { q: "Is there a team or student plan?", a: "Not yet. There are two plans for now: Free and Pro." },
];

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-10">
      <h3 id={id} className="font-display text-xl font-bold">{title}</h3>
      {intro && <p className="mt-1 text-sm text-muted-foreground">{intro}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StatusBadge({ status }: { status: Status }) {
  return status === "now" ? (
    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">Available</span>
  ) : (
    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">Coming soon</span>
  );
}

export default function App() {
  const { isSignedIn } = useAuth();
  const open = useWindowStore((s) => s.open);
  const me = useMe(!!isSignedIn);
  const current = isSignedIn ? me.data?.plan : undefined;

  const cta = (key: PlanKey) => {
    if (key === "free") return { label: isSignedIn ? "Open Projects" : "Get started free", run: () => open(isSignedIn ? "projects" : "sign-up") };
    return { label: "Upgrade to Pro", run: () => open(isSignedIn ? "plans-billing" : "sign-up") };
  };

  return (
    <div className="@container mx-auto max-w-3xl p-6">
      <header className="text-center">
        <h2 className="font-display text-3xl font-bold">Start free. Upgrade when you outgrow it.</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          MarketOS keeps pricing simple: one free plan to get going, and one Pro plan when your marketing grows. Prices are in USD and billed monthly.
        </p>
        <ul className="mt-4 flex flex-wrap justify-center gap-2 text-xs font-semibold">
          {[
            [CreditCard, "No card needed to start"],
            [Undo2, "Cancel any time"],
            [ShieldCheck, "Payments handled by Stripe"],
          ].map(([Icon, text]) => {
            const I = Icon as typeof CreditCard;
            return (
              <li key={text as string} className="flex items-center gap-1.5 rounded-full border px-3 py-1">
                <I className="size-3.5 text-primary" aria-hidden="true" />
                {text as string}
              </li>
            );
          })}
        </ul>
      </header>

      <div className="mt-8 grid gap-4 @xl:grid-cols-2">
        {PLAN_KEYS.map((key) => {
          const plan = PLAN_CATALOG[key];
          const isCurrent = current === key;
          const action = cta(key);
          return (
            <section
              key={key}
              aria-labelledby={`plan-${key}`}
              className={cn("flex flex-col rounded-2xl border-2 bg-card p-5", key === "pro" ? "border-primary shadow-[0_5px_0_rgba(109,91,255,0.35)]" : "border-[#3B2A4A]/50")}
            >
              <div className="flex items-center gap-2">
                <h3 id={`plan-${key}`} className="font-display text-xl font-bold">{plan.name}</h3>
                {key === "pro" && <Sparkles className="size-4 text-primary" aria-hidden="true" />}
                {isCurrent && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">Current plan</span>}
              </div>
              <p className="mt-2 flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold">{price(plan.price.amountCents)}</span>
                <span className="text-sm text-muted-foreground">/ month</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Best for</p>
              <p className="text-sm">{WHO[key]}</p>
              <ul className="my-4 flex-1 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                    {FEATURES[f].label}
                  </li>
                ))}
              </ul>
              <Button variant={key === "pro" ? "default" : "outline"} disabled={isCurrent} onClick={action.run}>
                {isCurrent ? "You're on this plan" : action.label}
              </Button>
            </section>
          );
        })}
      </div>

      <Section id="pricing-compare" title="Compare every feature" intro="What each plan includes, and what you can use today.">
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">Feature</th>
                <th scope="col" className="px-3 py-2 text-center font-semibold">Free</th>
                <th scope="col" className="px-3 py-2 text-center font-semibold">Pro</th>
                <th scope="col" className="px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ALL_FEATURES.map((f) => (
                <tr key={f}>
                  <th scope="row" className="px-3 py-2.5 font-medium">
                    {FEATURES[f].label}
                    <span className="block text-xs font-normal text-muted-foreground">{FEATURES[f].blurb}</span>
                  </th>
                  {PLAN_KEYS.map((k) => (
                    <td key={k} className="px-3 py-2.5 text-center">
                      {PLAN_CATALOG[k].features.includes(f) ? (
                        <Check className="mx-auto size-4 text-emerald-600" aria-label="Included" />
                      ) : (
                        <Minus className="mx-auto size-4 text-muted-foreground/50" aria-label="Not included" />
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-2.5">
                    <StatusBadge status={FEATURES[f].status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="pricing-how" title="How it works" intro="From first sign-up to a paid plan in three steps.">
        <ol className="grid gap-3 @xl:grid-cols-3">
          {[
            [Rocket, "Start on Free", "Create an account with Google or email. No card is needed."],
            [Sparkles, "Upgrade when ready", "Open Plans & Billing and choose Upgrade to Pro. Checkout is secure and quick."],
            [Undo2, "Stay in control", "Cancel from Plans & Billing and keep Pro until the end of the period you paid for."],
          ].map(([Icon, title, text], i) => {
            const I = Icon as typeof Rocket;
            return (
              <li key={title as string} className="rounded-xl border p-4">
                <div className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-full border-2 border-[#3B2A4A] bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
                  <I className="size-4 text-primary" aria-hidden="true" />
                </div>
                <p className="mt-2 font-semibold">{title as string}</p>
                <p className="mt-1 text-sm text-muted-foreground">{text as string}</p>
              </li>
            );
          })}
        </ol>
      </Section>

      <Section id="pricing-same" title="The same on every plan" intro="Upgrading adds capacity and tools. It never changes how MarketOS feels.">
        <ul className="grid gap-2 text-sm @xl:grid-cols-2">
          {[
            "The same desktop, windows and keyboard shortcuts",
            "Projects as folders, with Trash and restore",
            "A Brand Brief for every project",
            "Mobile layout and shareable links to each app",
            "Sign in with Google or email",
            "Cancel and view your payment history any time",
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
      </Section>

      <Section id="pricing-limits" title="About limits" intro="We would rather be clear than clever.">
        <ul className="space-y-1 text-sm leading-relaxed">
          <li><strong>Free:</strong> 3 active projects and 10 AI generations a month.</li>
          <li><strong>Pro:</strong> 20 active projects and 200 AI generations a month.</li>
        </ul>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Every generation writes 3 variants on both plans. Regenerating a single variant is cheaper: every 3 count as 1 generation. Generations reset on the 1st of each month (UTC), and projects in Trash don&apos;t count. Limits for images and storage will be published here before those features launch.
        </p>
      </Section>

      <Section id="pricing-faq" title="Questions, answered">
        <div className="divide-y rounded-xl border">
          {FAQ.map((item) => (
            <details key={item.q} className="group px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </Section>

      <aside className="mt-10 rounded-2xl border-2 border-primary/60 bg-primary/10 p-6 text-center">
        <h3 className="font-display text-xl font-bold">Ready to try MarketOS?</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Create your free account in under a minute, then open Projects and write your first Brand Brief.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button onClick={() => open(isSignedIn ? "projects" : "sign-up")}>{isSignedIn ? "Open Projects" : "Get started free"}</Button>
          <Button variant="outline" onClick={() => open("docs")}>Read the guide</Button>
        </div>
      </aside>

      <p className="mt-6 text-center text-xs text-muted-foreground">Upgrade, cancel and view invoices any time in Plans &amp; Billing.</p>
    </div>
  );
}

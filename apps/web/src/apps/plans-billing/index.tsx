"use client";

import { CheckoutButton, usePaymentAttempts, usePaymentMethods, usePlans, useSubscription } from "@clerk/nextjs/experimental";
import { CreditCard, Receipt, Sparkles } from "lucide-react";
import { useState } from "react";
import { notify } from "@/lib/notify/notify";
import { AuthGate } from "@/components/auth-gate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWindowStore } from "@/desktop/window-store";
import { useMe } from "@/lib/queries";
import { cn } from "@/lib/utils";

const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });
const fmt = (d: Date | null | undefined) => (d ? day.format(d) : "-");

function Card({ icon: Icon, title, children, action }: { icon: typeof Sparkles; title: string; children: React.ReactNode; action?: React.ReactNode }) {
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

const Muted = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-muted-foreground">{children}</p>;

function CurrentPlan() {
  const open = useWindowStore((s) => s.open);
  const me = useMe();
  const sub = useSubscription({ for: "user" });
  const plans = usePlans({ for: "user" });
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Gói trả phí đang dùng (nếu có); người dùng Free không có subscription item.
  const item = sub.data?.subscriptionItems.find((i) => i.status === "active" || i.status === "past_due");
  const pro = plans.data.find((p) => p.slug === "pro");
  const planName = item?.plan.name ?? (me.data?.plan === "pro" ? "Pro" : "Free");
  const isPaid = !!item && !item.plan.isDefault;
  const endsAt = item?.canceledAt ? item.periodEnd : null;
  const next = sub.data?.nextPayment ?? item?.nextPayment;

  const cancel = async () => {
    if (!item) return;
    setCancelling(true);
    try {
      await item.cancel({});
      await sub.revalidate();
      notify.success("Plan cancelled", { description: "You keep your current features until the end of this billing period.", persist: true, appId: "plans-billing" });
      setConfirming(false);
    } catch {
      notify.error("Couldn't cancel the plan", { description: "Please try again in a moment." });
    } finally {
      setCancelling(false);
    }
  };

  if (sub.isLoading) return <Muted>Loading your plan…</Muted>;
  if (sub.error) return <Muted>Billing isn&apos;t available yet. Check back soon.</Muted>;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-display text-2xl font-bold">{planName}</p>
        {item?.status === "past_due" && <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-white">Payment past due</span>}
        {endsAt ? (
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold">Ends {fmt(endsAt)}</span>
        ) : (
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold">Active</span>
        )}
      </div>

      {isPaid && !endsAt && next && <Muted>Next payment of {next.amount.amountFormatted} on {fmt(next.date)}.</Muted>}
      {isPaid && endsAt && <Muted>You keep {planName} features until {fmt(endsAt)}; you won&apos;t be charged again.</Muted>}
      {!isPaid && <Muted>You&apos;re on the Free plan. Upgrade for more projects, a stronger AI model and channel publishing.</Muted>}

      <div className="mt-4 flex flex-wrap gap-2">
        {(!isPaid || endsAt) && pro && (
          <CheckoutButton planId={pro.id} planPeriod="month" for="user" onSubscriptionComplete={() => void sub.revalidate()}>
            <Button>
              <Sparkles /> {endsAt ? "Resubscribe to Pro" : "Upgrade to Pro"}
            </Button>
          </CheckoutButton>
        )}
        {isPaid && !endsAt && (
          <Button variant="outline" onClick={() => setConfirming(true)}>
            Cancel plan
          </Button>
        )}
        <Button variant="ghost" onClick={() => open("pricing")}>
          Compare plans
        </Button>
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel your {planName} plan?</DialogTitle>
            <DialogDescription>
              You&apos;ll keep {planName} features until {fmt(item?.periodEnd)}. After that your account moves to Free, and you won&apos;t be charged again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Keep my plan
            </Button>
            <Button variant="destructive" disabled={cancelling} onClick={cancel}>
              {cancelling ? "Cancelling…" : "Cancel plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PaymentMethods() {
  const open = useWindowStore((s) => s.open);
  const methods = usePaymentMethods({ for: "user", pageSize: 10 });

  if (methods.isLoading) return <Muted>Loading payment methods…</Muted>;
  if (methods.isError) return <Muted>Payment methods aren&apos;t available yet.</Muted>;

  return (
    <>
      {methods.data.length === 0 ? (
        <Muted>No payment method on file. You&apos;ll add a card securely when you upgrade.</Muted>
      ) : (
        <ul className="divide-y rounded-xl border">
          {methods.data.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <CreditCard className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="font-medium capitalize">{m.cardType ?? "Card"}</span>
              <span className="text-muted-foreground">•••• {m.last4}</span>
              {m.expiryMonth && m.expiryYear && <span className="text-xs text-muted-foreground">exp {String(m.expiryMonth).padStart(2, "0")}/{String(m.expiryYear).slice(-2)}</span>}
              <div className="flex-1" />
              {m.isDefault && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">Default</span>}
            </li>
          ))}
        </ul>
      )}
      <Button className="mt-3" variant="outline" size="sm" onClick={() => open("account")}>
        Manage payment methods
      </Button>
    </>
  );
}

const STATUS: Record<string, { label: string; cls: string }> = {
  paid: { label: "Paid", cls: "bg-emerald-500/20" },
  pending: { label: "Pending", cls: "bg-amber-500/20" },
  failed: { label: "Failed", cls: "bg-destructive/20" },
};

function History() {
  const history = usePaymentAttempts({ for: "user", pageSize: 8 });

  if (history.isLoading) return <Muted>Loading billing history…</Muted>;
  if (history.isError) return <Muted>Billing history isn&apos;t available yet.</Muted>;
  if (history.data.length === 0) return <Muted>No transactions yet. Payments will appear here.</Muted>;

  return (
    <>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-semibold">Date</th>
              <th className="px-3 py-2 font-semibold">Description</th>
              <th className="px-3 py-2 text-right font-semibold">Amount</th>
              <th className="px-3 py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {history.data.map((p) => {
              const st = STATUS[p.status] ?? { label: p.status, cls: "bg-muted" };
              return (
                <tr key={p.id}>
                  <td className="whitespace-nowrap px-3 py-2">{fmt(p.paidAt ?? p.failedAt ?? p.updatedAt)}</td>
                  <td className="px-3 py-2">{p.subscriptionItem.plan.name} plan</td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.amount.amountFormatted}</td>
                  <td className="px-3 py-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", st.cls)}>{st.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {history.hasNextPage && (
        <Button className="mt-3" variant="outline" size="sm" onClick={() => history.fetchNext()}>
          Load more
        </Button>
      )}
    </>
  );
}

function BillingApp() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-5">
      <header>
        <h2 className="font-display text-xl font-bold">Plans &amp; Billing</h2>
        <p className="text-sm text-muted-foreground">Manage your subscription, payment method and invoices.</p>
      </header>
      <Card icon={Sparkles} title="Your plan">
        <CurrentPlan />
      </Card>
      <Card icon={CreditCard} title="Payment method">
        <PaymentMethods />
      </Card>
      <Card icon={Receipt} title="Billing history">
        <History />
      </Card>
    </div>
  );
}

export default function App() {
  return (
    <AuthGate>
      <BillingApp />
    </AuthGate>
  );
}

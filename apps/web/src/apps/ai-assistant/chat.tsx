"use client";

import type { BrandBriefResponse } from "@marketos/shared";
import { Copy, Eraser, SendHorizontal, Sparkles, Square, Workflow } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useWindowStore } from "@/desktop/window-store";
import { errorMessage } from "@/lib/api-client";
import { useContents, useUsage } from "@/lib/queries";
import { Markdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import { copyText } from "../content-studio/variant-card";
import { isQuotaError } from "../content-studio/use-generation";
import { ActionCard } from "./action-card";
import { useAssistant } from "./use-assistant";

const SUGGESTIONS = ["Plan 5 posts for next week", "Which approved posts aren't scheduled yet?", "Create an image for my latest post", "Add images from my library to a draft", "How could my Brand Brief be sharper?", "Rewrite my latest draft to be shorter"];

/** `enter`: trượt lên khi vừa gửi (chỉ tin đang gửi, không áp cho lịch sử tải về). */
function Bubble({ mine, bare, enter, delay = 0, children }: Readonly<{ mine: boolean; bare?: boolean; enter?: boolean; delay?: number; children: React.ReactNode }>) {
  return (
    <div
      // Bong bóng AI rộng cố định (không giật khi stream); `bare` bỏ khung (lúc đang Thinking).
      className={cn(
        "rounded-2xl text-sm",
        mine ? "max-w-[85%] self-end origin-bottom-right bg-primary px-3.5 py-2.5 text-primary-foreground" : "w-full origin-bottom-left",
        !mine && !bare && "border bg-card px-3.5 py-2.5",
        enter && "msg-in",
      )}
      style={enter ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}

export function Chat({ projectId, projectName, brief }: Readonly<{ projectId: string; projectName: string; brief: BrandBriefResponse }>) {
  const open = useWindowStore((s) => s.open);
  const { history, messages, pending, error, send, stop, clear, isSending } = useAssistant(projectId);
  const contents = useContents(projectId).data?.items ?? [];
  const usage = useUsage().data?.usage.assistant;
  const [draft, setDraft] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  // Cuộn xuống cuối khi có tin mới hoặc câu trả lời đang chạy; tải trang cũ hơn thì không cuộn.
  const last = messages.at(-1)?.id;
  // Thân hàm trong ngoặc nhọn: scrollIntoView có thể trả Promise, effect chỉ được trả hàm dọn dẹp.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [last, pending?.reply]);

  const submit = (text = draft) => {
    const content = text.trim();
    if (!content || isSending) return;
    setDraft("");
    void send(content);
  };

  const outOfQuota = !!usage && usage.used >= usage.limit;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <Sparkles className="size-4 text-primary" aria-hidden="true" />
        <h2 className="min-w-0 truncate font-display text-sm font-bold">Assistant for {projectName}</h2>
        <div className="flex-1" />
        {usage && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {usage.used} / {usage.limit} messages this month
          </span>
        )}
        {confirmClear ? (
          <Button
            size="sm"
            variant="destructive"
            disabled={clear.isPending}
            onBlur={() => setConfirmClear(false)}
            onClick={() =>
              clear.mutate(undefined, {
                onSettled: () => setConfirmClear(false),
              })
            }
          >
            Delete chat history?
          </Button>
        ) : (
          <Button size="sm" variant="ghost" disabled={!messages.length && !pending} onClick={() => setConfirmClear(true)}>
            <Eraser /> Clear
          </Button>
        )}
      </header>

      <div role="log" aria-live="polite" aria-label="Conversation" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {history.hasNextPage && (
          <Button size="sm" variant="outline" className="self-center" disabled={history.isFetchingNextPage} onClick={() => history.fetchNextPage()}>
            {history.isFetchingNextPage ? "Loading…" : "Load earlier messages"}
          </Button>
        )}
        {history.isPending && (
          <output className="block text-sm text-muted-foreground">
            Loading conversation…
          </output>
        )}
        {history.error && (
          <div className="text-sm">
            <p>{errorMessage(history.error)}</p>
            <Button className="mt-2" size="sm" variant="outline" onClick={() => history.refetch()}>
              Try again
            </Button>
          </div>
        )}

        {!history.isPending && !messages.length && !pending && (
          <div className="m-auto max-w-md text-center text-sm">
            <p className="font-semibold">Ask about {projectName}</p>
            <p className="mt-1 text-muted-foreground">
              The assistant knows this project&apos;s Brand Brief and recent posts. It can suggest drafts, edits, schedules and brief changes; nothing changes until you press Apply.
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <Button key={s} size="sm" variant="outline" disabled={outOfQuota} onClick={() => submit(s)}>
                  {s}
                </Button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <Bubble key={m.id} mine>
              <p className="whitespace-pre-wrap">{m.content}</p>
            </Bubble>
          ) : (
            <div key={m.id} className="flex w-2/3 flex-col gap-2 self-start">
              <Bubble mine={false}>
                {m.automationId && (
                  <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                    <Workflow className="size-3" aria-hidden="true" /> From an automation
                  </p>
                )}
                <Markdown text={m.content} />
                <Button size="xs" variant="ghost" className="mt-1 -ml-2 text-muted-foreground" onClick={() => copyText(m.content)}>
                  <Copy /> Copy
                </Button>
              </Bubble>
              {m.actions.map((a) => (
                <ActionCard key={a.id} projectId={projectId} messageId={m.id} action={a} contents={contents} brief={brief} />
              ))}
            </div>
          ),
        )}

        {pending && (
          <>
            <Bubble mine enter>
              <p className="whitespace-pre-wrap">{pending.content}</p>
            </Bubble>
            <div className="flex w-2/3 flex-col self-start">
              <Bubble mine={false} bare={!pending.reply} enter delay={0.18}>
                {pending.reply ? (
                  <>
                    <Markdown text={pending.reply} />
                    <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary align-middle" aria-hidden="true" />
                  </>
                ) : (
                  <output aria-label="Thinking" className="flex items-center gap-2">
                    <span className="flex gap-1" aria-hidden="true">
                      {["#7C5CFF", "#FF7AC6", "#2DD4BF"].map((c, i) => (
                        <span
                          key={c}
                          className="think-dot size-2 rounded-full"
                          style={{
                            background: c,
                            animationDelay: `${i * 0.15}s`,
                          }}
                        />
                      ))}
                    </span>
                    <span className="think-text font-medium" aria-hidden="true">
                      Thinking
                    </span>
                  </output>
                )}
              </Bubble>
            </div>
          </>
        )}

        {error !== null && (
          <div role="alert" className="self-start rounded-xl border-2 border-destructive/40 bg-destructive/10 p-3 text-sm">
            <p className="font-semibold">{isQuotaError(error) ? "You've used this month's assistant messages" : "The assistant couldn't reply"}</p>
            <p className="mt-1">{isQuotaError(error) ? "Your messages reset at the start of next month (UTC)." : errorMessage(error)}</p>
          </div>
        )}
        <div ref={end} />
      </div>

      <form
        className="flex items-end gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Textarea
          aria-label="Message"
          value={draft}
          rows={2}
          maxLength={4000}
          disabled={outOfQuota}
          placeholder={outOfQuota ? "You've used this month's messages." : "Ask anything, or ask for drafts, edits or a schedule… (Enter to send, Shift+Enter for a new line)"}
          className="max-h-40 min-h-0 resize-none"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {isSending ? (
          <Button type="button" variant="outline" onClick={stop}>
            <Square /> Stop
          </Button>
        ) : (
          <Button type="submit" disabled={!draft.trim() || outOfQuota}>
            <SendHorizontal /> Send
          </Button>
        )}
      </form>
      {outOfQuota && (
        <p className="px-3 pb-2 text-xs text-muted-foreground">
          Limit reached for this month.{" "}
          <button type="button" className="underline" onClick={() => open("plans-billing")}>
            See usage
          </button>
        </p>
      )}
    </div>
  );
}

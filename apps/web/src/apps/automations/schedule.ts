import type { Automation, AutomationSchedule } from "@marketos/shared";

export const TYPES: Record<Automation["type"], { label: string; blurb: string }> = {
  write_posts: { label: "Write posts", blurb: "Writes new drafts from your Brand Brief. They wait in Needs review for you." },
  schedule_ready: { label: "Schedule approved posts", blurb: "Puts approved posts without a date into your chosen time slots." },
  weekly_report: { label: "Weekly report", blurb: "Sends a summary of done, scheduled and waiting posts to the project's AI Assistant chat." },
  custom_prompt: { label: "Custom instruction", blurb: "Runs your instruction as an assistant message. Drafts are saved for review; other suggestions wait for Apply." },
};

// 0 = Chủ nhật, theo contract backend.
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const SUFFIX: Record<string, string> = { one: "st", two: "nd", few: "rd", other: "th" };
const ordinal = (n: number) => `${n}${SUFFIX[new Intl.PluralRules("en-US", { type: "ordinal" }).select(n)]}`;

function when(s: AutomationSchedule): string {
  if (s.frequency === "monthly") return `Monthly on the ${ordinal(s.dayOfMonth)}`;
  if (s.frequency === "daily" || s.weekdays.length === 7) return "Every day";
  const days = [...s.weekdays].sort((a, b) => a - b).map((d) => WEEKDAYS[d]);
  return `Every ${days.join(", ")}`;
}

/** Lịch dạng chữ, vd. "Every Mon, Thu at 09:00 (Asia/Ho_Chi_Minh)". */
export function describeSchedule(s: AutomationSchedule): string {
  return `${when(s)} at ${s.time} (${s.timezone})`;
}

export const deviceTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

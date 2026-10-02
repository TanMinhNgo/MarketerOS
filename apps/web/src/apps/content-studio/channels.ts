import type { GeneratedVariant } from "@marketos/shared";

export const CHANNELS = [
  { value: "FACEBOOK", label: "Facebook" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "LINKEDIN", label: "LinkedIn" },
  { value: "YOUTUBE", label: "YouTube" },
  { value: "EMAIL", label: "Email" },
  { value: "BLOG", label: "Blog" },
] as const;

export type ChannelValue = (typeof CHANNELS)[number]["value"];

export const channelLabel = (value: string) => CHANNELS.find((c) => c.value === value)?.label ?? value;

/** Văn bản sẵn sàng để dán: tiêu đề, nội dung, hashtag và CTA. */
export function variantToText(v: Partial<GeneratedVariant>): string {
  return [v.title, v.body, v.hashtags?.length ? v.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ") : "", v.cta]
    .filter((part): part is string => !!part && part.trim().length > 0)
    .join("\n\n");
}

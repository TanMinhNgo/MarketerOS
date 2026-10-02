"use client";

import type { ContentResponse } from "@marketos/shared";
import { TriangleAlert } from "lucide-react";

export const APPROVE_CHECKS = [
  "Facts, prices, dates and numbers are correct",
  "Tone and wording fit the brand",
  "Links, offers and calls to action are right",
  "Meets the channel's rules (length, disclosures, paid promotion)",
] as const;

/** Placeholder AI để lại cho người dùng điền, ví dụ `[Địa chỉ doanh nghiệp]`, `{{unsubscribe_link}}`. */
export const findPlaceholders = (item: Pick<ContentResponse, "title" | "body" | "cta">) => [
  ...new Set(`${item.title}\n${item.body}\n${item.cta ?? ""}`.match(/\[[^\]\n]{1,60}\]|\{\{[^}\n]{1,60}\}\}/g) ?? []),
];

/** Danh sách kiểm tra trước khi duyệt; `value[i]` là ô thứ i đã tích. */
export function ApproveChecklist({ item, value, onChange }: { item: Pick<ContentResponse, "title" | "body" | "cta">; value: boolean[]; onChange: (v: boolean[]) => void }) {
  const placeholders = findPlaceholders(item);
  return (
    <fieldset className="space-y-2 rounded-lg border p-3">
      <legend className="px-1 text-xs font-semibold">Before approving, confirm:</legend>
      {placeholders.length > 0 && (
        <p role="note" className="flex items-start gap-2 rounded-md bg-amber-500/10 p-2 text-xs">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            Still has placeholders to fill in before posting: <strong>{placeholders.join(", ")}</strong>
          </span>
        </p>
      )}
      {APPROVE_CHECKS.map((label, i) => (
        <label key={label} className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1 accent-primary" checked={!!value[i]} onChange={(e) => onChange(APPROVE_CHECKS.map((_, j) => (j === i ? e.target.checked : !!value[j])))} />
          {label}
        </label>
      ))}
    </fieldset>
  );
}

export const allChecked = (value: boolean[]) => APPROVE_CHECKS.every((_, i) => value[i]);

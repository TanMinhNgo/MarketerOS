"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  value: string[];
  onChange: (value: string[]) => void;
  max?: number;
}

/** Bảng màu thương hiệu: chọn màu rồi bấm Thêm; mỗi màu là mã #RRGGBB. */
export function ColorList({ value, onChange, max = 10 }: Props) {
  const [draft, setDraft] = useState("#6d5bff");
  const add = () => {
    const c = draft.toUpperCase();
    if (!value.some((v) => v.toUpperCase() === c) && value.length < max) onChange([...value, c]);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {value.map((c) => (
        <span key={c} className="flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2 text-xs font-medium">
          <span className="size-5 rounded-full border border-black/20" style={{ background: c }} />
          {c}
          <button type="button" aria-label={`Remove color ${c}`} onClick={() => onChange(value.filter((v) => v !== c))} className="rounded-sm hover:bg-black/10">
            <X className="size-3" />
          </button>
        </span>
      ))}
      {value.length < max && (
        <span className="flex items-center gap-1.5">
          <input type="color" aria-label="Pick a color" value={draft} onChange={(e) => setDraft(e.target.value)} className="h-8 w-9 rounded-md border bg-transparent p-0.5" />
          <Button type="button" variant="outline" size="sm" onClick={add}>
            <Plus /> Add color
          </Button>
        </span>
      )}
    </div>
  );
}

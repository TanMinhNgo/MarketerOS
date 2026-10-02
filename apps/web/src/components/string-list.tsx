"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  addLabel: string;
  max?: number;
}

/** Danh sách nhiều ô văn bản (vd. bài đăng mẫu): thêm, sửa, xoá từng dòng. */
export function StringList({ value, onChange, placeholder, addLabel, max = 10 }: Props) {
  return (
    <div className="space-y-2">
      {value.map((text, i) => (
        <div key={i} className="flex items-start gap-2">
          <Textarea value={text} placeholder={placeholder} rows={3} aria-label={`${addLabel} ${i + 1}`} onChange={(e) => onChange(value.map((t, j) => (j === i ? e.target.value : t)))} />
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove item ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
            <X />
          </Button>
        </div>
      ))}
      {value.length < max && (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, ""])}>
          <Plus /> {addLabel}
        </Button>
      )}
    </div>
  );
}

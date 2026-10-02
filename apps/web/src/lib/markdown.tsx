import { Fragment, type ReactNode } from "react";

// ponytail: chỉ phần Markdown model hay dùng (đoạn, danh sách, tiêu đề, **đậm**, *nghiêng*, `code`, link);
// cần bảng / code block nhiều dòng thì chuyển sang react-markdown.
// Lớp ký tự phủ định thay cho `.+?` để regex chạy tuyến tính (không backtrack).
const INLINE = /\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

/** Chữ đậm / nghiêng / code / link trong một dòng. Dựng React element, không dùng innerHTML. */
export function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = m.index;
    if (m[1]) out.push(<strong key={k}>{inline(m[1])}</strong>);
    else if (m[2]) out.push(<em key={k}>{inline(m[2])}</em>);
    else if (m[3]) out.push(<code key={k} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{m[3]}</code>);
    else out.push(<a key={k} href={m[5]} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">{m[4]}</a>);
    last = k + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const BULLET = /^\s*[-*•]\s+/;
const NUMBER = /^\s*\d+[.)]\s+/;
const HEADING = /^#{1,6}\s+/;

function listKind(line: string) {
  if (BULLET.test(line)) return BULLET;
  if (NUMBER.test(line)) return NUMBER;
  return null;
}

const isParagraphLine = (l: string) => !!l.trim() && !listKind(l) && !HEADING.test(l);

/** Các dòng liền nhau từ `start` thỏa `ok`; `n` là số dòng, dùng làm key. */
function take(lines: string[], start: number, ok: (l: string) => boolean) {
  const out: { n: number; line: string }[] = [];
  for (let n = start; n < lines.length && ok(lines[n]); n++) out.push({ n, line: lines[n] });
  return out;
}

/** Hiển thị Markdown của câu trả lời AI: đoạn cách nhau bằng dòng trống, danh sách, tiêu đề. */
export function Markdown({ text }: Readonly<{ text: string }>) {
  const blocks: ReactNode[] = [];
  const lines = text.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const list = listKind(line);
    if (!line.trim()) {
      i++;
    } else if (list) {
      const items = take(lines, i, (l) => list.test(l));
      const Tag = list === BULLET ? "ul" : "ol";
      blocks.push(
        <Tag key={i} className={list === BULLET ? "list-disc space-y-1 pl-5" : "list-decimal space-y-1 pl-5"}>
          {items.map(({ n, line }) => <li key={n}>{inline(line.replace(list, ""))}</li>)}
        </Tag>,
      );
      i += items.length;
    } else if (HEADING.test(line)) {
      blocks.push(<p key={i} className="font-semibold">{inline(line.replace(HEADING, ""))}</p>);
      i++;
    } else {
      // Gom các dòng liền nhau thành một đoạn, giữ xuống dòng.
      const para = take(lines, i, isParagraphLine);
      blocks.push(<p key={i}>{para.map(({ n, line }) => <Fragment key={n}>{n > i && <br />}{inline(line)}</Fragment>)}</p>);
      i += para.length;
    }
  }
  return <div className="space-y-2 break-words">{blocks}</div>;
}

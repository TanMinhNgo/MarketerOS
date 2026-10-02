import { Fragment, type ReactNode } from "react";

// ponytail: chỉ phần Markdown model hay dùng (đoạn, danh sách, tiêu đề, **đậm**, *nghiêng*, `code`, link);
// cần bảng / code block nhiều dòng thì chuyển sang react-markdown.
const INLINE = /\*\*(.+?)\*\*|__(.+?)__|\*(?!\s)(.+?)\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

/** Chữ đậm / nghiêng / code / link trong một dòng. Dựng React element, không dùng innerHTML. */
export function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = m.index;
    if (m[1] ?? m[2]) out.push(<strong key={k}>{inline(m[1] ?? m[2])}</strong>);
    else if (m[3]) out.push(<em key={k}>{inline(m[3])}</em>);
    else if (m[4]) out.push(<code key={k} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{m[4]}</code>);
    else out.push(<a key={k} href={m[6]} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">{m[5]}</a>);
    last = k + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const BULLET = /^\s*[-*•]\s+/;
const NUMBER = /^\s*\d+[.)]\s+/;
const HEADING = /^#{1,6}\s+/;

/** Hiển thị Markdown của câu trả lời AI: đoạn cách nhau bằng dòng trống, danh sách, tiêu đề. */
export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  for (let i = 0; i < lines.length; ) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const list = BULLET.test(line) ? BULLET : NUMBER.test(line) ? NUMBER : null;
    if (list) {
      const items: string[] = [];
      while (i < lines.length && list.test(lines[i])) items.push(lines[i++].replace(list, ""));
      const Tag = list === BULLET ? "ul" : "ol";
      blocks.push(
        <Tag key={i} className={list === BULLET ? "list-disc space-y-1 pl-5" : "list-decimal space-y-1 pl-5"}>
          {items.map((it, j) => <li key={j}>{inline(it)}</li>)}
        </Tag>,
      );
    } else if (HEADING.test(line)) {
      blocks.push(<p key={i} className="font-semibold">{inline(line.replace(HEADING, ""))}</p>);
      i++;
    } else {
      // Gom các dòng liền nhau thành một đoạn, giữ xuống dòng.
      const para: string[] = [];
      while (i < lines.length && lines[i].trim() && !BULLET.test(lines[i]) && !NUMBER.test(lines[i]) && !HEADING.test(lines[i])) para.push(lines[i++]);
      blocks.push(<p key={i}>{para.map((p, j) => <Fragment key={j}>{j > 0 && <br />}{inline(p)}</Fragment>)}</p>);
    }
  }
  return <div className="space-y-2 break-words">{blocks}</div>;
}

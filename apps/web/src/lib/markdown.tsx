import { Fragment, type ReactNode } from "react";

// ponytail: chỉ phần Markdown model hay dùng (đoạn, danh sách, tiêu đề, **đậm**, *nghiêng*, `code`, link);
// cần bảng / code block nhiều dòng thì chuyển sang react-markdown.
const CODE_CLASS = "rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]";
const LINK_CLASS = "text-primary underline underline-offset-2";
const HTTP_URL = /^https?:\/\/\S+$/;

/** Token inline bắt đầu tại `i`: [phần tử, vị trí ngay sau token], hoặc null nếu không phải token. */
// ponytail: quét bằng indexOf thay cho một regex lớn; dấu mở không có dấu đóng sẽ quét tới cuối dòng (O(n²) xấu nhất),
// chấp nhận được vì mỗi dòng của câu trả lời ngắn.
function token(text: string, i: number): [ReactNode, number] | null {
  const c = text[i];
  const next = text[i + 1];
  if (c === "`") {
    const end = text.indexOf("`", i + 1);
    return end > i + 1 ? [<code key={i} className={CODE_CLASS}>{text.slice(i + 1, end)}</code>, end + 1] : null;
  }
  if (c === "*" && next === "*") {
    const end = text.indexOf("**", i + 2);
    return end > i + 2 ? [<strong key={i}>{inline(text.slice(i + 2, end))}</strong>, end + 2] : null;
  }
  if (c === "*" && next?.trim()) {
    const end = text.indexOf("*", i + 1);
    return end > 0 ? [<em key={i}>{inline(text.slice(i + 1, end))}</em>, end + 1] : null;
  }
  if (c === "[") {
    const mid = text.indexOf("](", i + 1);
    const end = mid > i + 1 ? text.indexOf(")", mid + 2) : -1;
    const href = text.slice(mid + 2, end);
    if (end > 0 && HTTP_URL.test(href)) {
      return [<a key={i} href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>{text.slice(i + 1, mid)}</a>, end + 1];
    }
  }
  return null;
}

/** Chữ đậm / nghiêng / code / link trong một dòng. Dựng React element, không dùng innerHTML. */
export function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let plain = 0; // đầu đoạn chữ thường chưa đẩy vào `out`
  for (let i = 0; i < text.length; ) {
    const t = token(text, i);
    if (t) {
      if (i > plain) out.push(text.slice(plain, i));
      out.push(t[0]);
      i = plain = t[1];
    } else {
      i++;
    }
  }
  if (plain < text.length) out.push(text.slice(plain));
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
  return <div className="space-y-2 wrap-break-word">{blocks}</div>;
}

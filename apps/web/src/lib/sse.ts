export interface SseEvent {
  event: string;
  data: string;
}

/**
 * Bộ phân tích Server-Sent Events chạy theo từng mảnh văn bản: một sự kiện có thể bị cắt giữa chừng
 * giữa hai chunk mạng, nên giữ phần dư trong bộ đệm cho tới khi gặp dòng trống kết thúc sự kiện.
 */
export function createSseParser(onEvent: (e: SseEvent) => void) {
  let buffer = "";
  return (chunk: string) => {
    buffer += chunk.replace(/\r\n?/g, "\n");
    let end: number;
    while ((end = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      let event = "message";
      const data: string[] = [];
      for (const line of block.split("\n")) {
        if (!line || line.startsWith(":")) continue; // dòng trống hoặc comment
        const colon = line.indexOf(":");
        const field = colon === -1 ? line : line.slice(0, colon);
        const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
        if (field === "event") event = value;
        else if (field === "data") data.push(value);
      }
      if (data.length) onEvent({ event, data: data.join("\n") });
    }
  };
}

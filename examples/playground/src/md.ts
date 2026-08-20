/**
 * Minimal, dependency-free Markdown -> HTML renderer.
 * Supports the subset used by this playground's docs:
 * headings, fenced code, blockquotes, ul/ol lists, hr, bold, inline code,
 * links, and paragraphs. Everything else is escaped as plain text.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inline(s: string): string {
  const text = escapeHtml(s);
  return text
    .replace(/`([^`]+)`/g, (_m, c) => `<code>${c}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, u) => {
      const href = /^https?:\/\//.test(u) ? u : u;
      return `<a href="${href}" target="_blank" rel="noopener">${t}</a>`;
    });
}

export function renderMarkdown(src: string): string {
  const lines = src.split(/\r?\n/);
  const out: string[] = [];
  let buf: string[] = [];

  const flush = (): void => {
    if (buf.length > 0) {
      out.push(`<p>${inline(buf.join(" "))}</p>`);
      buf = [];
    }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;

    if (line.startsWith("```")) {
      flush();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith("```")) {
        code.push(lines[i]!);
        i++;
      }
      i++; // closing fence
      out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flush();
      const level = heading[1]!.length;
      out.push(`<h${level}>${inline(heading[2]!)}</h${level}>`);
      i++;
      continue;
    }

    if (/^\s*---\s*$/.test(line)) {
      flush();
      out.push("<hr/>");
      i++;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      flush();
      const quote: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i]!)) {
        quote.push(lines[i]!.replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${inline(quote.join(" "))}</blockquote>`);
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i]!)) {
        items.push(`<li>${inline(lines[i]!.replace(/^\s*[-*+]\s+/, ""))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (/^\s*\|/.test(line)) {
      flush();
      const rows: string[][] = [];
      const cells = (s: string): string[] =>
        s
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());
      while (i < lines.length && /^\s*\|/.test(lines[i]!)) {
        rows.push(cells(lines[i]!));
        i++;
      }
      const isSep = (row: string[]): boolean => row.every((c) => /^-{1,}$/.test(c));
      const head = rows.findIndex((r) => !isSep(r));
      const bodyStart = head === -1 ? 1 : head + 1;
      const thead = head !== -1 ? `<thead><tr>${rows[head]!.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>` : "";
      const tbody = rows
        .slice(bodyStart)
        .filter((r) => !isSep(r))
        .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
        .join("");
      out.push(`<table>${thead}<tbody>${tbody}</tbody></table>`);
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i]!)) {
        items.push(`<li>${inline(lines[i]!.replace(/^\s*\d+[.)]\s+/, ""))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    if (/^\s*$/.test(line)) {
      flush();
      i++;
      continue;
    }

    buf.push(line);
    i++;
  }
  flush();
  return out.join("\n");
}
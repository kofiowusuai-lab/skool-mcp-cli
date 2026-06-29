// Minimal Markdown to HTML converter targeted at Skool's tiptap/ProseMirror editor.
// Skool's editor accepts a pasted HTML fragment and maps it onto its own schema,
// so we only emit the block and inline shapes the editor understands: headings,
// bullet lists, ordered lists, paragraphs, and inline code.

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function inline(text: string): string {
  // Escape first, then restore inline code spans written with backticks.
  const escaped = escapeHtml(text);
  return escaped.replace(/`([^`]+)`/g, (_match, code) => `<code>${code}</code>`);
}

type ListKind = 'ul' | 'ol';

/**
 * Convert a Markdown body into an HTML fragment for Skool's editor.
 * Supported blocks: ATX headings (#..######), `-`/`*` bullet lists,
 * `N.` ordered lists, and paragraphs. Inline backtick code is preserved.
 */
export function markdownToTiptapHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let listKind: ListKind | null = null;
  const listItems: string[] = [];

  const flushList = (): void => {
    if (listKind && listItems.length > 0) {
      const items = listItems.map((item) => `<li><p>${item}</p></li>`).join('');
      html.push(`<${listKind}>${items}</${listKind}>`);
    }
    listKind = null;
    listItems.length = 0;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.length === 0) {
      flushList();
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushList();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      if (listKind && listKind !== 'ul') {
        flushList();
      }
      listKind = 'ul';
      listItems.push(inline(bullet[1]));
      continue;
    }

    const ordered = /^\d+\.\s+(.*)$/.exec(line);
    if (ordered) {
      if (listKind && listKind !== 'ol') {
        flushList();
      }
      listKind = 'ol';
      listItems.push(inline(ordered[1]));
      continue;
    }

    flushList();
    html.push(`<p>${inline(line)}</p>`);
  }

  flushList();
  return html.join('');
}

// Minimal Markdown -> HTML renderer, scoped to exactly the subset
// CHANGELOG.md actually uses (headers, bold/italic, inline code, links,
// bullet lists, horizontal rules, paragraphs). Not a general-purpose
// parser — pulling in a full Markdown library for one in-app changelog
// viewer would be a lot of weight for a single, controlled-content use
// case. See App.svelte's changelog panel.

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderInline(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return html;
}

export function renderMarkdown(source: string): string {
  const lines = source.split('\n');
  const htmlParts: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      htmlParts.push('</ul>');
      inList = false;
    }
  };

  for (const line of lines) {
    const headerMatch = /^(#{1,4})\s+(.*)$/.exec(line);
    const listMatch = /^-\s+(.*)$/.exec(line);

    if (headerMatch) {
      closeList();
      const [, hashes, headerText] = headerMatch;
      const level = hashes?.length ?? 1;
      htmlParts.push(`<h${String(level)}>${renderInline(headerText ?? '')}</h${String(level)}>`);
    } else if (listMatch) {
      if (!inList) {
        htmlParts.push('<ul>');
        inList = true;
      }
      htmlParts.push(`<li>${renderInline(listMatch[1] ?? '')}</li>`);
    } else if (/^-{3,}$/.test(line.trim())) {
      closeList();
      htmlParts.push('<hr />');
    } else if (line.trim() === '') {
      closeList();
    } else {
      closeList();
      htmlParts.push(`<p>${renderInline(line)}</p>`);
    }
  }
  closeList();

  return htmlParts.join('\n');
}

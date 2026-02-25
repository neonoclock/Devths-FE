function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatInline(value: string) {
  let output = value;

  output = output.replace(/`([^`]+)`/g, '<code class="md-inline">$1</code>');
  output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  output = output.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, href) => {
    if (href.startsWith('http://') || href.startsWith('https://')) {
      return `<a href="${href}" target="_blank" rel="noreferrer">${text}</a>`;
    }
    return match;
  });

  return output;
}

export function renderMarkdownToHtml(source: string) {
  const normalized = source.replace(/\r\n/g, '\n');
  const codeBlocks: string[] = [];

  let withPlaceholders = normalized.replace(/```([\s\S]*?)```/g, (_, code) => {
    const index = codeBlocks.push(code) - 1;
    return `@@CODEBLOCK_${index}@@`;
  });

  withPlaceholders = escapeHtml(withPlaceholders);

  const lines = withPlaceholders.split('\n');
  const htmlParts: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      htmlParts.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      htmlParts.push('</ol>');
      inOl = false;
    }
  };

  lines.forEach((line) => {
    const codeMatch = line.match(/@@CODEBLOCK_(\d+)@@/);
    if (codeMatch) {
      closeLists();
      const code = codeBlocks[Number(codeMatch[1])] ?? '';
      htmlParts.push(`<pre class="md-pre"><code>${escapeHtml(code.trimEnd())}</code></pre>`);
      return;
    }

    if (line.trim() === '') {
      closeLists();
      return;
    }

    if (line.startsWith('### ')) {
      closeLists();
      htmlParts.push(`<h3>${formatInline(line.slice(4))}</h3>`);
      return;
    }
    if (line.startsWith('## ')) {
      closeLists();
      htmlParts.push(`<h2>${formatInline(line.slice(3))}</h2>`);
      return;
    }
    if (line.startsWith('# ')) {
      closeLists();
      htmlParts.push(`<h1>${formatInline(line.slice(2))}</h1>`);
      return;
    }

    const olMatch = line.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      if (!inOl) {
        closeLists();
        htmlParts.push('<ol>');
        inOl = true;
      }
      htmlParts.push(`<li>${formatInline(olMatch[1])}</li>`);
      return;
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inUl) {
        closeLists();
        htmlParts.push('<ul>');
        inUl = true;
      }
      htmlParts.push(`<li>${formatInline(line.slice(2))}</li>`);
      return;
    }

    closeLists();
    htmlParts.push(`<p>${formatInline(line)}</p>`);
  });

  closeLists();

  return htmlParts.join('');
}

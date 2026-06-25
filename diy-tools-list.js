(function () {
  const grid = document.getElementById('toolsGrid');
  if (!grid || !window.DIY_TOOLS) return;

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  grid.innerHTML = window.DIY_TOOLS.map((tool) => {
    const image = tool.image
      ? `<img src="${escapeHtml(tool.image)}" alt="${escapeHtml(tool.imageAlt)}" loading="lazy">`
      : '<span class="tool-placeholder">写真準備中</span>';
    return `
      <a class="tool-card" href="diy-tool-${escapeHtml(tool.slug)}.html">
        <div class="tool-thumb">${image}</div>
        <div>
          <span class="badge">${escapeHtml(tool.category)}</span>
          <h2>${escapeHtml(tool.name)}</h2>
          <p>${escapeHtml(tool.uses.slice(0, 2).join('・'))}</p>
        </div>
      </a>
    `;
  }).join('');
})();

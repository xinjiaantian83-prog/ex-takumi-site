(function () {
  const tool = (window.DIY_TOOLS || []).find((item) => item.slug === window.DIY_TOOL_SLUG);
  const root = document.getElementById('toolDetail');
  if (!tool || !root) return;

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function list(items) {
    return `<ul class="list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  }

  const image = tool.image
    ? `<img src="${escapeHtml(tool.image)}" alt="${escapeHtml(tool.imageAlt)}" loading="lazy">`
    : '<div class="tool-placeholder">写真準備中<br>道具の状態はお問い合わせ時にご確認ください。</div>';

  document.title = `${tool.name}｜DIY貸出道具｜EXたくみ`;
  root.innerHTML = `
    <div class="label">DIY TOOL DETAIL</div>
    <h1 class="title">${escapeHtml(tool.name)}</h1>
    <p class="lead">資材購入者限定でご利用いただけるDIY応援サービスの貸出道具です。何に使う道具か、初心者の方にも分かりやすいように用途をまとめています。</p>

    <div class="detail-hero">
      <div class="tool-photo">${image}</div>
      <div class="detail-panel">
        <span class="badge">${escapeHtml(tool.category)}</span>
        <h2>この道具について</h2>
        <p>EXた組で資材をご購入いただいた方に向けた、DIYを進めやすくするためのサポート道具です。</p>
        <p>使い方や必要かどうか迷う場合も、写真や作業内容を送っていただければ現場目線で確認します。</p>
      </div>
    </div>

    <div class="content-grid">
      <section class="info-card">
        <h2>用途</h2>
        ${list(tool.uses)}
      </section>
      <section class="info-card">
        <h2>おすすめの使用場面</h2>
        ${list(tool.scenes)}
      </section>
    </div>

    <section class="conditions">
      <h2>貸出条件</h2>
      <p>資材購入者限定サービスです。</p>
      <p>詳しい貸出内容・ご利用条件はお問い合わせください。</p>
      <div class="btn-row">
        <a href="diy.html" class="btn">DIY応援トップへ戻る</a>
        <a href="diy-tools.html" class="btn">貸出道具一覧へ戻る</a>
      </div>
    </section>
  `;
})();

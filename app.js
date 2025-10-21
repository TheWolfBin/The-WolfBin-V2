function renderAdItem(item) {
  if (!item || !item.type) return "";
  if (item.type === "html") {
    return `<div class="ad-box">${item.content}</div>`;
  }
  if (item.type === "image") {
    const alt = item.title || "Anuncio";
    const href = item.href || "#";
    // escape attributes minimally
    return `<div class="ad-box text-center"><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(item.src)}" alt="${escapeHtml(alt)}" style="max-width:100%"></a></div>`;
  }
  if (item.type === "link") {
    const title = item.title || "Enlace";
    const href = item.href || "#";
    const desc = item.content || "";
    // Si el objeto link incluye src, mostrar la imagen dentro del enlace
    if (item.src) {
      return `<div class="ad-box text-center"><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(item.src)}" alt="${escapeHtml(title)}" style="max-width:100%"></a></div>`;
    }
    return `<div class="ad-box"><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(title)}</strong></a><div class="small text-muted">${escapeHtml(desc)}</div></div>`;
  }
  return "";
}
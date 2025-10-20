// Admin UI para editar ads.json en el repo usando la API de GitHub.
// ADVERTENCIA: el token nunca se guarda en el servidor; se usa solo en memoria del navegador.

const loadBtn = document.getElementById("loadBtn");
const saveBtn = document.getElementById("saveBtn");
const previewBtn = document.getElementById("previewBtn");
const repoInput = document.getElementById("repoInput");
const branchInput = document.getElementById("branchInput");
const tokenInput = document.getElementById("tokenInput");
const adsEditor = document.getElementById("adsEditor");
const adminStatus = document.getElementById("adminStatus");
const previewArea = document.getElementById("previewArea");

const FILE_PATH = "ads.json";

async function githubGetContents(ownerRepo, path, branch, token) {
  const url = `https://api.github.com/repos/${ownerRepo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
  const resp = await fetch(url, {
    headers: { Authorization: token ? `token ${token}` : undefined, Accept: "application/vnd.github.v3+json" }
  });
  if (!resp.ok) throw new Error(`GitHub GET error ${resp.status}`);
  return resp.json();
}

async function githubPutContents(ownerRepo, path, branch, token, contentB64, message, sha) {
  const url = `https://api.github.com/repos/${ownerRepo}/contents/${encodeURIComponent(path)}`;
  const body = {
    message,
    content: contentB64,
    branch
  };
  if (sha) body.sha = sha;
  const resp = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`GitHub PUT error ${resp.status}: ${txt}`);
  }
  return resp.json();
}

loadBtn.addEventListener("click", async () => {
  adminStatus.textContent = "Cargando ads.json desde repo...";
  try {
    const repo = repoInput.value.trim();
    if (!repo) throw new Error("Rellena owner/repo");
    const branch = branchInput.value.trim() || "main";
    const token = tokenInput.value.trim() || null;
    const data = await githubGetContents(repo, FILE_PATH, branch, token);
    const content = atob(data.content.replace(/\n/g, ""));
    adsEditor.value = content;
    adminStatus.textContent = "Cargado. Puedes editar y guardar.";
    adsEditor.dataset.sha = data.sha;
  } catch (err) {
    adminStatus.textContent = "Error: " + err.message;
  }
});

saveBtn.addEventListener("click", async () => {
  adminStatus.textContent = "Guardando en repo...";
  try {
    const repo = repoInput.value.trim();
    const branch = branchInput.value.trim() || "main";
    const token = tokenInput.value.trim();
    if (!repo || !token) throw new Error("Repo y token son requeridos para guardar.");
    const content = adsEditor.value;
    JSON.parse(content);
    const contentB64 = btoa(unescape(encodeURIComponent(content)));
    const sha = adsEditor.dataset.sha;
    const message = "Actualiza ads.json desde admin UI";
    const res = await githubPutContents(repo, FILE_PATH, branch, token, contentB64, message, sha);
    adminStatus.textContent = "Guardado con éxito. Commit: " + res.commit.sha;
    adsEditor.dataset.sha = res.content.sha;
  } catch (err) {
    adminStatus.textContent = "Error: " + err.message;
  }
});

previewBtn.addEventListener("click", () => {
  try {
    const obj = JSON.parse(adsEditor.value);
    previewArea.innerHTML = `<div class="row"><div class="col-md-6"><h6>Left</h6>${renderPreviewColumn(obj.left)}</div><div class="col-md-6"><h6>Right</h6>${renderPreviewColumn(obj.right)}</div></div>`;
  } catch (err) {
    previewArea.innerHTML = `<div class="alert alert-danger">JSON inválido: ${err.message}</div>`;
  }
});

function renderPreviewColumn(arr) {
  if (!arr || !arr.length) return `<div class="ad-box small text-muted">Sin anuncios</div>`;
  return arr.map(item => {
    if (item.type === "html") return `<div class="ad-box">${item.content}</div>`;
    if (item.type === "image") return `<div class="ad-box text-center"><img src="${item.src}" style="max-width:100%"></div>`;
    if (item.type === "link") return `<div class="ad-box"><strong>${item.title}</strong><div class="small text-muted">${item.content || ""}</div></div>`;
    return "";
  }).join("");
}
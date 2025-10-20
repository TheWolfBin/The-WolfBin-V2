// The WolfBin - frontend logic (actualizado)
// IMPORTANT: reemplaza API_BASE con la URL de tu Worker antes de desplegar.
const API_BASE = "https://REPLACE_WITH_YOUR_WORKER.workers.dev"; // <- reemplaza esto

// Construir la URL correcta de ads.json relativa al sitio actual
// Esto funciona tanto si publicas en https://username.github.io/REPO/ como en root.
const ADS_JSON_URL = new URL('ads.json', location.href).toString();
// Para forzar no usar caché (opcional): const ADS_JSON_URL = new URL('ads.json', location.href).toString() + '?v=' + Date.now();

/* -------------------- Ads loader -------------------- */
async function loadAds() {
  try {
    const resp = await fetch(ADS_JSON_URL, { cache: "no-cache" });
    if (!resp.ok) {
      console.warn('ads.json fetch not ok:', resp.status, resp.statusText, ADS_JSON_URL);
      renderDefaultAds();
      return;
    }
    const ads = await resp.json();
    renderAds(ads);
  } catch (err) {
    console.warn("No se pudieron cargar ads.json:", err, ADS_JSON_URL);
    renderDefaultAds();
  }
}
function renderDefaultAds() {
  const defaultHtml = `
    <div class="ad-box">
      <h6>Anuncio</h6>
      <p>Coloca aquí tus anuncios. Edita ads.json o usa la página Admin.</p>
    </div>`;
  const left = document.getElementById("ads-left");
  const right = document.getElementById("ads-right");
  if (left) left.innerHTML = defaultHtml;
  if (right) right.innerHTML = defaultHtml;
}
function renderAds(ads) {
  const leftHtml = (ads.left || []).map(renderAdItem).join("\n") || `<div class="ad-box small text-muted">Sin anuncios</div>`;
  const rightHtml = (ads.right || []).map(renderAdItem).join("\n") || `<div class="ad-box small text-muted">Sin anuncios</div>`;
  const left = document.getElementById("ads-left");
  const right = document.getElementById("ads-right");
  if (left) left.innerHTML = leftHtml;
  if (right) right.innerHTML = rightHtml;
}
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
    return `<div class="ad-box"><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(title)}</strong></a><div class="small text-muted">${escapeHtml(desc)}</div></div>`;
  }
  return "";
}
function escapeHtml(s) {
  if (!s) return "";
  return String(s).replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]; });
}

/* -------------------- WebCrypto helpers & paste logic -------------------- */
async function randomBytes(len) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return arr;
}
function bufToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function base64ToBuf(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}
async function deriveKeyFromPassword(password, salt, iterations = 200000) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {name:"PBKDF2", salt, iterations, hash:"SHA-256"},
    keyMaterial,
    {name:"AES-GCM", length:256},
    true,
    ["encrypt", "decrypt"]
  );
}
async function aesGcmEncrypt(key, plaintext) {
  const iv = await randomBytes(12);
  const enc = new TextEncoder();
  const pt = typeof plaintext === "string" ? enc.encode(plaintext) : plaintext;
  const ct = await crypto.subtle.encrypt({name:"AES-GCM", iv}, key, pt);
  return {iv: bufToBase64(iv), ct: bufToBase64(ct)};
}
async function aesGcmDecrypt(key, iv_b64, ct_b64) {
  const iv = base64ToBuf(iv_b64);
  const ct = base64ToBuf(ct_b64);
  const plain = await crypto.subtle.decrypt({name:"AES-GCM", iv}, key, ct);
  const dec = new TextDecoder();
  return dec.decode(plain);
}
async function generateContentKey() {
  return crypto.subtle.generateKey({name:"AES-GCM", length:256}, true, ["encrypt","decrypt"]);
}
async function exportKeyToRawB64(key) {
  const raw = await crypto.subtle.exportKey("raw", key);
  return bufToBase64(raw);
}
async function importKeyFromRawB64(b64) {
  const raw = base64ToBuf(b64);
  return crypto.subtle.importKey("raw", raw, {name:"AES-GCM", length:256}, true, ["encrypt","decrypt"]);
}

/* -------------------- UI & bindings -------------------- */
const pasteContent = document.getElementById("pasteContent");
const mdPreview = document.getElementById("mdPreview");
const encryptCreateBtn = document.getElementById("encryptCreateBtn");
const createStatus = document.getElementById("createStatus");
const pasteUrl = document.getElementById("pasteUrl");
const openBtn = document.getElementById("openBtn");
const openStatus = document.getElementById("openStatus");
const contentArea = document.getElementById("contentArea");
const passwordInput = document.getElementById("password");
const readPassword = document.getElementById("readPassword");
const expiresSelect = document.getElementById("expires");
const burnAfterRead = document.getElementById("burnAfterRead");
const qrContainer = document.getElementById("qrContainer");
const downloadBtn = document.getElementById("downloadBtn");
const copyBtn = document.getElementById("copyBtn");
const fileInput = document.getElementById("fileInput");
const attachBtn = document.getElementById("attachBtn");
const templateSelect = document.getElementById("templateSelect");

let lastPlaintext = null;
let lastFilename = "paste.txt";

if (pasteContent) {
  pasteContent.addEventListener("input", () => {
    const md = pasteContent.value;
    if (mdPreview) mdPreview.innerHTML = typeof marked !== "undefined" ? marked.parse(md) : md;
    PR && PR.prettyPrint && PR.prettyPrint();
  });
}

/* Attach file -> embed as data in paste */
if (attachBtn && fileInput) {
  attachBtn.addEventListener("click", async () => {
    const f = fileInput.files[0];
    if (!f) { alert("Selecciona un archivo"); return; }
    if (f.size > 10 * 1024 * 1024) { if (!confirm("Archivo mayor a 10MB, continuar?")) return; }
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result.split(",")[1];
      pasteContent.value = `<!-- file:${f.name};type:${f.type} -->\n` + b64;
      pasteContent.dispatchEvent(new Event("input"));
      lastFilename = f.name;
    };
    reader.readAsDataURL(f);
  });
}

/* Create encrypted paste and POST to API */
if (encryptCreateBtn) {
  encryptCreateBtn.addEventListener("click", async () => {
    if (!API_BASE || API_BASE.includes("REPLACE_WITH_YOUR_WORKER")) {
      createStatus.textContent = "Error: API_BASE no configurado. Edita app.js y coloca la URL de tu Worker.";
      return;
    }
    createStatus.textContent = "Generando claves y cifrando...";
    try {
      const content = pasteContent.value || "";
      lastPlaintext = content;
      const contentKey = await generateContentKey();
      const exportedContentKey = await exportKeyToRawB64(contentKey);

      // Cifra contenido
      const encRes = await aesGcmEncrypt(contentKey, content);

      // Si hay contraseña, cifra la key de contenido con derived key
      let encryptedKeyBlob = null;
      let saltB64 = null;
      const pwd = passwordInput.value;
      if (pwd && pwd.length > 0) {
        const salt = await randomBytes(16);
        saltB64 = bufToBase64(salt);
        const derived = await deriveKeyFromPassword(pwd, salt);
        const rawCk = base64ToBuf(await exportKeyToRawB64(contentKey));
        const ivForKey = await randomBytes(12);
        const ckEnc = await crypto.subtle.encrypt({name:"AES-GCM", iv: ivForKey}, derived, rawCk);
        encryptedKeyBlob = `${bufToBase64(ivForKey)}:${bufToBase64(ckEnc)}`;
      }

      const expiresSeconds = Number(expiresSelect.value || 0);
      const expiresAt = expiresSeconds === 0 ? 0 : Math.floor(Date.now()/1000) + expiresSeconds;
      const meta = {
        iv: encRes.iv,
        ct: encRes.ct,
        filename: lastFilename,
        contentType: "text/plain",
        template: templateSelect ? templateSelect.value : null,
        createdAt: Math.floor(Date.now()/1000),
        expiresAt,
        burnAfterRead: burnAfterRead ? burnAfterRead.checked : false,
        encryptedKeyBlob,
        saltB64
      };

      const includeKeyInUrl = !pwd || pwd.length === 0;

      const resp = await fetch(`${API_BASE.replace(/\/$/, "")}/paste`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(meta)
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(()=>"");
        throw new Error("Error al almacenar en servidor: " + resp.status + " " + txt);
      }
      const json = await resp.json();
      const id = json.id;
      let shareUrl;
      if (includeKeyInUrl) {
        shareUrl = `${location.origin}${location.pathname}#${id}:${exportedContentKey}`;
      } else {
        shareUrl = `${location.origin}${location.pathname}#${id}`;
      }
      createStatus.innerHTML = `Paste creado. <a target="_blank" rel="noopener noreferrer" href="${shareUrl}">Abrir paste</a>`;
      if (qrContainer) { qrContainer.innerHTML = ""; QRCode.toCanvas(qrContainer, shareUrl, {width:160}, (err) => {}); }
      navigator.clipboard?.writeText(shareUrl).catch(()=>{});
    } catch (err) {
      console.error(err);
      createStatus.textContent = "Error: " + (err.message || err);
    }
  });
}

/* Open paste logic */
if (openBtn) {
  openBtn.addEventListener("click", async () => {
    openStatus.textContent = "Consultando servidor...";
    if (contentArea) contentArea.textContent = "";
    try {
      let raw = pasteUrl.value.trim();
      if (!raw) { openStatus.textContent = "Pega la URL del paste"; return; }

      let id, keyB64FromFragment = null;
      try {
        const u = new URL(raw);
        if (u.hash && u.hash.startsWith("#")) {
          const frag = u.hash.slice(1);
          if (frag.includes(":")) {
            [id, keyB64FromFragment] = frag.split(":");
          } else {
            id = frag;
          }
        } else {
          const parts = raw.split("#");
          if (parts.length>1) {
            const frag = parts[1];
            if (frag.includes(":")) [id, keyB64FromFragment] = frag.split(":");
            else id = frag;
          } else {
            id = raw;
          }
        }
      } catch (e) {
        if (raw.includes(":")) [id, keyB64FromFragment] = raw.split(":");
        else id = raw;
      }

      const resp = await fetch(`${API_BASE.replace(/\/$/, "")}/paste/${encodeURIComponent(id)}`);
      if (resp.status === 404) { openStatus.textContent = "No encontrado o expirado."; return; }
      if (!resp.ok) throw new Error("Error servidor: " + resp.status);
      const meta = await resp.json();

      let contentKey;
      if (keyB64FromFragment) {
        contentKey = await importKeyFromRawB64(keyB64FromFragment);
      } else {
        if (!meta.encryptedKeyBlob) {
          openStatus.textContent = "Este paste requiere la clave en la URL o la contraseña correcta.";
          return;
        }
        const pwd = readPassword.value;
        if (!pwd) { openStatus.textContent = "Ingresa la contraseña para descifrar la clave."; return; }
        const salt = base64ToBuf(meta.saltB64);
        const derived = await deriveKeyFromPassword(pwd, salt);
        const parts = meta.encryptedKeyBlob.split(":");
        if (parts.length !== 2) throw new Error("Formato de encryptedKeyBlob inesperado");
        const iv_b64 = parts[0], ct_b64 = parts[1];
        const rawKey = await crypto.subtle.decrypt({name:"AES-GCM", iv: base64ToBuf(iv_b64)}, derived, base64ToBuf(ct_b64));
        const b64raw = bufToBase64(rawKey);
        contentKey = await importKeyFromRawB64(b64raw);
      }

      const plaintext = await aesGcmDecrypt(contentKey, meta.iv, meta.ct);
      lastPlaintext = plaintext;
      lastFilename = meta.filename || "paste.txt";

      if (contentArea) {
        if (plaintext.startsWith("<!-- file:")) {
          const headerLine = plaintext.split("\n",1)[0];
          const match = headerLine.match(/<!-- file:([^;]+);type:([^ ]+) -->/);
          if (match) {
            const name = match[1], mime = match[2];
            const b64 = plaintext.slice(plaintext.indexOf("\n")+1).trim();
            const blob = base64ToBuf(b64);
            const blobObj = new Blob([blob], {type: mime});
            const url = URL.createObjectURL(blobObj);
            if (mime.startsWith("image/")) {
              contentArea.innerHTML = `<img src="${url}" alt="${name}" style="max-width:100%">`;
            } else if (mime === "application/pdf") {
              contentArea.innerHTML = `<iframe src="${url}" style="width:100%;height:400px;border:0"></iframe>`;
            } else {
              contentArea.innerHTML = `<a href="${url}" download="${name}">Descargar ${name}</a>`;
            }
          } else {
            contentArea.textContent = plaintext;
          }
        } else {
          contentArea.innerHTML = typeof marked !== "undefined" ? marked.parse(plaintext) : plaintext;
          PR && PR.prettyPrint && PR.prettyPrint();
        }
      }

      if (meta.burnAfterRead && openStatus) {
        openStatus.textContent = "Leído: este paste fue quemado según la configuración.";
      } else if (openStatus) {
        openStatus.textContent = "Leído correctamente.";
      }

      if (qrContainer) {
        qrContainer.innerHTML = "";
        QRCode.toCanvas(qrContainer, raw, {width:160}, (err) => {});
      }
    } catch (err) {
      console.error(err);
      openStatus.textContent = "Error: " + (err.message || err);
    }
  });
}

/* Copy & download helpers */
if (copyBtn) {
  copyBtn.addEventListener("click", async () => {
    if (!lastPlaintext) return;
    await navigator.clipboard.writeText(lastPlaintext);
  });
}
if (downloadBtn) {
  downloadBtn.addEventListener("click", () => {
    if (!lastPlaintext) return;
    const blob = new Blob([lastPlaintext], {type:"text/plain"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = lastFilename || "paste.txt";
    a.click();
  });
}

/* Init on load */
window.addEventListener("load", () => {
  // If the page was loaded with an anchor containing id:key, populate pasteUrl so the user can open quickly.
  if (location.hash && location.hash.length > 1) {
    const fullUrl = location.href;
    const pasteUrlInput = document.getElementById("pasteUrl");
    if (pasteUrlInput) pasteUrlInput.value = fullUrl;
  }
  // Load ads (relative URL)
  loadAds();
});
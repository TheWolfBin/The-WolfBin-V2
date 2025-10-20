/**
 * Ejemplo Cloudflare Worker para almacenar blobs cifrados en KV.
 * Requiere binding KV: WOLFBIN en el entorno del Worker.
 *
 * POST /paste  -> { id: string }   (cuerpo JSON con meta: iv, ct, filename, createdAt, expiresAt, burnAfterRead, encryptedKeyBlob?, saltB64?)
 * GET  /paste/:id -> retorna JSON meta (y borra si burnAfterRead)
 *
 * El Worker NUNCA intenta descifrar datos.
 */

const ALLOWED_ORIGIN = "https://REPLACE_WITH_YOUR_GITHUB_PAGES_URL"; // <-- reemplaza por tu URL GitHub Pages (ej: https://thewolfbin.github.io)

function jsonResponse(obj, code=200) {
  return new Response(JSON.stringify(obj), {
    status: code,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

async function handleOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

function generateId(len = 12) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  const arr = crypto.getRandomValues(new Uint8Array(len));
  for (let i=0;i<len;i++) out += chars[arr[i] % chars.length];
  return out;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return handleOptions();

    try {
      if (request.method === "POST" && url.pathname === "/paste") {
        const body = await request.json();
        if (!body || !body.iv || !body.ct) {
          return jsonResponse({error:"invalid body"}, 400);
        }
        let id = generateId(12);
        // evitar colisiones
        let tries = 0;
        while (tries < 5 && await env.WOLFBIN.get(id)) {
          id = generateId(12); tries++;
        }
        const payload = {
          iv: body.iv,
          ct: body.ct,
          filename: body.filename || "paste.txt",
          contentType: body.contentType || "text/plain",
          template: body.template || null,
          createdAt: body.createdAt || Math.floor(Date.now()/1000),
          expiresAt: body.expiresAt || 0,
          burnAfterRead: !!body.burnAfterRead,
          encryptedKeyBlob: body.encryptedKeyBlob || null,
          saltB64: body.saltB64 || null
        };
        const ttl = payload.expiresAt > 0 ? payload.expiresAt - Math.floor(Date.now()/1000) : 0;
        if (ttl > 0) {
          await env.WOLFBIN.put(id, JSON.stringify(payload), {expirationTtl: ttl});
        } else {
          await env.WOLFBIN.put(id, JSON.stringify(payload));
        }
        return jsonResponse({id});
      }

      if (request.method === "GET" && url.pathname.startsWith("/paste/")) {
        const id = decodeURIComponent(url.pathname.split("/").pop());
        const raw = await env.WOLFBIN.get(id);
        if (!raw) return jsonResponse({error:"not found"}, 404);
        const meta = JSON.parse(raw);
        if (meta.expiresAt > 0 && meta.expiresAt <= Math.floor(Date.now()/1000)) {
          await env.WOLFBIN.delete(id);
          return jsonResponse({error:"expired"}, 404);
        }
        if (meta.burnAfterRead) {
          await env.WOLFBIN.delete(id);
        }
        return jsonResponse(meta);
      }

      return jsonResponse({error:"not found"}, 404);
    } catch (err) {
      return jsonResponse({error: err.message || String(err)}, 500);
    }
  }
}
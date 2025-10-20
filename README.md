```markdown
# The WolfBin — Deploy listo para GitHub Pages + Cloudflare Worker (storage)

Contenido:
- index.html, app.js, styles.css: frontend con cifrado AES-256-GCM y sidebars de anuncios.
- admin.html, admin.js: editor para ads.json (usa GitHub API).
- ads.json: ejemplo de anuncios.
- worker.js: Cloudflare Worker (almacena blobs cifrados en KV).
- wrangler.toml: ejemplo para desplegar Worker.

Pasos para subir a tu repo (The-WolfBin-V2)
1. Clona tu repo (o crea uno si no existe):
   - git clone git@github.com:TheWolfBin/The-WolfBin-V2.git
   - cd The-WolfBin-V2

2. Crea los archivos (copia los contenidos de este README) o pega los archivos que te di.

3. Commit y push:
   - git add .
   - git commit -m "Add WolfBin frontend, admin, ads, worker and README"
   - git push origin main

Configurar GitHub Pages
- En tu repo: Settings → Pages. Selecciona la rama `main` (o la que uses) y root (/).
- Después de unos minutos tu sitio estará disponible en https://<username>.github.io/The-WolfBin-V2 (o similar).

Ajustes IMPORTANTES antes de publicar
- En app.js reemplaza API_BASE con la URL pública del Worker (ej: https://wolfbin-worker.yourdomain.workers.dev).
- En worker.js reemplaza ALLOWED_ORIGIN con la URL exacta de tu sitio GitHub Pages (ej: https://thewolfbin.github.io).
- Configura Workers KV y asigna el namespace a la binding WOLFBIN (ver wrangler.toml).

Desplegar el Cloudflare Worker (resumen)
1. Instala Wrangler (Cloudflare CLI) y autentica.
2. Configura wrangler.toml con tu account_id y KV namespace id.
3. Ejecuta: wrangler publish --env production

Notas de seguridad
- ads.json puede contener HTML; si otras personas pueden editarlo hay riesgo XSS. Si no quieres riesgos, limita anuncios a imágenes y enlaces.
- El Admin usa un token de GitHub: no lo compartas. Usa un token temporal y elimínalo cuando termines.
- Si incluyes la clave en la URL fragment (id:key) recuerda que la parte después de # no se envía al servidor. Eso es intencional para privacidad.

Si quieres que yo genere automáticamente un pull request con estos archivos en tu repo, dime y te guío sobre cómo darme permisos/crear un token para automatizar (puedo darte el comando exacto para ejecutar localmente).
```
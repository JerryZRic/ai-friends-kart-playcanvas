// Windows desktop packaging addition, 2026-10-07. AGPL-3.0-only.
const fs = require('node:fs/promises');
const path = require('node:path');
const CSP = "default-src 'self'; script-src 'self' 'sha256-gYOY9hM1G68kWgfjlpVtQj0RdN2z5w/wE0vhYmtIaoE=' 'sha256-tTngFVjNxbhYI3DRWCb+/8lJwUErO71fgco8CBQ8oQY='; worker-src 'self' blob:; connect-src 'self' blob: data:; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; media-src 'self' blob:; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'none'";
const MIME = {'.mp3':'audio/mpeg','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.map':'application/json','.glb':'model/gltf-binary','.gz':'application/gzip','.zip':'application/zip','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8'};
const isLocal = value => { try { const u = new URL(value); return u.protocol === 'kart:' && u.host === 'game' && !u.username && !u.password; } catch { return false; } };
function createHandler(root) {
  const base = path.resolve(root);
  return async request => {
    if (!isLocal(request.url)) return new Response('Forbidden', {status:403});
    if (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed', {status:405});
    try {
      const pathname = decodeURIComponent(new URL(request.url).pathname);
      if (pathname.includes('\\') || pathname.includes('\0')) return new Response('Bad path', {status:400});
      const target = path.resolve(base, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
      const rel = path.relative(base, target);
      if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return new Response('Forbidden', {status:403});
      const real = await fs.realpath(target);
      if (!real.startsWith(base + path.sep)) return new Response('Forbidden', {status:403});
      const bytes = await fs.readFile(real);
      return new Response(request.method === 'HEAD' ? null : bytes, {headers:{'Content-Type':MIME[path.extname(real)] || 'text/plain; charset=utf-8','Content-Length':String(bytes.length),'Content-Security-Policy':CSP,'X-Content-Type-Options':'nosniff'}});
    } catch { return new Response('Not found', {status:404}); }
  };
}
module.exports = {createHandler, isLocal, CSP};

import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { createGzip } from 'node:zlib';

const HOST = '0.0.0.0';
const PORT = Number.parseInt(process.env.PORT || '8088', 10);
const ROOT = resolve(process.cwd());

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

function sendText(res, status, text, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    ...extraHeaders
  });
  res.end(text);
}

function securityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Resource-Policy': 'same-site'
  };
}

const server = http.createServer(async (req, res) => {
  try {
    const method = req.method || 'GET';
    if (method !== 'GET' && method !== 'HEAD') {
      return sendText(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD', ...securityHeaders() });
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/healthz') {
      const body = JSON.stringify({ ok: true });
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        'Cache-Control': 'no-store',
        ...securityHeaders()
      });
      return method === 'HEAD' ? res.end() : res.end(body);
    }

    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return sendText(res, 400, 'Bad Request', securityHeaders());
    }

    if (pathname === '/') pathname = '/index.html';

    const requested = resolve(ROOT, `.${pathname}`);
    if (requested !== ROOT && !requested.startsWith(ROOT + sep)) {
      return sendText(res, 403, 'Forbidden', securityHeaders());
    }

    const fileStat = await stat(requested);
    if (!fileStat.isFile()) throw new Error('not-file');

    const ext = extname(requested).toLowerCase();
    const isHtml = ext === '.html';
    const cacheControl = isHtml
      ? 'public, max-age=0, must-revalidate'
      : 'public, max-age=86400, stale-while-revalidate=604800';

    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': cacheControl,
      'Vary': 'Accept-Encoding',
      ...securityHeaders()
    };

    const acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    const compressible = /^(text\/|application\/(javascript|json)|image\/svg\+xml)/.test(headers['Content-Type']);

    if (method === 'HEAD') {
      headers['Content-Length'] = String(fileStat.size);
      res.writeHead(200, headers);
      return res.end();
    }

    res.writeHead(200, acceptsGzip && compressible ? { ...headers, 'Content-Encoding': 'gzip' } : headers);
    const stream = createReadStream(requested);
    stream.on('error', () => res.destroy());
    if (acceptsGzip && compressible) stream.pipe(createGzip({ level: 6 })).pipe(res);
    else stream.pipe(res);
  } catch {
    sendText(res, 404, '404 Not Found', securityHeaders());
  }
});

server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

function shutdown(signal) {
  console.log(`${signal}: cerrando servidor...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(PORT, HOST, () => {
  console.log(`Campus 3D escuchando en http://${HOST}:${PORT}`);
});

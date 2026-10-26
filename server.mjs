import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { createGzip } from 'node:zlib';

const HOST = '0.0.0.0';
const PORT = Number(process.env.PORT || 8088);
const ROOT = resolve(process.cwd());

let siteMode = 'normal';

const MIME = {
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.jfif':'image/jpeg',
  '.webp':'image/webp',
  '.ico':'image/x-icon',
  '.txt':'text/plain; charset=utf-8'
};

const COMPRESSIBLE = new Set(['.html','.js','.mjs','.css','.json','.svg','.txt']);

function securityHeaders(res){
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options','SAMEORIGIN');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
}

function sendJson(req,res,status,data){
  const body = Buffer.from(JSON.stringify(data));
  securityHeaders(res);
  res.writeHead(status,{
    'Content-Type':'application/json; charset=utf-8',
    'Content-Length':body.length,
    'Cache-Control':'no-store'
  });
  res.end(body);
}

async function readJsonBody(req, maxBytes=16_384){
  const chunks=[];
  let total=0;
  for await (const chunk of req){
    total += chunk.length;
    if(total > maxBytes) throw new Error('BODY_TOO_LARGE');
    chunks.push(chunk);
  }
  if(total===0) return {};
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
  catch{throw new Error('INVALID_JSON');}
}

function safePath(urlPath){
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const clean = normalize(decoded).replace(/^([.][.][/\\])+/, '');
  const target = resolve(ROOT, '.' + clean);
  return target.startsWith(ROOT) ? target : null;
}

function sendFile(req,res,filePath,status=200){
  let stats;
  try{stats = statSync(filePath);}
  catch{return false;}
  if(!stats.isFile()) return false;

  const ext = extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';
  const acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  const useGzip = acceptsGzip && COMPRESSIBLE.has(ext) && stats.size > 900;

  securityHeaders(res);
  res.statusCode = status;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Vary','Accept-Encoding');

  if(ext === '.html') res.setHeader('Cache-Control','no-store');
  else res.setHeader('Cache-Control','public, max-age=3600');

  if(useGzip){
    res.setHeader('Content-Encoding','gzip');
    const gzip = createGzip({level:6});
    createReadStream(filePath).pipe(gzip).pipe(res);
  }else{
    res.setHeader('Content-Length',stats.size);
    createReadStream(filePath).pipe(res);
  }
  return true;
}

const server = http.createServer(async (req,res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if(pathname === '/healthz'){
    return sendJson(req,res,200,{ok:true,mode:siteMode});
  }

  // El panel siempre queda disponible, incluso cuando el sitio está en modo 404.
  if(pathname === '/admin' || pathname === '/admin/'){
    if(sendFile(req,res,join(ROOT,'admin.html'),200)) return;
    return sendJson(req,res,500,{error:'admin.html no encontrado'});
  }

  if(pathname === '/api/admin/site-mode'){
    if(req.method === 'GET') return sendJson(req,res,200,{mode:siteMode});
    if(req.method === 'POST'){
      try{
        const body = await readJsonBody(req);
        if(body.mode !== 'normal' && body.mode !== '404'){
          return sendJson(req,res,400,{error:'Modo inválido. Usa "normal" o "404".'});
        }
        siteMode = body.mode;
        return sendJson(req,res,200,{ok:true,mode:siteMode});
      }catch(err){
        const status = err.message === 'BODY_TOO_LARGE' ? 413 : 400;
        return sendJson(req,res,status,{error:'Solicitud inválida'});
      }
    }
    res.setHeader('Allow','GET, POST');
    return sendJson(req,res,405,{error:'Método no permitido'});
  }

  // Solo la página principal se reemplaza por el error administrable.
  if((pathname === '/' || pathname === '/404.html') && siteMode === '404'){
    if(sendFile(req,res,join(ROOT,'404.html'),404)) return;
    return sendJson(req,res,404,{error:'Página no encontrada'});
  }

  let target;
  if(pathname === '/') target = join(ROOT,'404.html');
  else target = safePath(pathname);

  if(target && sendFile(req,res,target,200)) return;

  if(sendFile(req,res,join(ROOT,'404.html'),404)) return;
  sendJson(req,res,404,{error:'Página no encontrada'});
});

server.listen(PORT,HOST,() => {
  console.log(`Campus 3D listo en http://${HOST}:${PORT}`);
});

function shutdown(signal){
  console.log(`${signal}: cerrando servidor…`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGTERM',() => shutdown('SIGTERM'));
process.on('SIGINT',() => shutdown('SIGINT'));

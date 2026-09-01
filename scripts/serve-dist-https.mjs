#!/usr/bin/env node

import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:https";
import { brotliCompress, gzip } from "node:zlib";
import { promisify } from "node:util";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distDirectory = resolve(projectRoot, "dist");
const fixtureDirectory = resolve(projectRoot, "tests/fixtures/https");
const port = Number(process.env.E2E_HTTPS_PORT || process.env.PORT || 4184);
const host = process.env.HOST || "127.0.0.1";
const compressBrotli = promisify(brotliCompress);
const compressGzip = promisify(gzip);
const contentTypes = new Map([
  [".avif", "image/avif"], [".css", "text/css; charset=utf-8"], [".html", "text/html; charset=utf-8"],
  [".jpg", "image/jpeg"], [".js", "text/javascript; charset=utf-8"], [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"], [".png", "image/png"], [".svg", "image/svg+xml"],
  [".task", "application/octet-stream"], [".wasm", "application/wasm"], [".webmanifest", "application/manifest+json"],
  [".webp", "image/webp"], [".woff", "font/woff"], [".woff2", "font/woff2"],
]);

function resolveDistPath(pathname) {
  const filePath = resolve(distDirectory, pathname === "/" ? "index.html" : `.${pathname}`);
  const resolvedRelative = relative(distDirectory, filePath);
  return resolvedRelative.startsWith("..") || isAbsolute(resolvedRelative) ? null : filePath;
}

async function findResponseFile(request) {
  const pathname = decodeURIComponent(new URL(request.url, `https://${host}:${port}`).pathname);
  const filePath = resolveDistPath(pathname);
  if (!filePath) return { status: 403 };
  try {
    const fileStat = await stat(filePath);
    if (fileStat.isFile()) return { filePath, status: 200 };
    if (fileStat.isDirectory()) {
      const indexPath = join(filePath, "index.html");
      if ((await stat(indexPath)).isFile()) return { filePath: indexPath, status: 200 };
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return request.headers.accept?.includes("text/html") ? { filePath: resolve(distDirectory, "404.html"), status: 404 } : { status: 404 };
}

function responseEncoding(request, contentType) {
  if (!/^(?:text\/|application\/(?:javascript|json|wasm))/u.test(contentType)) return null;
  const accepted = String(request.headers["accept-encoding"] || "");
  if (/\bbr\b/u.test(accepted)) return "br";
  if (/\bgzip\b/u.test(accepted)) return "gzip";
  return null;
}

const [key, cert] = await Promise.all([
  readFile(resolve(fixtureDirectory, "localhost-key.pem")),
  readFile(resolve(fixtureDirectory, "localhost-cert.pem")),
]);
const server = createServer({ key, cert }, async (request, response) => {
  try {
    const result = await findResponseFile(request);
    if (!result.filePath) { response.writeHead(result.status); response.end(); return; }
    const contentType = contentTypes.get(extname(result.filePath)) || "application/octet-stream";
    const encoding = responseEncoding(request, contentType);
    const headers = { "Content-Type": contentType, "Cache-Control": "no-store", Vary: "Accept-Encoding" };
    if (encoding) headers["Content-Encoding"] = encoding;
    response.writeHead(result.status, headers);
    if (request.method === "HEAD") return response.end();
    if (!encoding) return createReadStream(result.filePath).pipe(response);
    const source = await readFile(result.filePath);
    response.end(encoding === "br" ? await compressBrotli(source) : await compressGzip(source));
  } catch (error) {
    console.error(error); response.writeHead(500); response.end();
  }
});
server.listen(port, host, () => console.log(`Serving dist at https://${host}:${port}/`));

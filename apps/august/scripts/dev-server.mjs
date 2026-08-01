import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.PORT || 5190);
const mime = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const relative = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const publicPath = /^\/(?:audio|images|fonts)\//u.test(relative)
    ? join(root, "public", relative)
    : join(root, relative);
  const filePath = normalize(publicPath);

  if (!filePath.startsWith(root) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Không tìm thấy tài nguyên.");
    return;
  }

  const fileStats = statSync(filePath);
  const range = request.headers.range?.match(/^bytes=(\d*)-(\d*)$/u);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2]
      ? Math.min(Number(range[2]), fileStats.size - 1)
      : fileStats.size - 1;
    if (!Number.isSafeInteger(start) || start < 0 || start > end) {
      response.writeHead(416, { "content-range": `bytes */${fileStats.size}` });
      response.end();
      return;
    }
    response.writeHead(206, {
      "accept-ranges": "bytes",
      "cache-control": "no-store",
      "content-length": end - start + 1,
      "content-range": `bytes ${start}-${end}/${fileStats.size}`,
      "content-type": mime[extname(filePath)] || "application/octet-stream",
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(filePath, { start, end }).pipe(response);
    return;
  }

  response.writeHead(200, {
    "accept-ranges": "bytes",
    "cache-control": "no-store",
    "content-length": fileStats.size,
    "content-type": mime[extname(filePath)] || "application/octet-stream",
  });
  if (request.method === "HEAD") response.end();
  else createReadStream(filePath).pipe(response);
}).listen(port, "127.0.0.1", () => {
  console.log(`August flower card: http://127.0.0.1:${port}/`);
});

// Minimal Range-capable static server for Sprint 0 URL evidence runs.
//
// Usage:
//   node scripts/serve-test-media.mjs [directory] [port]
//   node scripts/serve-test-media.mjs test-media 8787
//
// It serves only files directly inside the chosen directory and implements
// single-range byte requests so mpv can seek over HTTP. This is a test harness,
// not a production static server.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.argv[2] ?? "test-media");
const port = Number(process.argv[3] ?? process.env.PORT ?? 8787);

const contentTypes = new Map([
  [".mp4", "video/mp4"],
  [".m4v", "video/mp4"],
  [".mkv", "video/x-matroska"],
  [".webm", "video/webm"],
  [".srt", "application/x-subrip"],
  [".ass", "text/x-ssa"],
]);

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
  const fileName = path.basename(decodeURIComponent(requestUrl.pathname));
  const filePath = path.join(root, fileName);

  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain" });
    response.end("not found");
    return;
  }
  if (!stat.isFile()) {
    response.writeHead(404, { "Content-Type": "text/plain" });
    response.end("not found");
    return;
  }

  const contentType = contentTypes.get(path.extname(filePath).toLowerCase());
  const range = request.headers.range;

  if (!range) {
    response.writeHead(200, {
      "Content-Type": contentType ?? "application/octet-stream",
      "Content-Length": stat.size,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    fs.createReadStream(filePath).pipe(response);
    return;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) {
    response.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
    response.end();
    return;
  }

  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : stat.size - 1;
  if (start > end || start >= stat.size || end >= stat.size) {
    response.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
    response.end();
    return;
  }

  response.writeHead(206, {
    "Content-Type": contentType ?? "application/octet-stream",
    "Content-Length": end - start + 1,
    "Content-Range": `bytes ${start}-${end}/${stat.size}`,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  fs.createReadStream(filePath, { start, end }).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`serving ${root} at http://127.0.0.1:${port}/`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}

// Serves an HTML entry in production mode: no Bun error overlay, so errors thrown by
// browser extensions (wallets and the like) do not cover the game while it is played.
// Usage: bun tools/serve.ts <port> <path/to/index.html>
import { resolve } from "node:path";

const [port, entry] = Bun.argv.slice(2);
if (!port || !entry) throw new Error("usage: bun tools/serve.ts <port> <path/to/index.html>");

const page = (await import(resolve(entry))).default;
const server = Bun.serve({ port: Number(port), development: false, routes: { "/": page } });
console.log(`serving ${entry} at ${server.url}`);

// Local development only: lets the Neon serverless driver talk to a plain Postgres on this
// machine. The driver speaks the Postgres protocol over a WebSocket; this relays each
// WebSocket to a TCP connection. Start it, then run the app with
//   DATABASE_URL=postgresql://postgres@localhost:5433/aurum_test LOCAL_PG_WS_PROXY=localhost:5488
// Never used in production (Neon terminates the WebSocket itself).
import net from "node:net";
import { WebSocketServer } from "ws";

const port = Number(process.env.PROXY_PORT ?? 5488);
const wss = new WebSocketServer({ port });
wss.on("connection", (socket, req) => {
  const target = new URL(req.url ?? "/", "http://x").searchParams.get("address") ?? "localhost:5432";
  const [host, p] = target.split(":");
  const tcp = net.connect(Number(p), host);
  socket.on("message", (data) => tcp.write(data));
  tcp.on("data", (data) => socket.readyState === socket.OPEN && socket.send(data));
  const close = () => {
    tcp.destroy();
    socket.close();
  };
  socket.on("close", close);
  socket.on("error", close);
  tcp.on("close", close);
  tcp.on("error", close);
});
console.log(`pg-ws-proxy listening on ws://localhost:${port}`);

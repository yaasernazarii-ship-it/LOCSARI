const { WebSocketServer } = require("ws");
const { verifyToken } = require("./auth");

// نگاشت userId -> مجموعه سوکت‌های باز آن کاربر (چند تب/دستگاه ممکن است)
const clientsByUser = new Map();

function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url, "http://localhost");
    const token = url.searchParams.get("token");
    const payload = token && verifyToken(token);
    if (!payload) {
      ws.close(4001, "توکن نامعتبر");
      return;
    }
    const userId = payload.sub;
    if (!clientsByUser.has(userId)) clientsByUser.set(userId, new Set());
    clientsByUser.get(userId).add(ws);

    ws.on("close", () => {
      const set = clientsByUser.get(userId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) clientsByUser.delete(userId);
      }
    });
  });

  return wss;
}

// ارسال پیام real-time به یک کاربر (اگر آنلاین باشد)
function pushToUser(userId, payload) {
  const set = clientsByUser.get(userId);
  if (!set) return;
  const data = JSON.stringify(payload);
  for (const ws of set) {
    if (ws.readyState === ws.OPEN) ws.send(data);
  }
}

module.exports = { setupWebSocket, pushToUser };

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");

const authRoutes = require("./routes/auth");
const listingsRoutes = require("./routes/listings");
const chatsRoutes = require("./routes/chats");
const notificationsRoutes = require("./routes/notifications");
const { router: boostRoutes } = require("./routes/boost");
const paymentRoutes = require("./routes/payment");
const { setupWebSocket } = require("./ws");

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 4000;

const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    credentials: true,
  })
);
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/listings", listingsRoutes);
app.use("/api/chats", chatsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/boost", boostRoutes);
app.use("/api/payment", paymentRoutes);

app.use((req, res) => res.status(404).json({ error: "یافت نشد" }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "خطای داخلی سرور" });
});

const server = http.createServer(app);
setupWebSocket(server);

server.listen(PORT, () => {
  console.log(`سرور لوکیشن ساری روی پورت ${PORT} اجرا شد`);
});

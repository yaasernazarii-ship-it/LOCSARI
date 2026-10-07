const express = require("express");
const { db, persist, nextId } = require("../store");
const { requireAuth } = require("../auth");
const { createNotification } = require("../notify");
const { pushToUser } = require("../ws");

const router = express.Router();

function chatSummary(chat) {
  const listing = db.listings.find((l) => l.id === chat.listingId);
  const lastMsg = [...db.messages]
    .filter((m) => m.chatId === chat.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  return {
    id: chat.id,
    listingId: chat.listingId,
    listingTitle: listing ? listing.title : "آگهی حذف‌شده",
    buyerId: chat.buyerId,
    sellerId: chat.sellerId,
    lastMessage: lastMsg ? lastMsg.text : null,
    lastMessageAt: lastMsg ? lastMsg.createdAt : chat.createdAt,
  };
}

// شروع یا دریافت گفتگوی موجود برای یک آگهی
router.post("/", requireAuth, (req, res) => {
  const listingId = Number((req.body || {}).listingId);
  const listing = db.listings.find((l) => l.id === listingId);
  if (!listing) return res.status(404).json({ error: "آگهی یافت نشد" });
  if (!listing.ownerId) {
    return res
      .status(400)
      .json({ error: "این آگهی نمونه سایت است و مالک ثبت‌شده ندارد" });
  }
  if (listing.ownerId === req.userId) {
    return res.status(400).json({ error: "نمی‌توانید با آگهی خودتان گفتگو کنید" });
  }
  let chat = db.chats.find(
    (c) => c.listingId === listingId && c.buyerId === req.userId
  );
  if (!chat) {
    chat = {
      id: nextId("chats"),
      listingId,
      buyerId: req.userId,
      sellerId: listing.ownerId,
      createdAt: new Date().toISOString(),
    };
    db.chats.push(chat);
    persist();
  }
  res.status(201).json({ chat: chatSummary(chat) });
});

router.get("/", requireAuth, (req, res) => {
  const mine = db.chats.filter(
    (c) => c.buyerId === req.userId || c.sellerId === req.userId
  );
  const list = mine
    .map(chatSummary)
    .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
  res.json({ chats: list });
});

function assertParticipant(chat, userId) {
  return chat && (chat.buyerId === userId || chat.sellerId === userId);
}

router.get("/:id/messages", requireAuth, (req, res) => {
  const chat = db.chats.find((c) => c.id === Number(req.params.id));
  if (!assertParticipant(chat, req.userId)) {
    return res.status(404).json({ error: "گفتگو یافت نشد" });
  }
  const messages = db.messages
    .filter((m) => m.chatId === chat.id)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  res.json({ messages });
});

router.post("/:id/messages", requireAuth, (req, res) => {
  const chat = db.chats.find((c) => c.id === Number(req.params.id));
  if (!assertParticipant(chat, req.userId)) {
    return res.status(404).json({ error: "گفتگو یافت نشد" });
  }
  const text = ((req.body || {}).text || "").trim();
  if (!text) return res.status(400).json({ error: "متن پیام خالی است" });
  const message = {
    id: nextId("messages"),
    chatId: chat.id,
    senderId: req.userId,
    text,
    createdAt: new Date().toISOString(),
  };
  db.messages.push(message);
  persist();

  const recipientId = chat.buyerId === req.userId ? chat.sellerId : chat.buyerId;
  pushToUser(recipientId, { kind: "message", chatId: chat.id, message });
  const listing = db.listings.find((l) => l.id === chat.listingId);
  createNotification(
    recipientId,
    "chat",
    `پیام جدید درباره آگهی «${listing ? listing.title : ""}»`,
    chat.id
  );

  res.status(201).json({ message });
});

module.exports = router;

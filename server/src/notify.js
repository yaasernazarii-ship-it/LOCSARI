const { db, persist, nextId } = require("./store");
const { pushToUser } = require("./ws");

function createNotification(userId, type, text, relatedId) {
  const notif = {
    id: nextId("notifications"),
    userId,
    type,
    text,
    relatedId: relatedId || null,
    read: false,
    createdAt: new Date().toISOString(),
  };
  db.notifications.push(notif);
  persist();
  pushToUser(userId, { kind: "notification", notification: notif });
  return notif;
}

module.exports = { createNotification };

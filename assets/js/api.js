// لایه ارتباط با بک‌اند لوکیشن ساری (احراز هویت، آگهی‌ها، چت، اعلان‌ها، ویژه‌سازی)
// اگر سرور در دسترس نباشد، بقیه سایت (نمایش آگهی‌های نمونه) باید بدون خطا کار کند.

const API_BASE = "/api";
const TOKEN_KEY = "sari_token";
const USER_KEY = "sari_user";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function isLoggedIn() {
  return Boolean(getToken());
}

async function apiFetch(path, options = {}) {
  const headers = Object.assign(
    { "Content-Type": "application/json" },
    options.headers || {}
  );
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(API_BASE + path, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message = (data && data.error) || "خطا در ارتباط با سرور";
    throw new Error(message);
  }
  return data;
}

const api = {
  // ---------- احراز هویت ----------
  async register(phone, password, name) {
    const data = await apiFetch("/auth/register", {
      method: "POST",
      body: { phone, password, name },
    });
    setSession(data.token, data.user);
    return data.user;
  },
  async login(phone, password) {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: { phone, password },
    });
    setSession(data.token, data.user);
    return data.user;
  },
  logout() {
    clearSession();
  },
  async me() {
    const data = await apiFetch("/auth/me");
    return data.user;
  },

  // ---------- آگهی‌ها ----------
  async getListings() {
    const data = await apiFetch("/listings");
    return data.listings;
  },
  async getListing(id) {
    const data = await apiFetch(`/listings/${id}`);
    return data.listing;
  },
  async myListings() {
    const data = await apiFetch("/listings/mine");
    return data.listings;
  },
  async createListing(payload) {
    const data = await apiFetch("/listings", { method: "POST", body: payload });
    return data.listing;
  },
  async deleteListing(id) {
    return apiFetch(`/listings/${id}`, { method: "DELETE" });
  },
  registerView(id) {
    // بدون انتظار برای پاسخ، فقط شمارش بازدید
    apiFetch(`/listings/${id}/view`, { method: "POST" }).catch(() => {});
  },

  // ---------- چت ----------
  async startChat(listingId) {
    const data = await apiFetch("/chats", { method: "POST", body: { listingId } });
    return data.chat;
  },
  async listChats() {
    const data = await apiFetch("/chats");
    return data.chats;
  },
  async chatMessages(chatId) {
    const data = await apiFetch(`/chats/${chatId}/messages`);
    return data.messages;
  },
  async sendMessage(chatId, text) {
    const data = await apiFetch(`/chats/${chatId}/messages`, {
      method: "POST",
      body: { text },
    });
    return data.message;
  },

  // ---------- اعلان‌ها ----------
  async getNotifications() {
    const data = await apiFetch("/notifications");
    return data.notifications;
  },
  markNotificationRead(id) {
    return apiFetch(`/notifications/${id}/read`, { method: "POST" });
  },
  markAllNotificationsRead() {
    return apiFetch("/notifications/read-all", { method: "POST" });
  },

  // ---------- ویژه‌سازی و پرداخت ----------
  async boostPackages() {
    const data = await apiFetch("/boost/packages");
    return data.packages;
  },
  async createBoostOrder(listingId, packageId) {
    return apiFetch("/boost/orders", {
      method: "POST",
      body: { listingId, packageId },
    });
  },
};

// ---------- اتصال زنده (WebSocket) برای پیام و اعلان real-time ----------
let ws = null;
const wsListeners = [];

function onRealtime(fn) {
  wsListeners.push(fn);
}

function connectRealtime() {
  const token = getToken();
  if (!token || !window.WebSocket) return;
  if (ws && ws.readyState === WebSocket.OPEN) return;

  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${protocol}//${location.host}/ws?token=${encodeURIComponent(token)}`);
  ws.addEventListener("message", (event) => {
    try {
      const payload = JSON.parse(event.data);
      wsListeners.forEach((fn) => fn(payload));
    } catch {
      /* نادیده گرفتن پیام نامعتبر */
    }
  });
  ws.addEventListener("close", () => {
    ws = null;
    // تلاش مجدد برای اتصال پس از قطعی موقت
    if (isLoggedIn()) setTimeout(connectRealtime, 4000);
  });
}

// منطق مشترک سایت املاک ساری

// ---------- ابزارهای عمومی ----------
function toFa(num) {
  return Number(num).toLocaleString("fa-IR");
}

function formatToman(amount) {
  if (amount === null || amount === undefined) return "توافقی";
  if (amount >= 1000000000) {
    const val = amount / 1000000000;
    return `${toFa(Number(val.toFixed(val % 1 === 0 ? 0 : 1)))} میلیارد تومان`;
  }
  if (amount >= 1000000) {
    const val = amount / 1000000;
    return `${toFa(Number(val.toFixed(val % 1 === 0 ? 0 : 1)))} میلیون تومان`;
  }
  return `${toFa(amount)} تومان`;
}

function dealLabel(item) {
  if (item.dealType === "sale") return "خرید و فروش";
  if (item.monthlyRent === 0) return "رهن کامل";
  return "رهن و اجاره";
}

function priceLabel(item) {
  if (item.dealType === "sale") return formatToman(item.price);
  if (item.monthlyRent === 0) return `رهن ${formatToman(item.deposit)}`;
  return `رهن ${formatToman(item.deposit)} / اجاره ${formatToman(item.monthlyRent)}`;
}

function getQueryParams() {
  return new URLSearchParams(window.location.search);
}

function relativeFa(dateStr) {
  if (!dateStr) return "";
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days <= 0) return "امروز";
  if (days === 1) return "دیروز";
  if (days < 30) return `${toFa(days)} روز پیش`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${toFa(months)} ماه پیش`;
  return `${toFa(Math.floor(months / 12))} سال پیش`;
}

function isNewListing(item) {
  const days = Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 86400000);
  return days >= 0 && days <= 5;
}

const TYPE_ICONS = {
  apartment: "🏢",
  villa: "🏡",
  land: "🌳",
  shop: "🏪",
  office: "🏬",
  old: "🏚️",
  garden: "🌿",
};

// ---------- منبع داده آگهی‌ها (بک‌اند با fallback به داده استاتیک) ----------
let ACTIVE_LISTINGS = null;

async function loadListings() {
  if (ACTIVE_LISTINGS) return ACTIVE_LISTINGS;
  try {
    ACTIVE_LISTINGS = await api.getListings();
  } catch {
    // سرور در دسترس نیست؛ نمایش آگهی‌های نمونه محلی برای پایداری سایت
    ACTIVE_LISTINGS = LISTINGS;
  }
  return ACTIVE_LISTINGS;
}

// ---------- علاقه‌مندی‌ها (ذخیره محلی روی مرورگر) ----------
const FAV_KEY = "sari_favorites";

function getFavorites() {
  try {
    const raw = JSON.parse(localStorage.getItem(FAV_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function isFavorite(id) {
  return getFavorites().includes(id);
}

function toggleFavorite(id) {
  let favs = getFavorites();
  const active = !favs.includes(id);
  favs = active ? [...favs, id] : favs.filter((x) => x !== id);
  localStorage.setItem(FAV_KEY, JSON.stringify(favs));
  updateFavCountBadge();
  return active;
}

function updateFavCountBadge() {
  const el = document.querySelector("#fav-count");
  if (!el) return;
  const n = getFavorites().length;
  el.textContent = toFa(n);
  el.dataset.zero = n === 0 ? "true" : "false";
}

function bindFavButtons(container) {
  if (!container) return;
  container.querySelectorAll(".fav-btn").forEach((btn) => {
    const id = Number(btn.dataset.favId);
    if (isFavorite(id)) {
      btn.classList.add("active");
      btn.textContent = "❤️";
    }
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const active = toggleFavorite(id);
      btn.classList.toggle("active", active);
      btn.textContent = active ? "❤️" : "🤍";
    });
  });
}

// ---------- نشان‌های وضعیت آگهی ----------
function badgesHTML(item) {
  const badges = [];
  if (item.featured) badges.push('<span class="badge badge-featured">ویژه</span>');
  if (item.urgent) badges.push('<span class="badge badge-urgent">فوری</span>');
  if (isNewListing(item)) badges.push('<span class="badge badge-new">جدید</span>');
  if (item.oldPrice) badges.push('<span class="badge badge-drop">کاهش قیمت</span>');
  if (!badges.length) return "";
  return `<div class="badge-stack">${badges.join("")}</div>`;
}

// ---------- کارت آگهی ----------
function cardHTML(item) {
  const icon = TYPE_ICONS[item.type] || "🏠";
  return `
  <a class="listing-card" href="property.html?id=${item.id}">
    <div class="card-thumb type-${item.type}">
      <span class="thumb-icon">${icon}</span>
      ${badgesHTML(item)}
      <span class="badge badge-deal ${item.dealType === "sale" ? "badge-sale" : "badge-rent"}">${dealLabel(item)}</span>
      <button type="button" class="fav-btn" data-fav-id="${item.id}" aria-label="افزودن به علاقه‌مندی‌ها">🤍</button>
    </div>
    <div class="card-body">
      <h3 class="card-title">${item.title}</h3>
      <p class="card-loc">📍 ${item.neighborhood}، ساری</p>
      <ul class="card-specs">
        <li>${toFa(item.area)} متر</li>
        ${item.rooms ? `<li>${toFa(item.rooms)} خواب</li>` : ""}
        <li>${PROPERTY_TYPES[item.type]}</li>
      </ul>
      <div class="card-meta-row">
        <span>👁️ ${toFa(item.views || 0)} بازدید</span>
        <span>🕒 ${relativeFa(item.updatedAt || item.createdAt)}</span>
      </div>
      <div class="card-price">${priceLabel(item)}</div>
    </div>
  </a>`;
}

function renderCards(container, items) {
  if (!container) return;
  if (!items.length) {
    container.innerHTML = `<div class="empty-state">آگهی‌ای با این مشخصات پیدا نشد. فیلترها را تغییر دهید.</div>`;
    return;
  }
  container.innerHTML = items.map(cardHTML).join("");
  bindFavButtons(container);
}

// ---------- فیلتر ----------
function applyFilters(source, filters) {
  return source.filter((item) => {
    if (filters.deal && item.dealType !== filters.deal) return false;
    if (filters.type && item.type !== filters.type) return false;
    if (filters.neighborhood && item.neighborhood !== filters.neighborhood) return false;
    if (filters.minArea && item.area < Number(filters.minArea)) return false;
    if (filters.maxArea && item.area > Number(filters.maxArea)) return false;
    if (filters.rooms && item.rooms !== Number(filters.rooms)) return false;
    if (filters.elevator && !item.elevator) return false;
    if (filters.parking && !item.parking) return false;
    if (filters.warehouse && !item.warehouse) return false;

    if (filters.minPrice || filters.maxPrice) {
      const priceRef = item.dealType === "sale" ? item.price : item.deposit;
      if (filters.minPrice && priceRef < Number(filters.minPrice)) return false;
      if (filters.maxPrice && priceRef > Number(filters.maxPrice)) return false;
    }
    return true;
  });
}

function sortItems(items, sortKey) {
  const arr = [...items];
  switch (sortKey) {
    case "newest":
      return arr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    case "price-asc":
      return arr.sort((a, b) => (a.dealType === "sale" ? a.price : a.deposit) - (b.dealType === "sale" ? b.price : b.deposit));
    case "price-desc":
      return arr.sort((a, b) => (b.dealType === "sale" ? b.price : b.deposit) - (a.dealType === "sale" ? a.price : a.deposit));
    case "area-desc":
      return arr.sort((a, b) => b.area - a.area);
    case "views-desc":
      return arr.sort((a, b) => (b.views || 0) - (a.views || 0));
    default:
      return arr;
  }
}

// ---------- پر کردن سلکت‌ها ----------
function fillSelect(select, options, selectedValue) {
  if (!select) return;
  options.forEach(([value, label]) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    if (value === selectedValue) opt.selected = true;
    select.appendChild(opt);
  });
}

function initTypeAndNeighborhoodSelects() {
  document.querySelectorAll("select[data-fill='type']").forEach((sel) => {
    fillSelect(sel, Object.entries(PROPERTY_TYPES));
  });
  document.querySelectorAll("select[data-fill='neighborhood']").forEach((sel) => {
    fillSelect(sel, NEIGHBORHOODS.map((n) => [n, n]));
  });
}

// ---------- منوی موبایل ----------
function initMobileNav() {
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.querySelector(".nav-menu");
  if (!toggle || !menu) return;
  toggle.addEventListener("click", () => {
    menu.classList.toggle("open");
    toggle.classList.toggle("active");
  });
}

// ---------- صفحه اصلی ----------
async function initHomePage() {
  const items = await loadListings();
  const featured = items.filter((i) => i.featured).slice(0, 6);
  renderCards(document.querySelector("#featured-listings"), featured);

  const form = document.querySelector("#hero-search");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const params = new URLSearchParams();
      for (const [key, val] of data.entries()) {
        if (val) params.set(key, val);
      }
      window.location.href = `listings.html?${params.toString()}`;
    });
  }
}

// ---------- صفحه لیست آگهی‌ها ----------
async function initListingsPage() {
  const form = document.querySelector("#filter-form");
  const grid = document.querySelector("#listings-grid");
  const countEl = document.querySelector("#result-count");
  const sortSelect = document.querySelector("#sort-select");
  const clearBtn = document.querySelector("#clear-filters");

  const items = await loadListings();

  function readFilters() {
    const data = new FormData(form);
    return Object.fromEntries(data.entries());
  }

  function render() {
    const filters = readFilters();
    let result = applyFilters(items, filters);
    result = sortItems(result, sortSelect ? sortSelect.value : "newest");
    renderCards(grid, result);
    if (countEl) countEl.textContent = toFa(result.length);
  }

  // مقداردهی اولیه فرم از querystring
  const params = getQueryParams();
  for (const [key, val] of params.entries()) {
    const field = form.querySelector(`[name="${key}"]`);
    if (field) field.value = val;
  }

  form.addEventListener("input", render);
  form.addEventListener("change", render);
  if (sortSelect) sortSelect.addEventListener("change", render);
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      form.reset();
      render();
    });
  }

  render();
}

// ---------- صفحه آگهی‌های ذخیره‌شده (علاقه‌مندی‌ها) ----------
async function initFavoritesPage() {
  const grid = document.querySelector("#favorites-grid");
  const countEl = document.querySelector("#fav-result-count");
  if (!grid) return;

  const source = await loadListings();

  function render() {
    const ids = getFavorites();
    const items = source.filter((i) => ids.includes(i.id));
    if (countEl) countEl.textContent = toFa(items.length);
    if (!items.length) {
      grid.innerHTML = `<div class="empty-state">هنوز آگهی‌ای ذخیره نکرده‌اید. روی آیکون 🤍 هر آگهی بزنید تا اینجا اضافه شود.</div>`;
      return;
    }
    renderCards(grid, items);
  }

  render();
  window.addEventListener("storage", render);
}

// ---------- گالری تصاویر صفحه جزئیات (placeholder، آماده جایگزینی با عکس واقعی) ----------
const GALLERY_SLIDES = ["نمای کلی ملک", "نمای داخلی", "پلان و محیط اطراف"];

function initGallery(container, item) {
  if (!container) return;
  const icon = TYPE_ICONS[item.type] || "🏠";
  let index = 0;

  container.innerHTML = `
    <div class="gallery-main type-${item.type}">
      <span class="thumb-icon big">${icon}</span>
      <span class="badge badge-deal ${item.dealType === "sale" ? "badge-sale" : "badge-rent"}">${dealLabel(item)}</span>
      <span class="gallery-caption">${GALLERY_SLIDES[0]}</span>
      <button type="button" class="gallery-nav gallery-prev" aria-label="تصویر بعدی">›</button>
      <button type="button" class="gallery-nav gallery-next" aria-label="تصویر قبلی">‹</button>
    </div>
    <div class="gallery-dots">
      ${GALLERY_SLIDES.map((_, i) => `<button type="button" data-i="${i}" class="${i === 0 ? "active" : ""}"></button>`).join("")}
    </div>
  `;

  const caption = container.querySelector(".gallery-caption");
  const dots = container.querySelectorAll(".gallery-dots button");

  function show(i) {
    index = (i + GALLERY_SLIDES.length) % GALLERY_SLIDES.length;
    caption.textContent = GALLERY_SLIDES[index];
    dots.forEach((d, di) => d.classList.toggle("active", di === index));
  }

  container.querySelector(".gallery-prev").addEventListener("click", () => show(index + 1));
  container.querySelector(".gallery-next").addEventListener("click", () => show(index - 1));
  dots.forEach((d) => d.addEventListener("click", () => show(Number(d.dataset.i))));
}

// ---------- اشتراک‌گذاری آگهی ----------
function initShare(container, item) {
  if (!container) return;
  const url = window.location.href;
  const text = `${item.title} — ${priceLabel(item)} | لوکیشن ساری`;

  container.innerHTML = `
    <button type="button" class="share-btn" id="share-native">🔗 اشتراک‌گذاری</button>
    <a class="share-btn" target="_blank" rel="noopener" href="https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}">تلگرام</a>
    <a class="share-btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text + " " + url)}">واتساپ</a>
  `;

  const nativeBtn = container.querySelector("#share-native");
  nativeBtn.addEventListener("click", async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: item.title, text, url });
      } catch {
        /* کاربر اشتراک‌گذاری را لغو کرد */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      nativeBtn.textContent = "✅ لینک کپی شد";
      setTimeout(() => (nativeBtn.textContent = "🔗 اشتراک‌گذاری"), 2000);
    } catch {
      window.prompt("لینک آگهی را کپی کنید:", url);
    }
  });
}

// ---------- مسیر دسته‌بندی (Breadcrumb) ----------
function renderBreadcrumb(container, steps) {
  if (!container) return;
  container.innerHTML = steps
    .map((step, i) =>
      i === steps.length - 1
        ? `<span class="current">${step.label}</span>`
        : `<a href="${step.href}">${step.label}</a><span>/</span>`
    )
    .join("");
}

// ---------- صفحه جزئیات ملک ----------
async function initPropertyPage() {
  const params = getQueryParams();
  const id = Number(params.get("id"));
  const wrap = document.querySelector("#property-detail");
  if (!wrap) return;

  const allItems = await loadListings();
  let item = allItems.find((i) => i.id === id);
  try {
    const fresh = await api.getListing(id);
    if (fresh) item = fresh;
  } catch {
    /* استفاده از نسخه محلی در صورت نبود سرور */
  }

  if (!item) {
    wrap.innerHTML = `<div class="empty-state">آگهی مورد نظر پیدا نشد. <a href="listings.html">بازگشت به لیست آگهی‌ها</a></div>`;
    return;
  }

  api.registerView(id);

  document.title = `${item.title} | لوکیشن ساری`;

  const paymentStatus = params.get("payment");
  const bannerEl = document.querySelector("#property-banner");
  if (bannerEl && paymentStatus === "success") {
    bannerEl.hidden = false;
    bannerEl.className = "banner banner-success";
    bannerEl.textContent = "✅ پرداخت با موفقیت انجام شد و آگهی ویژه‌سازی شد.";
  } else if (bannerEl && paymentStatus === "failed") {
    bannerEl.hidden = false;
    bannerEl.className = "banner banner-error";
    bannerEl.textContent = "❌ پرداخت انجام نشد یا لغو شد.";
  }

  renderBreadcrumb(document.querySelector("#property-breadcrumb"), [
    { href: "index.html", label: "خانه" },
    { href: "listings.html", label: "آگهی‌های ملک ساری" },
    { href: `listings.html?type=${item.type}`, label: PROPERTY_TYPES[item.type] },
    { label: item.title },
  ]);

  wrap.innerHTML = `
    <div id="property-gallery" class="detail-gallery"></div>
    <div class="detail-body">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
        <h1>${item.title}</h1>
        <button type="button" class="fav-btn fav-btn-lg" data-fav-id="${item.id}" aria-label="افزودن به علاقه‌مندی‌ها">🤍</button>
      </div>
      <p class="detail-loc">📍 ${item.neighborhood}، ساری</p>
      ${badgesHTML(item).replace('class="badge-stack"', 'class="badge-stack" style="position:static; flex-direction:row; margin-bottom:14px;"')}
      <div class="card-meta-row" style="margin-bottom:14px;">
        <span>👁️ ${toFa(item.views || 0)} بازدید</span>
        <span>🕒 به‌روزرسانی: ${relativeFa(item.updatedAt || item.createdAt)}</span>
      </div>
      <div class="detail-price">
        ${item.oldPrice ? `<s style="color:var(--text-muted); font-size:0.85rem; font-weight:500; margin-left:8px;">${formatToman(item.oldPrice)}</s>` : ""}
        ${priceLabel(item)}
      </div>

      <div id="property-share" class="share-row"></div>

      <table class="spec-table">
        <tr><th>نوع ملک</th><td>${PROPERTY_TYPES[item.type]}</td></tr>
        <tr><th>متراژ</th><td>${toFa(item.area)} متر مربع</td></tr>
        ${item.rooms ? `<tr><th>تعداد اتاق</th><td>${toFa(item.rooms)}</td></tr>` : ""}
        ${item.totalFloors ? `<tr><th>طبقه</th><td>${toFa(item.floor)} از ${toFa(item.totalFloors)}</td></tr>` : ""}
        ${item.yearBuilt ? `<tr><th>سال ساخت</th><td>${toFa(item.yearBuilt)}</td></tr>` : ""}
        <tr><th>آسانسور</th><td>${item.elevator ? "دارد" : "ندارد"}</td></tr>
        <tr><th>پارکینگ</th><td>${item.parking ? "دارد" : "ندارد"}</td></tr>
        <tr><th>انباری</th><td>${item.warehouse ? "دارد" : "ندارد"}</td></tr>
      </table>

      <h2>توضیحات</h2>
      <p class="detail-desc">${item.description}</p>

      <div class="detail-contact">
        <a class="btn btn-primary" href="tel:01133330000">📞 تماس با مشاور</a>
        <a class="btn btn-whatsapp" target="_blank" rel="noopener"
           href="https://wa.me/989110000000?text=${encodeURIComponent("سلام، درباره آگهی «" + item.title + "» (کد " + item.id + ") در ساری سؤال داشتم.")}">
           واتساپ
        </a>
      </div>

      <div id="property-account-panel"></div>
    </div>
  `;

  initGallery(document.querySelector("#property-gallery"), item);
  initShare(document.querySelector("#property-share"), item);
  bindFavButtons(wrap);
  initPropertyAccountPanel(document.querySelector("#property-account-panel"), item);

  // ملک‌های مرتبط
  const related = allItems
    .filter((i) => i.id !== item.id && (i.neighborhood === item.neighborhood || i.type === item.type))
    .slice(0, 3);
  renderCards(document.querySelector("#related-listings"), related);
}

// ---------- بخش حساب کاربری در صفحه ملک: چت با مالک یا ویژه‌سازی برای صاحب آگهی ----------
async function initPropertyAccountPanel(container, item) {
  if (!container) return;

  if (!item.ownerId) {
    // آگهی‌های نمونه سایت، مالک حساب کاربری ندارند
    return;
  }

  if (!isLoggedIn()) {
    container.innerHTML = `
      <div class="account-panel">
        <p>برای گفتگوی مستقیم با مالک این آگهی، ابتدا وارد حساب کاربری خود شوید.</p>
        <a class="btn btn-outline" href="login.html?returnTo=${encodeURIComponent(location.pathname + location.search)}">ورود / ثبت‌نام</a>
      </div>`;
    return;
  }

  let me;
  try {
    me = await api.me();
  } catch {
    container.innerHTML = "";
    return;
  }

  if (me.id === item.ownerId) {
    renderBoostPanel(container, item);
  } else {
    renderChatPanel(container, item);
  }
}

async function renderBoostPanel(container, item) {
  container.innerHTML = `<div class="account-panel"><p>در حال بارگذاری بسته‌های ویژه‌سازی...</p></div>`;
  let packages;
  try {
    packages = await api.boostPackages();
  } catch {
    container.innerHTML = `<div class="account-panel"><p>ارتباط با سرویس ویژه‌سازی برقرار نشد.</p></div>`;
    return;
  }
  const activeNote = item.boostExpiresAt
    ? `<p class="boost-active-note">این آگهی تا ${new Date(item.boostExpiresAt).toLocaleDateString("fa-IR")} ویژه/فوری است.</p>`
    : "";
  container.innerHTML = `
    <div class="account-panel">
      <h3>ویژه‌سازی این آگهی</h3>
      ${activeNote}
      <div class="boost-grid">
        ${packages
          .map(
            (p) => `
          <div class="boost-pkg">
            <div class="boost-pkg-title">${p.title}</div>
            <div class="boost-pkg-price">${toFa(p.price)} تومان</div>
            <button type="button" class="btn btn-primary" data-pkg="${p.id}">خرید و فعال‌سازی</button>
          </div>`
          )
          .join("")}
      </div>
    </div>`;

  container.querySelectorAll("[data-pkg]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "در حال اتصال به درگاه...";
      try {
        const { redirectUrl } = await api.createBoostOrder(item.id, btn.dataset.pkg);
        window.location.href = redirectUrl;
      } catch (e) {
        alert(e.message || "خطا در ایجاد سفارش پرداخت");
        btn.disabled = false;
        btn.textContent = "خرید و فعال‌سازی";
      }
    });
  });
}

function renderChatPanel(container, item) {
  container.innerHTML = `
    <div class="account-panel chat-panel">
      <h3>گفتگو با مالک آگهی</h3>
      <div id="chat-messages" class="chat-messages"><p class="chat-loading">در حال بارگذاری گفتگو...</p></div>
      <form id="chat-form" class="chat-input-row">
        <input type="text" name="text" placeholder="پیام خود را بنویسید..." autocomplete="off" required />
        <button type="submit" class="btn btn-primary">ارسال</button>
      </form>
    </div>`;

  const messagesEl = container.querySelector("#chat-messages");
  const form = container.querySelector("#chat-form");
  let chatId = null;

  function renderMessages(messages, meId) {
    if (!messages.length) {
      messagesEl.innerHTML = `<p class="chat-loading">هنوز پیامی ارسال نشده. اولین پیام را بفرستید.</p>`;
      return;
    }
    messagesEl.innerHTML = messages
      .map(
        (m) =>
          `<div class="chat-msg ${m.senderId === meId ? "mine" : "theirs"}">${m.text}</div>`
      )
      .join("");
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  (async () => {
    try {
      const [chat, me] = await Promise.all([api.startChat(item.id), api.me()]);
      chatId = chat.id;
      const messages = await api.chatMessages(chatId);
      renderMessages(messages, me.id);

      onRealtime((payload) => {
        if (payload.kind === "message" && payload.chatId === chatId) {
          api.chatMessages(chatId).then((msgs) => renderMessages(msgs, me.id));
        }
      });
    } catch (e) {
      messagesEl.innerHTML = `<p class="chat-loading">${e.message || "خطا در شروع گفتگو"}</p>`;
    }
  })();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!chatId) return;
    const input = form.querySelector('[name="text"]');
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    try {
      await api.sendMessage(chatId, text);
      const messages = await api.chatMessages(chatId);
      const me = await api.me();
      renderMessages(messages, me.id);
    } catch (e) {
      alert(e.message || "ارسال پیام ناموفق بود");
    }
  });
}

// ---------- فرم ثبت آگهی (ارسال به واتساپ؛ بدون نیاز به حساب کاربری) ----------
function initAddListingPage() {
  const form = document.querySelector("#add-listing-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const lines = [
        "درخواست ثبت آگهی ملک جدید:",
        `نوع معامله: ${data.deal === "sale" ? "خرید و فروش" : "رهن و اجاره"}`,
        `نوع ملک: ${PROPERTY_TYPES[data.type] || data.type}`,
        `منطقه: ${data.neighborhood}`,
        `متراژ: ${data.area} متر`,
        data.price ? `قیمت پیشنهادی: ${data.price} تومان` : "",
        `نام مالک: ${data.name}`,
        `شماره تماس: ${data.phone}`,
        data.description ? `توضیحات: ${data.description}` : "",
      ].filter(Boolean);

      const text = encodeURIComponent(lines.join("\n"));
      window.open(`https://wa.me/989110000000?text=${text}`, "_blank");

      const success = document.querySelector("#form-success");
      if (success) success.hidden = false;
      form.reset();
    });
  }

  initAccountListingPanel();
}

// ---------- ثبت آگهی از طریق حساب کاربری (ذخیره در سایت، قابل ویرایش/ویژه‌سازی) ----------
function initAccountListingPanel() {
  const panel = document.querySelector("#account-listing-panel");
  if (!panel) return;

  if (!isLoggedIn()) {
    panel.innerHTML = `
      <div class="account-panel">
        <p>برای ثبت آگهی در حساب کاربری (با امکان ویرایش، گفتگو با خریداران و ویژه‌سازی)، ابتدا وارد شوید.</p>
        <a class="btn btn-outline" href="login.html?returnTo=add-listing.html">ورود</a>
        <a class="btn btn-outline" href="register.html?returnTo=add-listing.html">ثبت‌نام</a>
      </div>`;
    return;
  }

  panel.innerHTML = `
    <div class="account-panel">
      <h3>ثبت آگهی در حساب کاربری</h3>
      <div id="account-listing-success" class="success-box" hidden></div>
      <form id="account-listing-form">
        <div class="form-group">
          <label>عنوان آگهی</label>
          <input type="text" name="title" required />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>نوع معامله</label>
            <select name="dealType" required>
              <option value="sale">خرید و فروش</option>
              <option value="rent">رهن و اجاره</option>
            </select>
          </div>
          <div class="form-group">
            <label>نوع ملک</label>
            <select name="type" data-fill="type" required></select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>منطقه (ساری)</label>
            <select name="neighborhood" data-fill="neighborhood" required></select>
          </div>
          <div class="form-group">
            <label>متراژ (متر مربع)</label>
            <input type="number" name="area" min="1" required />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>تعداد اتاق</label>
            <input type="number" name="rooms" min="0" />
          </div>
          <div class="form-group">
            <label>قیمت (تومان) / ودیعه رهن</label>
            <input type="number" name="price" min="0" required />
          </div>
        </div>
        <div class="form-group" id="monthly-rent-group" hidden>
          <label>اجاره ماهانه (تومان)</label>
          <input type="number" name="monthlyRent" min="0" />
        </div>
        <div class="filter-checks" style="flex-direction:row; gap:16px; margin-bottom:14px;">
          <label><input type="checkbox" name="elevator" /> آسانسور</label>
          <label><input type="checkbox" name="parking" /> پارکینگ</label>
          <label><input type="checkbox" name="warehouse" /> انباری</label>
        </div>
        <div class="form-group">
          <label>توضیحات</label>
          <textarea name="description"></textarea>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%;">ثبت آگهی</button>
      </form>
    </div>`;

  fillSelect(panel.querySelector('select[name="type"]'), Object.entries(PROPERTY_TYPES));
  fillSelect(panel.querySelector('select[name="neighborhood"]'), NEIGHBORHOODS.map((n) => [n, n]));

  const dealSelect = panel.querySelector('select[name="dealType"]');
  const rentGroup = panel.querySelector("#monthly-rent-group");
  dealSelect.addEventListener("change", () => {
    rentGroup.hidden = dealSelect.value !== "rent";
  });

  const form = panel.querySelector("#account-listing-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(form).entries());
    const payload = {
      title: raw.title,
      dealType: raw.dealType,
      type: raw.type,
      neighborhood: raw.neighborhood,
      area: raw.area,
      rooms: raw.rooms,
      price: raw.price,
      monthlyRent: raw.monthlyRent,
      elevator: Boolean(raw.elevator),
      parking: Boolean(raw.parking),
      warehouse: Boolean(raw.warehouse),
      description: raw.description,
    };
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      const listing = await api.createListing(payload);
      const successBox = panel.querySelector("#account-listing-success");
      successBox.hidden = false;
      successBox.innerHTML = `✅ آگهی شما ثبت شد. <a href="property.html?id=${listing.id}">مشاهده آگهی</a> یا <a href="account.html">مدیریت آگهی‌های من</a>`;
      form.reset();
      rentGroup.hidden = true;
    } catch (err) {
      alert(err.message || "ثبت آگهی ناموفق بود");
    } finally {
      submitBtn.disabled = false;
    }
  });
}

// ---------- وضعیت ورود در هدر (حساب کاربری و اعلان‌ها) ----------
function initAuthUI() {
  const menu = document.querySelector(".nav-menu");
  if (!menu) return;

  const notifBell = document.createElement("div");
  notifBell.className = "notif-bell";
  notifBell.id = "notif-bell";
  notifBell.hidden = true;
  notifBell.innerHTML = `
    <button type="button" class="notif-bell-btn" aria-label="اعلان‌ها">🔔<span id="notif-count" class="fav-count" data-zero="true"></span></button>
    <div class="notif-panel" id="notif-panel" hidden></div>`;

  const authSlot = document.createElement("div");
  authSlot.className = "auth-slot";
  authSlot.id = "auth-slot";

  const cta = menu.querySelector(".nav-cta");
  if (cta) {
    menu.insertBefore(notifBell, cta);
    menu.insertBefore(authSlot, cta);
  } else {
    menu.appendChild(notifBell);
    menu.appendChild(authSlot);
  }

  notifBell.querySelector(".notif-bell-btn").addEventListener("click", () => {
    const panel = notifBell.querySelector("#notif-panel");
    panel.hidden = !panel.hidden;
    if (!panel.hidden) loadNotificationsPanel(panel);
  });

  renderAuthUI();
}

function renderAuthUI() {
  const authSlot = document.querySelector("#auth-slot");
  const notifBell = document.querySelector("#notif-bell");
  if (!authSlot) return;

  if (!isLoggedIn()) {
    authSlot.innerHTML = `<a href="login.html">ورود</a> / <a href="register.html">ثبت‌نام</a>`;
    if (notifBell) notifBell.hidden = true;
    return;
  }

  const user = getStoredUser();
  authSlot.innerHTML = `
    <a href="account.html">👤 ${user ? user.name : "حساب من"}</a>
    <a href="#" id="logout-link">خروج</a>`;
  authSlot.querySelector("#logout-link").addEventListener("click", (e) => {
    e.preventDefault();
    api.logout();
    window.location.href = "index.html";
  });

  if (notifBell) notifBell.hidden = false;
  refreshNotifCount();
  connectRealtime();
  onRealtime((payload) => {
    if (payload.kind === "notification") refreshNotifCount();
  });
}

async function refreshNotifCount() {
  const countEl = document.querySelector("#notif-count");
  if (!countEl) return;
  try {
    const list = await api.getNotifications();
    const unread = list.filter((n) => !n.read).length;
    countEl.textContent = toFa(unread);
    countEl.dataset.zero = unread === 0 ? "true" : "false";
  } catch {
    /* بی‌صدا نادیده گرفته می‌شود */
  }
}

async function loadNotificationsPanel(panel) {
  panel.innerHTML = `<p class="chat-loading">در حال بارگذاری...</p>`;
  try {
    const list = await api.getNotifications();
    if (!list.length) {
      panel.innerHTML = `<p class="chat-loading">اعلانی وجود ندارد.</p>`;
      return;
    }
    panel.innerHTML = list
      .slice(0, 15)
      .map(
        (n) =>
          `<div class="notif-item ${n.read ? "" : "unread"}" data-id="${n.id}">${n.text}<span class="notif-time">${relativeFa(n.createdAt.slice(0, 10))}</span></div>`
      )
      .join("");
    panel.querySelectorAll(".notif-item").forEach((el) => {
      el.addEventListener("click", async () => {
        await api.markNotificationRead(el.dataset.id).catch(() => {});
        el.classList.remove("unread");
        refreshNotifCount();
      });
    });
  } catch {
    panel.innerHTML = `<p class="chat-loading">خطا در دریافت اعلان‌ها</p>`;
  }
}

// ---------- صفحات ورود / ثبت‌نام ----------
function initLoginPage() {
  const form = document.querySelector("#login-form");
  if (!form) return;
  const errorBox = document.querySelector("#auth-error");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    if (errorBox) errorBox.hidden = true;
    try {
      await api.login(data.phone, data.password);
      const returnTo = getQueryParams().get("returnTo") || "index.html";
      window.location.href = returnTo;
    } catch (err) {
      if (errorBox) {
        errorBox.hidden = false;
        errorBox.textContent = err.message;
      }
    }
  });
}

function initRegisterPage() {
  const form = document.querySelector("#register-form");
  if (!form) return;
  const errorBox = document.querySelector("#auth-error");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    if (errorBox) errorBox.hidden = true;
    try {
      await api.register(data.phone, data.password, data.name);
      const returnTo = getQueryParams().get("returnTo") || "index.html";
      window.location.href = returnTo;
    } catch (err) {
      if (errorBox) {
        errorBox.hidden = false;
        errorBox.textContent = err.message;
      }
    }
  });
}

// ---------- صفحه حساب کاربری (آگهی‌های من، گفتگوها، اعلان‌ها) ----------
async function initAccountPage() {
  if (!isLoggedIn()) {
    window.location.href = "login.html?returnTo=account.html";
    return;
  }

  const nameEl = document.querySelector("#account-name");
  const phoneEl = document.querySelector("#account-phone");
  try {
    const me = await api.me();
    if (nameEl) nameEl.textContent = me.name;
    if (phoneEl) phoneEl.textContent = me.phone;
  } catch {
    api.logout();
    window.location.href = "login.html";
    return;
  }

  // آگهی‌های من
  const listingsEl = document.querySelector("#my-listings");
  if (listingsEl) {
    try {
      const mine = await api.myListings();
      if (!mine.length) {
        listingsEl.innerHTML = `<div class="empty-state">هنوز آگهی‌ای ثبت نکرده‌اید. <a href="add-listing.html">ثبت آگهی جدید</a></div>`;
      } else {
        listingsEl.innerHTML = mine
          .map(
            (l) => `
          <div class="my-listing-row">
            <a href="property.html?id=${l.id}">${l.title}</a>
            <span class="my-listing-meta">${l.featured ? "⭐ ویژه" : ""} ${l.urgent ? "🔥 فوری" : ""} — ${toFa(l.views || 0)} بازدید</span>
            <button type="button" class="btn btn-outline btn-sm" data-del="${l.id}">حذف</button>
          </div>`
          )
          .join("");
        listingsEl.querySelectorAll("[data-del]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            if (!confirm("آگهی حذف شود؟")) return;
            await api.deleteListing(btn.dataset.del).catch(() => {});
            btn.closest(".my-listing-row").remove();
          });
        });
      }
    } catch {
      listingsEl.innerHTML = `<p>خطا در دریافت آگهی‌های شما.</p>`;
    }
  }

  // گفتگوها
  const chatsEl = document.querySelector("#my-chats");
  if (chatsEl) {
    try {
      const chats = await api.listChats();
      if (!chats.length) {
        chatsEl.innerHTML = `<div class="empty-state">گفتگویی ندارید.</div>`;
      } else {
        chatsEl.innerHTML = chats
          .map(
            (c) => `
          <a class="my-listing-row" href="property.html?id=${c.listingId}">
            <span>${c.listingTitle}</span>
            <span class="my-listing-meta">${c.lastMessage || "بدون پیام"}</span>
          </a>`
          )
          .join("");
      }
    } catch {
      chatsEl.innerHTML = `<p>خطا در دریافت گفتگوها.</p>`;
    }
  }

  // اعلان‌ها
  const notifEl = document.querySelector("#my-notifications");
  if (notifEl) {
    try {
      const list = await api.getNotifications();
      if (!list.length) {
        notifEl.innerHTML = `<div class="empty-state">اعلانی ندارید.</div>`;
      } else {
        notifEl.innerHTML = list
          .map((n) => `<div class="notif-item ${n.read ? "" : "unread"}">${n.text}</div>`)
          .join("");
        api.markAllNotificationsRead().catch(() => {});
      }
    } catch {
      notifEl.innerHTML = `<p>خطا در دریافت اعلان‌ها.</p>`;
    }
  }
}

// ---------- راه‌انداز صفحه ----------
document.addEventListener("DOMContentLoaded", () => {
  initMobileNav();
  initTypeAndNeighborhoodSelects();
  updateFavCountBadge();
  initAuthUI();

  const page = document.body.dataset.page;
  if (page === "home") initHomePage();
  if (page === "listings") initListingsPage();
  if (page === "property") initPropertyPage();
  if (page === "add-listing") initAddListingPage();
  if (page === "favorites") initFavoritesPage();
  if (page === "login") initLoginPage();
  if (page === "register") initRegisterPage();
  if (page === "account") initAccountPage();

  const yearEl = document.querySelector("#current-year");
  if (yearEl) yearEl.textContent = toFa(new Date().getFullYear());
});

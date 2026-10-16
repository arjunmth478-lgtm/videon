
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const CLOUDINARY_CLOUD_NAME = "qiy9vnud";
const CLOUDINARY_UPLOAD_PRESET = "shopnix_unsigned";

const state = {
  products: [],
  categories: [],
  settings: {},
  visits: 0,
  user: null,
  authMode: "login",
  activeCategory: "All",
  search: "",
  sort: "featured",
  cart: readStore("shopnix_cart", {}),
  wishlist: readStore("shopnix_wishlist", []),
  adminTab: "products",
  adminData: null,
  editingId: null,
  selectedImages: [],
  selectedVideo: null,
  removedImages: [],
  removeVideo: false,
  uploading: false
};

function readStore(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveStore() {
  localStorage.setItem("shopnix_cart", JSON.stringify(state.cart));
  localStorage.setItem("shopnix_wishlist", JSON.stringify(state.wishlist));
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function money(n) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number(n) || 0);
}

function toast(msg) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2800);
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };

  if (options.body && !(options.body instanceof FormData)) {
    headers["content-type"] = "application/json";
  }

  const res = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers
  });

  let data = {};
  try {
    data = await res.json();
  } catch {}

  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data;
}

/* CLOUDINARY UPLOAD */

async function uploadToCloudinary(file, resourceType) {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error("Cloudinary configuration is missing.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  const endpoint =
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData
  });

  let result = {};
  try {
    result = await response.json();
  } catch {}

  if (!response.ok || !result.secure_url) {
    throw new Error(
      result.error?.message || `Upload failed for ${file.name}`
    );
  }

  return result.secure_url;
}

function openLayer(id) {
  $("#overlay")?.classList.add("show");
  $("#" + id)?.classList.add("open");
}

function closeLayers() {
  $("#overlay")?.classList.remove("show");
  $$(".drawer").forEach(x => x.classList.remove("open"));
  $$(".modal").forEach(x => x.classList.remove("show"));
}

function openModal(id) {
  closeLayers();
  $("#overlay")?.classList.add("show");
  $("#" + id)?.classList.add("show");
}

function productById(id) {
  return state.products.find(p => p.id === id) ||
    state.adminData?.products?.find(p => p.id === id);
}

function productImage(p) {
  return p?.images?.[0] || p?.imageUrl || "";
}

function totalCart() {
  return Object.entries(state.cart).reduce(
    (sum, [id, q]) => sum + (productById(id)?.price || 0) * q,
    0
  );
}

function countCart() {
  return Object.values(state.cart).reduce((a, b) => a + b, 0);
}

function categoryList() {
  return ["All", ...state.categories.map(c => c.name)];
}

function renderCategories() {
  const list = categoryList();

  $("#category-nav").innerHTML = list.map(c =>
    `<button class="category-pill ${state.activeCategory === c ? "active" : ""}"
      data-category="${esc(c)}">${esc(c === "All" ? "All products" : c)}</button>`
  ).join("");

  $("#category-filters").innerHTML = list.map(c =>
    `<button class="filter-chip ${state.activeCategory === c ? "active" : ""}"
      data-category="${esc(c)}">${esc(c)}</button>`
  ).join("");
}

function renderProducts() {
  let list = state.products.filter(p =>
    p.active !== false &&
    (state.activeCategory === "All" || p.category === state.activeCategory)
  );

  if (state.search) {
    const q = state.search.toLowerCase();
    list = list.filter(p =>
      `${p.name} ${p.category} ${p.description}`.toLowerCase().includes(q)
    );
  }

  if (state.sort === "price-low") list.sort((a, b) => a.price - b.price);
  if (state.sort === "price-high") list.sort((a, b) => b.price - a.price);
  if (state.sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));

  $("#result-count").textContent =
    `${list.length} ${list.length === 1 ? "product" : "products"}`;

  $("#product-grid").innerHTML = list.length
    ? list.map(p => `
      <article class="product-card">
        <div class="product-image-wrap">
          <img class="product-image" loading="lazy"
            src="${esc(productImage(p))}"
            alt="${esc(p.name)}"
            onerror="this.onerror=null;this.src='https://placehold.co/700x700/f1f2fb/6368a7?text=Shopnix'">

          <span class="product-badge">
            ${p.stock > 0 ? "SHOPNIX PICK" : "SOLD OUT"}
          </span>

          <button class="wish-btn ${state.wishlist.includes(p.id) ? "saved" : ""}"
            data-wish="${esc(p.id)}"
            aria-label="Add ${esc(p.name)} to wishlist">
            ${state.wishlist.includes(p.id) ? "♥" : "♡"}
          </button>
        </div>

        <div class="product-info">
          <span class="product-category">${esc(p.category)}</span>
          <h3>${esc(p.name)}</h3>
          <p>${esc(p.description)}</p>

          <div class="product-bottom">
            <span class="price">${money(p.price)}</span>
            <button class="add-btn" data-add="${esc(p.id)}"
              ${p.stock <= 0 ? "disabled" : ""}>
              ${p.stock <= 0 ? "Sold out" : "+ Add to bag"}
            </button>
          </div>

          <div class="stock-note">
            ${p.stock > 0 ? `${p.stock} available` : "Currently unavailable"}
          </div>
        </div>
      </article>
    `).join("")
    : `<div class="empty-state">${
        state.search
          ? `No results for “${esc(state.search)}”.`
          : "No products found in this category."
      }</div>`;
}

function renderCounts() {
  $("#cart-count").textContent = countCart();
  $("#wishlist-count").textContent = state.wishlist.length;
}

function renderCart() {
  const items = Object.entries(state.cart).filter(
    ([id, q]) => q > 0 && productById(id)
  );

  $("#cart-items").innerHTML = items.length
    ? items.map(([id, q]) => {
        const p = productById(id);

        return `
          <div class="cart-row">
            <img src="${esc(productImage(p))}" alt=""
              onerror="this.onerror=null;this.src='https://placehold.co/100x100/f1f2fb/6368a7?text=S'">

            <div>
              <h4>${esc(p.name)}</h4>
              <span class="small-price">${money(p.price)}</span>

              <div class="quantity-control">
                <button data-qty="${esc(id)}" data-delta="-1">−</button>
                <span>${q}</span>
                <button data-qty="${esc(id)}" data-delta="1">+</button>
              </div>

              <button class="remove-btn" data-remove="${esc(id)}">Remove</button>
            </div>

            <strong>${money(p.price * q)}</strong>
          </div>`;
      }).join("")
    : `<div class="empty-state">Your cart is waiting for its first find. ♡</div>`;

  $("#cart-total").textContent = money(totalCart());
  $("#checkout-btn").disabled = !items.length;
  $("#checkout-btn").style.opacity = items.length ? 1 : .5;
}

function renderWishlist() {
  const items = state.wishlist.map(id => productById(id)).filter(Boolean);

  $("#wishlist-items").innerHTML = items.length
    ? items.map(p => `
      <div class="cart-row">
        <img src="${esc(productImage(p))}" alt="">
        <div>
          <h4>${esc(p.name)}</h4>
          <span class="small-price">${money(p.price)}</span>
          <button class="remove-btn" data-wish="${esc(p.id)}">
            Remove from wishlist
          </button>
        </div>
        <button class="add-btn" data-add="${esc(p.id)}">Add</button>
      </div>
    `).join("")
    : `<div class="empty-state">Your wishlist is empty. Save something you love. ♡</div>`;
}

function refreshUI() {
  renderCategories();
  renderProducts();
  renderCounts();
  renderCart();
  renderWishlist();
}

function setAuthMode(mode) {
  state.authMode = mode;

  $("#name-wrap").classList.toggle("hidden", mode !== "register");
  $("#auth-name").required = mode === "register";

  $("#auth-title").textContent =
    mode === "admin" ? "Admin access." :
    mode === "register" ? "Create your Shopnix account." :
    "Your next favourite awaits.";

  $("#auth-submit").textContent =
    mode === "register" ? "Create account ↗" :
    mode === "admin" ? "Login as admin ↗" :
    "Login to Shopnix ↗";

  $$("[data-auth-tab]").forEach(b =>
    b.classList.toggle("active", b.dataset.authTab === mode)
  );

  $("#auth-message").textContent = "";
  $("#auth-password").autocomplete =
    mode === "register" ? "new-password" : "current-password";
}

async function showAccount() {
  if (state.user?.role === "admin") {
    await openAdmin();
    return;
  }

  if (state.user) {
    if (confirm(`Logged in as ${state.user.name}. Log out?`)) {
      await api("/api/logout", { method: "POST", body: "{}" });
      state.user = null;
      toast("You are logged out.");
      $("#account-open").textContent = "Login";
    }
    return;
  }

  setAuthMode("login");
  openModal("auth-modal");
}

async function refreshMe() {
  try {
    const d = await api("/api/me");
    state.user = d.user;

    $("#account-open").textContent = state.user
      ? (state.user.role === "admin"
          ? "Admin panel"
          : state.user.name.split(" ")[0])
      : "Login";
  } catch {}
}

async function load() {
  try {
    const d = await api("/api/bootstrap");

    state.products = d.products || [];
    state.categories = d.categories || [];
    state.settings = d.settings || {};
    state.visits = d.visits || 0;

    $("#hero-subtitle").textContent =
      state.settings.banner_text || "A little bit of everything. A whole lot of you.";

    $("#promo-copy").textContent =
      state.settings.banner_text || "Your next favourite is only a few clicks away.";

    await api("/api/visit", { method: "POST", body: "{}" });
    state.visits++;
  } catch (e) {
    $("#product-grid").innerHTML = `
      <div class="empty-state">
        Shopnix database is not connected yet. Follow README setup steps, then refresh this page.
        <br><small>${esc(e.message)}</small>
      </div>`;
  }

  await refreshMe();
  refreshUI();
}

function addToCart(id) {
  const p = productById(id);
  if (!p) return;

  if ((state.cart[id] || 0) >= p.stock) {
    toast("You have reached the available stock.");
    return;
  }

  state.cart[id] = (state.cart[id] || 0) + 1;
  saveStore();
  renderCart();
  renderCounts();
  toast("Added to your bag ✦");
}

function toggleWish(id) {
  state.wishlist = state.wishlist.includes(id)
    ? state.wishlist.filter(x => x !== id)
    : [...state.wishlist, id];

  saveStore();
  renderProducts();
  renderWishlist();
  renderCounts();
}

function changeQty(id, delta) {
  const p = productById(id);
  if (!p) return;

  const next = (state.cart[id] || 0) + delta;

  if (next <= 0) delete state.cart[id];
  else if (next <= p.stock) state.cart[id] = next;
  else toast("Available stock limit reached.");

  saveStore();
  renderCart();
  renderCounts();
}

function orderText() {
  const lines = Object.entries(state.cart)
    .filter(([id, q]) => q > 0 && productById(id))
    .map(([id, q]) => {
      const p = productById(id);
      return `• ${p.name} × ${q} — ${money(p.price * q)}`;
    });

  return `Hello Shopnix! I would like to place an order:

${lines.join("\n")}

Subtotal: ${money(totalCart())}
Name: ${state.user?.name || ""}
Email: ${state.user?.email || ""}
Please confirm availability and delivery details.`;
}

function startCheckout() {
  if (!state.user) {
    setAuthMode("login");
    openModal("auth-modal");
    toast("Please log in before ordering.");
    return;
  }

  if (!countCart()) return;

  $("#order-summary").innerHTML = `
    <strong>${countCart()} item(s) · ${money(totalCart())}</strong>
    <ul>
      ${Object.entries(state.cart)
        .filter(([id, q]) => q > 0 && productById(id))
        .map(([id, q]) =>
          `<li>${esc(productById(id).name)} × ${q}</li>`
        ).join("")}
    </ul>
    <span>Signed in as ${esc(state.user.name)}</span>`;

  openModal("order-modal");
}

function orderOn(method) {
  const text = orderText();

  if (method === "whatsapp") {
    const digits = String(state.settings.whatsapp || "+380 676235211")
      .replace(/[^\d]/g, "");

    if (digits.length < 8) {
      toast("Admin needs to set a valid WhatsApp number.");
      return;
    }

    window.open(
      `https://wa.me/${digits}?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener"
    );
  } else {
    const username = String(state.settings.telegram || "@Shop_nix")
      .replace(/^@/, "");

    if (!/^[A-Za-z0-9_]{5,32}$/.test(username)) {
      toast("Admin needs to set a valid Telegram username.");
      return;
    }

    window.open(`https://t.me/${username}`, "_blank", "noopener");
    toast("Telegram opened. Paste the order summary into the chat.");
  }

  closeLayers();
}

/* PRODUCT MEDIA STATE */

function resetProductMedia() {
  state.selectedImages = [];
  state.selectedVideo = null;
  state.removedImages = [];
  state.removeVideo = false;
  state.uploading = false;
}

function renderMediaPreview() {
  const imagePreview = $("#product-image-preview");
  const videoPreview = $("#product-video-preview");

  if (imagePreview) {
    const existing = state.editingId
      ? state.adminData?.products?.find(p => p.id === state.editingId)
      : null;

    const existingImages = existing?.images?.length
      ? existing.images
      : (existing?.imageUrl ? [existing.imageUrl] : []);

    const keptExisting = existingImages
      .map((url, originalIndex) => ({ url, originalIndex }))
      .filter(item => !state.removedImages.includes(item.originalIndex));

    const oldHTML = keptExisting.map(item => `
      <div style="position:relative;display:inline-block;margin:5px">
        <img src="${esc(item.url)}" alt="Existing product image"
          style="width:85px;height:85px;object-fit:cover;border-radius:10px">
        <button type="button" data-remove-existing-image="${item.originalIndex}"
          style="position:absolute;top:2px;right:2px;border:0;border-radius:50%;cursor:pointer">×</button>
      </div>
    `).join("");

    const newHTML = state.selectedImages.map((src, i) => `
      <div style="position:relative;display:inline-block;margin:5px">
        <img src="${esc(src)}" alt="New product image"
          style="width:85px;height:85px;object-fit:cover;border-radius:10px">
        <button type="button" data-remove-image="${i}"
          style="position:absolute;top:2px;right:2px;border:0;border-radius:50%;cursor:pointer">×</button>
      </div>
    `).join("");

    imagePreview.innerHTML = oldHTML + newHTML;
  }

  if (videoPreview) {
    const existing = state.editingId
      ? state.adminData?.products?.find(p => p.id === state.editingId)
      : null;

    if (state.selectedVideo) {
      videoPreview.innerHTML = `
        <video src="${esc(state.selectedVideo)}" controls
          style="max-width:220px;max-height:150px;border-radius:10px"></video>
        <button type="button" class="secondary-btn" id="remove-selected-video">Remove new video</button>`;
    } else if (existing?.videoUrl && !state.removeVideo) {
      videoPreview.innerHTML = `
        <video src="${esc(existing.videoUrl)}" controls
          style="max-width:220px;max-height:150px;border-radius:10px"></video>
        <button type="button" class="secondary-btn" id="remove-existing-video">Remove video</button>`;
    } else {
      videoPreview.innerHTML = "";
    }
  }
}

async function openAdmin() {
  try {
    state.adminData = await api("/api/admin/data");
    state.adminTab = "products";
    state.editingId = null;
    resetProductMedia();
    renderAdmin();
    openModal("admin-modal");
  } catch (e) {
    toast(e.message);

    if (e.message.toLowerCase().includes("login")) {
      setAuthMode("admin");
      openModal("auth-modal");
    }
  }
}

function renderAdmin() {
  const d = state.adminData;
  if (!d) return;

  $("#admin-content").innerHTML = `
    <div class="admin-stats">
      <div class="stat-card"><span>Total visits</span><strong>${d.visits}</strong></div>
      <div class="stat-card"><span>Products</span><strong>${d.products.length}</strong></div>
      <div class="stat-card"><span>Customers</span><strong>${d.customers}</strong></div>
    </div>

    <div class="admin-tabs">
      <button class="admin-tab ${state.adminTab === "products" ? "active" : ""}" data-admin-tab="products">Products</button>
      <button class="admin-tab ${state.adminTab === "categories" ? "active" : ""}" data-admin-tab="categories">Categories</button>
      <button class="admin-tab ${state.adminTab === "settings" ? "active" : ""}" data-admin-tab="settings">Store settings</button>
      <button class="admin-tab ${state.adminTab === "backup" ? "active" : ""}" data-admin-tab="backup">Backup / export</button>
      <button class="admin-tab" id="admin-logout">Log out</button>
    </div>

    <div class="admin-panel">${adminPanelHTML(d)}</div>`;
}

function adminPanelHTML(d) {
  if (state.adminTab === "products") {
    const p = state.editingId
      ? d.products.find(x => x.id === state.editingId)
      : null;

    const currentImages = p?.images?.length
      ? p.images
      : (p?.imageUrl ? [p.imageUrl] : []);

    return `
      <h3>${p ? "Edit product" : "Add a product"}</h3>

      <form id="product-form" class="admin-form">
        <label>Product name
          <input name="name" required maxlength="160" value="${esc(p?.name || "")}">
        </label>

        <label>Category
          <select name="category" required>
            ${d.categories.map(c => `
              <option value="${esc(c.name)}" ${p?.category === c.name ? "selected" : ""}>
                ${esc(c.name)}
              </option>
            `).join("")}
          </select>
        </label>

        <label>Price (₹)
          <input name="price" type="number" min="0" step="0.01" required
            value="${esc(p?.price ?? "")}">
        </label>

        <label>Stock quantity
          <input name="stock" type="number" min="0" step="1" required
            value="${esc(p?.stock ?? 10)}">
        </label>

        <label class="wide">
          Product photos (maximum 5)
          <input id="product-images" type="file" accept="image/*" multiple>
          <small>Select up to 5 photos, 2 MB maximum each. New uploads are added to existing photos.</small>
        </label>

        <div id="product-image-preview" class="wide" style="display:flex;flex-wrap:wrap">
          ${currentImages.map((src, i) => `
            <div style="position:relative;display:inline-block;margin:5px">
              <img src="${esc(src)}" alt="Product image ${i + 1}"
                style="width:85px;height:85px;object-fit:cover;border-radius:10px">
              <button type="button" data-remove-existing-image="${i}"
                style="position:absolute;top:2px;right:2px;border:0;border-radius:50%;cursor:pointer">×</button>
            </div>
          `).join("")}
        </div>

        <label class="wide">
          Product video (maximum 5 MB)
          <input id="product-video" type="file" accept="video/*">
        </label>

        <div id="product-video-preview" class="wide">
          ${p?.videoUrl ? `
            <video src="${esc(p.videoUrl)}" controls style="max-width:220px;max-height:150px"></video>
            <button type="button" class="secondary-btn" id="remove-existing-video">Remove video</button>
          ` : ""}
        </div>

        <label class="wide">Description
          <textarea name="description" rows="2" maxlength="1000">${esc(p?.description || "")}</textarea>
        </label>

        <button class="primary-btn" type="submit" ${state.uploading ? "disabled" : ""}>
          ${p ? "Save changes" : "Add product"} ↗
        </button>

        ${p ? '<button class="secondary-btn" type="button" id="cancel-edit">Cancel edit</button>' : ""}
      </form>

      <h3 style="margin-top:25px">All products</h3>

      <div class="admin-list">
        ${d.products.map(p => `
          <div class="admin-list-row">
            <img src="${esc(productImage(p))}" alt="">
            <div class="grow">
              <strong>${esc(p.name)}</strong>
              <small>${esc(p.category)} · ${money(p.price)} · stock ${p.stock}</small>
            </div>
            <button class="secondary-btn" data-edit="${esc(p.id)}">Edit</button>
            <button class="danger-btn" data-delete-product="${esc(p.id)}">Delete</button>
          </div>
        `).join("") || '<div class="admin-empty">No products yet.</div>'}
      </div>`;
  }

  if (state.adminTab === "categories") {
    return `
      <h3>Manage categories</h3>
      <form id="category-form" class="admin-form">
        <label>New category name
          <input name="name" required maxlength="100">
        </label>
        <button class="primary-btn" type="submit">Add category ↗</button>
      </form>

      <div class="admin-list">
        ${d.categories.map(c => `
          <div class="admin-list-row">
            <div class="grow"><strong>${esc(c.name)}</strong></div>
            <button class="danger-btn" data-delete-category="${esc(c.id)}">Delete</button>
          </div>
        `).join("")}
      </div>

      <p class="settings-note">
        A category can be deleted only after its products have been moved or deleted.
      </p>`;
  }

  if (state.adminTab === "settings") {
    return `
      <h3>Store settings</h3>
      <form id="settings-form" class="admin-form">
        <label>WhatsApp number (with country code)
          <input name="whatsapp" required value="${esc(d.settings.whatsapp || "")}">
        </label>
        <label>Telegram username
          <input name="telegram" required value="${esc(d.settings.telegram || "")}">
        </label>
        <label class="wide">Custom banner text
          <input name="banner_text" maxlength="300" value="${esc(d.settings.banner_text || "")}">
        </label>
        <label class="wide">Store name
          <input name="store_name" value="${esc(d.settings.store_name || "Shopnix")}">
        </label>
        <button class="primary-btn" type="submit">Save settings ↗</button>
      </form>

      <p class="settings-note">
        WhatsApp should include country code. Telegram username should not contain the t.me URL.
        Google Login needs OAuth setup.
      </p>`;
  }

  if (state.adminTab === "backup") {
    return `
      <h3>Database backup</h3>
      <p class="settings-note">
        Download a JSON export of products, categories, store settings and customer profile basics.
        Password hashes and login sessions are not included.
      </p>
      <button class="primary-btn" id="download-backup">Download backup ↗</button>`;
  }

  return "";
}

async function reloadAdmin() {
  state.adminData = await api("/api/admin/data");
  renderAdmin();
  refreshUI();
}

function downloadJson(data, name) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* MEDIA FILE SELECTION AND UPLOAD */

$("#admin-content").addEventListener("change", async e => {
  if (e.target.id === "product-images") {
    const files = [...e.target.files];

    if (!files.length) return;

    const existing = state.editingId
      ? state.adminData?.products?.find(p => p.id === state.editingId)
      : null;

    const oldImages = existing?.images?.length
      ? existing.images
      : (existing?.imageUrl ? [existing.imageUrl] : []);

    const keptCount = oldImages.filter(
      (_, i) => !state.removedImages.includes(i)
    ).length;

    if (keptCount + state.selectedImages.length + files.length > 5) {
      e.target.value = "";
      toast(`Maximum 5 images total. You already have ${keptCount + state.selectedImages.length}.`);
      return;
    }

    if (files.some(file => !file.type.startsWith("image/"))) {
      e.target.value = "";
      toast("Please select image files only.");
      return;
    }

    if (files.some(file => file.size > 2 * 1024 * 1024)) {
      e.target.value = "";
      toast("Each photo must be 2 MB or smaller.");
      return;
    }

    try {
      state.uploading = true;
      toast("Uploading images to Cloudinary...");

      const uploaded = await Promise.all(
        files.map(file => uploadToCloudinary(file, "image"))
      );

      state.selectedImages.push(...uploaded);
      renderMediaPreview();
      toast("Images uploaded successfully!");
    } catch (err) {
      toast(err.message);
    } finally {
      state.uploading = false;
      e.target.value = "";
    }
  }

  if (e.target.id === "product-video") {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      e.target.value = "";
      toast("Please select a video file.");
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      e.target.value = "";
      toast("Video must be 5 MB or smaller.");
      e.target.value = "";
      return;
    }

    try {
      state.uploading = true;
      toast("Uploading video to Cloudinary...");

      state.selectedVideo = await uploadToCloudinary(file, "video");
      state.removeVideo = false;
      renderMediaPreview();
      toast("Video uploaded successfully!");
    } catch (err) {
      toast(err.message);
    } finally {
      state.uploading = false;
      e.target.value = "";
    }
  }
});

document.addEventListener("click", async e => {
  const t = e.target.closest("button,a");
  if (!t) return;

  if (t.matches("[data-remove-image]")) {
    state.selectedImages.splice(Number(t.dataset.removeImage), 1);
    renderMediaPreview();
    return;
  }

  if (t.matches("[data-remove-existing-image]")) {
    const index = Number(t.dataset.removeExistingImage);
    if (!state.removedImages.includes(index)) {
      state.removedImages.push(index);
    }
    renderMediaPreview();
    return;
  }

  if (t.id === "remove-selected-video") {
    state.selectedVideo = null;
    renderMediaPreview();
    return;
  }

  if (t.id === "remove-existing-video") {
    state.removeVideo = true;
    state.selectedVideo = null;
    renderMediaPreview();
    return;
  }

  if (t.matches("[data-close]")) {
    closeLayers();
    return;
  }

  if (t.id === "overlay") {
    closeLayers();
    return;
  }

  if (t.id === "cart-open") {
    renderCart();
    openLayer("cart-drawer");
    return;
  }

  if (t.id === "wishlist-open") {
    renderWishlist();
    openLayer("wishlist-drawer");
    return;
  }

  if (t.id === "account-open") {
    showAccount();
    return;
  }

  if (t.matches("[data-category]")) {
    state.activeCategory = t.dataset.category;
    refreshUI();
    return;
  }

  if (t.matches("[data-add]")) {
    addToCart(t.dataset.add);
    return;
  }

  if (t.matches("[data-wish]")) {
    toggleWish(t.dataset.wish);
    return;
  }

  if (t.matches("[data-qty]")) {
    changeQty(t.dataset.qty, Number(t.dataset.delta));
    return;
  }

  if (t.matches("[data-remove]")) {
    delete state.cart[t.dataset.remove];
    saveStore();
    renderCart();
    renderCounts();
    return;
  }

  if (t.id === "checkout-btn") {
    startCheckout();
    return;
  }

  if (t.id === "order-whatsapp") {
    orderOn("whatsapp");
    return;
  }

  if (t.id === "order-telegram") {
    orderOn("telegram");
    return;
  }

  if (t.matches("[data-auth-tab]")) {
    setAuthMode(t.dataset.authTab);
    return;
  }

  if (t.matches("[data-admin-tab]")) {
    state.adminTab = t.dataset.adminTab;
    state.editingId = null;
    resetProductMedia();
    renderAdmin();
    return;
  }

  if (t.id === "admin-logout") {
    await api("/api/logout", { method: "POST", body: "{}" });
    state.user = null;
    state.adminData = null;
    $("#account-open").textContent = "Login";
    closeLayers();
    toast("Admin logged out.");
    return;
  }

  if (t.matches("[data-edit]")) {
    state.editingId = t.dataset.edit;
    state.adminTab = "products";
    resetProductMedia();
    renderAdmin();
    renderMediaPreview();
    return;
  }

  if (t.matches("[data-delete-product]")) {
    if (confirm("Delete this product?")) {
      try {
        await api(`/api/admin/products/${encodeURIComponent(t.dataset.deleteProduct)}`, {
          method: "DELETE"
        });
        state.editingId = null;
        resetProductMedia();
        await reloadAdmin();
        toast("Product deleted.");
      } catch (err) {
        toast(err.message);
      }
    }
    return;
  }

  if (t.matches("[data-delete-category]")) {
    if (confirm("Delete this category?")) {
      try {
        await api(`/api/admin/categories/${encodeURIComponent(t.dataset.deleteCategory)}`, {
          method: "DELETE"
        });
        await reloadAdmin();
        toast("Category deleted.");
      } catch (err) {
        toast(err.message);
      }
    }
    return;
  }

  if (t.id === "cancel-edit") {
    state.editingId = null;
    resetProductMedia();
    renderAdmin();
    return;
  }

  if (t.id === "download-backup") {
    try {
      const data = await api("/api/admin/backup");
      downloadJson(data, `shopnix-backup-${new Date().toISOString().slice(0, 10)}.json`);
      toast("Backup downloaded.");
    } catch (err) {
      toast(err.message);
    }
    return;
  }
});

$("#overlay").addEventListener("click", closeLayers);

$("#search-form").addEventListener("submit", e => {
  e.preventDefault();
  state.search = $("#search-input").value.trim();
  renderProducts();
  $("#products").scrollIntoView({ behavior: "smooth" });
});

$("#search-input").addEventListener("input", () => {
  state.search = $("#search-input").value.trim();
  renderProducts();
});

$("#sort-select").addEventListener("change", () => {
  state.sort = $("#sort-select").value;
  renderProducts();
});

$("#auth-form").addEventListener("submit", async e => {
  e.preventDefault();

  const msg = $("#auth-message");
  msg.textContent = "Please wait…";

  const body = {
    email: $("#auth-email").value.trim(),
    password: $("#auth-password").value
  };

  if (state.authMode === "register") {
    body.name = $("#auth-name").value.trim();
  }

  try {
    const d = await api(
      state.authMode === "register" ? "/api/register" : "/api/login",
      { method: "POST", body: JSON.stringify(body) }
    );

    state.user = d.user;
    $("#account-open").textContent =
      state.user.role === "admin" ? "Admin panel" : state.user.name.split(" ")[0];

    closeLayers();
    toast(state.authMode === "register" ? "Account created." : "Welcome to Shopnix!");

    if (state.user.role === "admin") await openAdmin();
  } catch (err) {
    msg.textContent = err.message;
  }
});

$("#admin-content").addEventListener("submit", async e => {
  e.preventDefault();

  const form = e.target;
  const fd = new FormData(form);

  try {
    if (form.id === "product-form") {
      if (state.uploading) {
        toast("Please wait for media uploads to finish.");
        return;
      }

      const data = Object.fromEntries(fd.entries());

      data.price = Number(data.price);
      data.stock = Number(data.stock);

      if (state.editingId) data.id = state.editingId;

      const existing = state.editingId
        ? state.adminData.products.find(p => p.id === state.editingId)
        : null;

      const oldImages = existing?.images?.length
        ? existing.images
        : (existing?.imageUrl ? [existing.imageUrl] : []);

      const keptImages = oldImages.filter(
        (_, index) => !state.removedImages.includes(index)
      );

      const finalImages = [...keptImages, ...state.selectedImages];

      if (finalImages.length > 5) {
        toast("Maximum 5 product images allowed.");
        return;
      }

      data.images = finalImages;
      data.imageUrl = finalImages[0] || "";

      if (state.selectedVideo) {
        data.videoUrl = state.selectedVideo;
      } else if (state.removeVideo) {
        data.videoUrl = "";
      } else {
        data.videoUrl = existing?.videoUrl || "";
      }

      await api("/api/admin/products", {
        method: "POST",
        body: JSON.stringify(data)
      });

      state.editingId = null;
      resetProductMedia();
      await reloadAdmin();
      toast("Product saved successfully.");
    }

    if (form.id === "category-form") {
      await api("/api/admin/categories", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(fd.entries()))
      });

      await reloadAdmin();
      toast("Category added.");
    }

    if (form.id === "settings-form") {
      await api("/api/admin/settings", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(fd.entries()))
      });

      await reloadAdmin();
      $("#hero-subtitle").textContent = state.settings.banner_text || "";
      toast("Store settings saved.");
    }
  } catch (err) {
    toast(err.message);
  }
});

$("#year").textContent = new Date().getFullYear();

$("#about-link").addEventListener("click", e => {
  e.preventDefault();
  alert("Shopnix is a curated online shopping showcase. Orders are placed directly through the store's selected contact method.");
});

$("#contact-link").addEventListener("click", e => {
  e.preventDefault();
  alert(`Contact Shopnix on WhatsApp: ${state.settings.whatsapp || "+380 676235211"} or Telegram: ${state.settings.telegram || "@Shop_nix"}`);
});

load();

/* =========================================================
   CONFIG
========================================================= */
const API = `${window.location.origin}/api`;

function getStoredItem(key) {
  return localStorage.getItem(key) || sessionStorage.getItem(key);
}

function clearStoredItem(key) {
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
}

function getAuthHeaders() {
  const token = getStoredItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function protectUserPage() {
  // No-op guard for pages that call this onload.
  // Keep home public; redirecting would be too aggressive here.
}


function protectAdminPage() {
  const token = getStoredItem("token");
  const role = getStoredItem("role");

  if (!token || role !== "admin") {
    window.location.href = "admin-login.html";
  }
}

if (window.location.pathname.includes("admin.html")) {
  protectAdminPage();
}

function updateCartCount() {
  const el = document.getElementById("cart-count");
  if (!el) return;

  const headers = getAuthHeaders();
  if (!headers.Authorization) {
    el.innerText = "0";
    return;
  }

  fetch(`${API}/cart`, { headers })
    .then(res => (res.ok ? res.json() : { items: [] }))
    .then(data => {
      const count = (data.items || []).reduce((sum, item) => sum + item.qty, 0);
      el.innerText = count;
    })
    .catch(() => {
      el.innerText = "0";
    });
}

/* =========================================================
   ADD TO CART
========================================================= */
function addToCart(productId) {
  const qtyInput = document.getElementById(`qty-${productId}`);
  let qty = 1;
  if (qtyInput) {
    const max = parseInt(qtyInput.getAttribute("data-max") || "0", 10);
    qty = parseInt(qtyInput.value || "1", 10);
    if (Number.isNaN(qty) || qty < 1) qty = 1;
    if (max && qty > max) qty = max;
  }

  fetch(`${API}/cart`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders()
    },
    body: JSON.stringify({ productId, qty })
  })
    .then(res => res.json())
    .then(() => {
      alert("Added to cart");
      updateCartCount();
    });
}
function loadCart() {
  fetch(`${API}/cart`, {
    headers: { ...getAuthHeaders() }
  })
    .then(res => res.json())
    .then(cart => {
      const div = document.getElementById("cart-list");
      if (!div) return;
      const items = (cart.items || []).filter(i => i && i.product);

      if (items.length === 0) {
        div.innerHTML = "<p>Your cart is empty.</p>";
        const totalEl = document.getElementById("total");
        if (totalEl) totalEl.innerText = "0";
        return;
      }

      let total = 0;

      div.innerHTML = items.map(i => {
        const lineTotal = (i.product?.price || 0) * i.qty;
        total += lineTotal;

        return `
          <div class="cart-item">
            <img class="cart-img" src="${i.product?.image || ""}" alt="${i.product?.name || "Product"}">
            <div class="cart-info">
              <h4>${i.product?.name || "Product"}</h4>
              <p>₹${i.product?.price || 0}</p>
            </div>
            <div class="cart-qty">
              <button onclick="updateQty('${i.product?._id}', ${i.qty - 1})">−</button>
              <span>${i.qty}</span>
              <button onclick="updateQty('${i.product?._id}', ${i.qty + 1})">+</button>
              <button class="cart-remove-btn" onclick="removeCartItem('${i.product?._id}')">Remove</button>
            </div>
            <div class="cart-line">₹${lineTotal}</div>
          </div>
        `;
      }).join("");

      const totalEl = document.getElementById("total");
      if (totalEl) totalEl.innerText = total;
    });
}
function cancelOrder(orderId) {
  const ok = confirm("Are you sure you want to cancel this order?");
  if (!ok) return;
  fetch(`${API}/orders/${orderId}/cancel`, {
    method: "PUT",
    headers: { ...getAuthHeaders() }
  })
    .then(res => res.json())
    .then(data => {
      alert(data.message);
      loadMyOrders();
    });
}

function updateQty(productId, qty) {
  fetch(`${API}/cart/update`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders()
    },
    body: JSON.stringify({ productId, qty })
  })
    .then(() => loadCart());
}

function removeCartItem(productId) {
  fetch(`${API}/cart/update`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders()
    },
    body: JSON.stringify({ productId, qty: 0 })
  })
    .then(() => loadCart())
    .then(() => updateCartCount());
}

async function checkout() {
  const headers = getAuthHeaders();
  if (!headers.Authorization) {
    alert("Please login to place an order");
    window.location.href = "user-login.html";
    return;
  }
  if (getStoredItem("role") !== "user") {
    alert("Please login as user to place order");
    window.location.href = "user-login.html";
    return;
  }

  try {
    const cartRes = await fetch(`${API}/cart`, { headers });
    const cartData = await cartRes.json();

    if (!cartRes.ok) {
      alert(cartData.message || "Failed to load cart");
      return;
    }

    if (!cartData.items || cartData.items.length === 0) {
      alert("Your cart is empty");
      return;
    }

    const items = cartData.items.map(i => ({
      product: i.product?._id,
      qty: i.qty,
      price: i.product?.price || 0
    }));

    const orderRes = await fetch(`${API}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: JSON.stringify({ items })
    });

    const orderData = await orderRes.json();
    if (!orderRes.ok) {
      alert(orderData.message || "Order failed");
      return;
    }

    localStorage.setItem("last_order_id", orderData._id || "");
    window.location.href = "payment.html";
  } catch (err) {
    alert("Network error. Please try again.");
    console.error("Checkout failed:", err);
  }
}

/* =========================================================
   USER PRODUCTS
========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  const productList = document.getElementById("product-list");
  if (productList) {
    loadAllProducts(document.querySelector(".tab"));
    startProductSse();
  }
});

let productPollerId;
let productSse;
let orderPollerId;
let orderSse;

function isSearchTyping() {
  const search = document.getElementById("search");
  const searchValue = search ? search.value.trim() : "";
  return (
    search &&
    searchValue &&
    (Date.now() - Number(search.dataset.lastTyping || 0) < 1200)
  );
}

function changeProductQty(productId, delta) {
  const input = document.getElementById(`qty-${productId}`);
  if (!input) return;
  const max = parseInt(input.getAttribute("data-max") || "0", 10);
  let next = parseInt(input.value || "1", 10);
  if (Number.isNaN(next)) next = 1;
  next += delta;
  if (next < 1) next = 1;
  if (max && next > max) next = max;
  input.value = next;
}

function refreshProductsView() {
  const search = document.getElementById("search");
  const searchValue = search ? search.value.trim() : "";
  if (searchValue) {
    searchProducts();
    return;
  }

  const activeTab = document.querySelector(".category-tabs .tab.active");
  const label = activeTab ? activeTab.textContent.trim().toLowerCase() : "";
  if (label === "herbicides" || label === "herbicide") {
    loadByCategory("herbicide", activeTab);
    return;
  }
  if (label === "fertilizers" || label === "fertilizer") {
    loadByCategory("fertilizer", activeTab);
    return;
  }
  if (label === "pesticides" || label === "pesticide") {
    loadByCategory("pesticide", activeTab);
    return;
  }

  loadAllProducts(activeTab || document.querySelector(".tab"));
}

function startProductPolling() {
  const list = document.getElementById("product-list");
  if (!list) return;
  if (productPollerId) return;

  productPollerId = setInterval(() => {
    if (isSearchTyping()) return;
    refreshProductsView();
  }, 15000);
}

function startProductSse() {
  const list = document.getElementById("product-list");
  if (!list) return;

  if (typeof EventSource === "undefined") {
    startProductPolling();
    return;
  }

  try {
    productSse = new EventSource(`${API}/stream/products`);
    productSse.onmessage = () => {
      if (isSearchTyping()) return;
      refreshProductsView();
    };
    productSse.onerror = () => {
      if (productSse && productSse.readyState === 2) {
        productSse.close();
        productSse = null;
        startProductPolling();
      }
    };
  } catch (e) {
    startProductPolling();
  }
}

async function clearCartAfterPayment() {
  const headers = getAuthHeaders();
  if (!headers.Authorization) return;
  try {
    await fetch(`${API}/cart`, {
      method: "DELETE",
      headers
    });
    loadCart();
    updateCartCount();
  } catch (err) {
    console.error("Cart clear failed:", err);
  }
}

document.addEventListener("input", (e) => {
  if (e.target && e.target.id === "search") {
    e.target.dataset.lastTyping = Date.now();
  }
});

/* =========================================================
   ADMIN: LOAD PRODUCTS
========================================================= */
function loadAdminProducts() {
  fetch(`${API}/products`)
    .then(res => res.json())
    .then(products => {
      const div = document.getElementById("admin-products");
      if (!div) return;

      div.innerHTML = "";

      products.forEach(p => {
        const baseUrl = API.replace("/api", "");
        const imgSrc = p.image?.startsWith("http")
          ? p.image
          : `${baseUrl}${p.image || ""}`;
        const lowStock =
          p.quantity <= 5
            ? `<p style="color:red;font-weight:bold">⚠ Low Stock</p>`
            : "";

        div.innerHTML += `
          <div class="card">
            <img src="${imgSrc}" width="120">
            <h3>${p.name}</h3>
            <p>₹${p.price}</p>
            <div class="admin-qty-row">
              <label for="admin-qty-${p._id}">Qty</label>
              <input id="admin-qty-${p._id}" type="number" min="0" value="${p.quantity}">
              <button onclick="updateProductQuantity('${p._id}')">Update</button>
              <button class="btn-remove" onclick="removeProduct('${p._id}')">Remove</button>
            </div>
            ${lowStock}
          </div>
        `;
      });
    });
}

function updateProductQuantity(productId) {
  const input = document.getElementById(`admin-qty-${productId}`);
  if (!input) return;
  const quantity = Number(input.value);
  if (Number.isNaN(quantity) || quantity < 0) {
    alert("Enter a valid quantity");
    return;
  }

  fetch(`${API}/products/${productId}/quantity`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ quantity })
  })
    .then(res => res.json())
    .then(data => {
      if (data.message) {
        alert(data.message);
        return;
      }
      loadAdminProducts();
      loadAdminDashboard();
      if (document.getElementById("product-list")) {
        loadAllProducts(document.querySelector(".tab"));
      }
    });
}

function removeProduct(productId) {
  const ok = confirm("Remove this product?");
  if (!ok) return;

  fetch(`${API}/products/${productId}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() }
  })
    .then(async res => {
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          alert("Admin session invalid. Please login as admin again.");
          window.location.href = "admin-login.html";
          return;
        }
        alert(data.message || "Failed to remove product");
        return;
      }
      loadAdminProducts();
      loadAdminDashboard();
      if (document.getElementById("product-list")) {
        loadAllProducts(document.querySelector(".tab"));
      }
    })
    .catch(() => alert("Failed to remove product"));
}

/* =========================================================
   ADMIN: ADD PRODUCT
========================================================= */
document.getElementById("productForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const token = getStoredItem("token");
  const role = getStoredItem("role");
  if (!token || role !== "admin") {
    alert("Admin login required");
    window.location.href = "admin-login.html";
    return;
  }
  const formData = new FormData(e.target);

  const res = await fetch(`${API}/products`, {
    method: "POST",
    headers: {
      ...getAuthHeaders()
    },
    body: formData
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.message || "Product upload failed");
    return;
  }

  alert("✅ Product added successfully");
  e.target.reset();
  loadAdminProducts();
});

/* =========================================================
   ADMIN: LOAD ORDERS
========================================================= */
function loadAdminOrders() {
  fetch(`${API}/orders`, {
    headers: { ...getAuthHeaders() }
  })
    .then(res => res.json())
    .then(orders => {
      const table = document.getElementById("orders");
      if (!table) return;

      table.innerHTML = orders.map(o => {
        const statusClass =
          o.status === "Approved"
            ? "status-approved"
            : o.status === "Cancelled"
              ? "status-cancelled"
              : "status-pending";
        const isPayOnShop = o.paymentMethod === "Pay on Shop";
        const isPayByQr = o.paymentMethod === "Pay by QR";
        const isPaid = o.paymentStatus === "Confirmed";
        const paymentClass =
          isPaid
            ? "status-approved"
            : o.paymentStatus === "Selected"
              ? "status-pending"
              : "status-cancelled";
        const paymentLabel = o.paymentStatus || "Pending";
        
        const total = (o.items || []).reduce((sum, i) => {
          const price = i.price || i.product?.price || 0;
          return sum + price * i.qty;
        }, 0);

        return `
        <tr>
          <td>${o.user?.name || "User"}</td>
          <td><span class="status-badge ${statusClass}">${o.status}</span></td>
          <td>
            <div>${o.paymentMethod || "Pending"}</div>
            <div><span class="status-badge ${paymentClass}">${paymentLabel}</span></div>
          </td>
          <td>
            ${(o.items || []).map(i => `
              <div style="margin-bottom:6px;">
                <div style="display:flex; gap:8px; align-items:center;">
                  <img src="${i.product?.image || ""}" alt="${i.product?.name || "Product"}" width="40" height="40" style="object-fit:contain;background:#f7f7f7;border-radius:6px;padding:4px;">
                  <div>
                    <strong>${i.product?.name || "Product"}</strong>
                    <div>Qty: ${i.qty} x Rs.${i.price || i.product?.price || 0}</div>
                  </div>
                </div>
              </div>
            `).join("")}
          </td>
          <td>Rs.${total}</td>
          <td>
            ${
              isPayOnShop && o.status === "Pending"
                ? `<button onclick="approveOrder('${o._id}')">Approve</button>
                   <button onclick="rejectOrder('${o._id}')">Reject</button>`
                : o.status
            }
            ${
              isPayByQr && o.paymentStatus !== "Confirmed"
                ? `<button onclick="confirmPayment('${o._id}')">Confirm Payment</button>`
                : ""
            }
          </td>
        </tr>
      `;
      }).join("");
    });
}

function approveOrder(orderId) {
  fetch(`${API}/orders/${orderId}`, {
    method: "PUT",
    headers: { ...getAuthHeaders() }
  })
    .then(() => {
      alert("Order approved");
      loadAdminOrders();
    });
}

function rejectOrder(orderId) {
  fetch(`${API}/orders/${orderId}/reject`, {
    method: "PUT",
    headers: { ...getAuthHeaders() }
  })
    .then(res => res.json())
    .then(data => {
      alert(data.message || "Order rejected");
      loadAdminOrders();
    });
}

function confirmPayment(orderId) {
  fetch(`${API}/orders/${orderId}/confirm-payment`, {
    method: "PUT",
    headers: { ...getAuthHeaders() }
  })
    .then(res => res.json())
    .then(data => {
      alert(data.message || "Payment confirmed");
      loadAdminOrders();
    });
}

function loadAdminUsers() {
  fetch(`${API}/admin/users`, {
    headers: { ...getAuthHeaders() }
  })
    .then(res => res.json())
    .then(users => {
      const table = document.getElementById("admin-users");
      if (!table) return;

      table.innerHTML = users.map(u => `
        <tr>
          <td>${u.name || ""}</td>
          <td>${u.mobile || ""}</td>
          <td>${u.role || "user"}</td>
        </tr>
      `).join("");
    });
}

function formatNotificationTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function escapeAttr(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/"/g, "&quot;");
}

function toggleAdminNotifications() {
  const modal = document.getElementById("admin-notification-modal");
  if (!modal) return;
  modal.style.display = "flex";
  loadAdminNotifications();
}

function closeAdminNotifications() {
  const modal = document.getElementById("admin-notification-modal");
  if (!modal) return;
  modal.style.display = "none";
}

function loadAdminNotifications() {
  const listEl = document.getElementById("admin-notification-list");
  const countEl = document.getElementById("admin-notification-count");
  if (!listEl || !countEl) return;

  fetch(`${API}/notifications/admin`, {
    headers: { ...getAuthHeaders() }
  })
    .then(res => (res.ok ? res.json() : []))
    .then((items) => {
      const notifications = Array.isArray(items) ? items : [];
      const unreadCount = notifications.filter(n => !n.isRead).length;

      countEl.innerText = unreadCount;
      countEl.style.display = unreadCount > 0 ? "inline-flex" : "none";

      if (notifications.length === 0) {
        listEl.innerHTML = `<div class="admin-notification-empty">No notifications yet.</div>`;
        return;
      }

      listEl.innerHTML = notifications.map(n => {
        const userName = n.metadata?.userName || n.metadata?.name || "";
        const mobile = n.metadata?.mobile || "";
        const products = Array.isArray(n.metadata?.products) ? n.metadata.products.join("|") : "";
        return `
        <div class="admin-notification-item ${n.isRead ? "is-read" : "is-unread"}"
             data-id="${escapeAttr(n._id)}"
             data-type="${escapeAttr(n.type)}"
             data-user="${escapeAttr(userName)}"
             data-mobile="${escapeAttr(mobile)}"
             data-products="${escapeAttr(products)}">
          <div class="admin-notification-head">
            <strong>${n.title || "Notification"}</strong>
            <span>${formatNotificationTime(n.createdAt)}</span>
          </div>
          <p>${n.message || ""}</p>
        </div>
      `;
      }).join("");
    })
    .catch(() => {
      listEl.innerHTML = `<div class="admin-notification-empty">Failed to load notifications.</div>`;
    });
}

function markAdminNotificationRead(id) {
  if (!id) return;
  fetch(`${API}/notifications/admin/mark-read`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders()
    },
    body: JSON.stringify({ ids: [id] })
  })
    .then(() => loadAdminNotifications())
    .catch(() => {});
}

function highlightRow(row) {
  if (!row) return;
  row.classList.add("row-highlight");
  setTimeout(() => row.classList.remove("row-highlight"), 2200);
}

function navigateFromNotification(item) {
  if (!item) return;
  const type = item.getAttribute("data-type");
  const userName = item.getAttribute("data-user");
  const mobile = item.getAttribute("data-mobile");
  const products = (item.getAttribute("data-products") || "")
    .split("|")
    .map(s => s.trim())
    .filter(Boolean);

  closeAdminNotifications();

  if (type === "user_registered") {
    const section = document.getElementById("users-section");
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
    const rows = document.querySelectorAll("#admin-users tr");
    rows.forEach(row => {
      const text = row.textContent || "";
      if ((userName && text.includes(userName)) || (mobile && text.includes(mobile))) {
        highlightRow(row);
      }
    });
    return;
  }

  if (type === "order_placed") {
    const section = document.getElementById("orders-section");
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
    const rows = document.querySelectorAll("#orders tr");
    rows.forEach(row => {
      const text = row.textContent || "";
      const userMatch = userName && text.includes(userName);
      const productMatch = products.some(p => text.includes(p));
      if (userMatch || productMatch) {
        highlightRow(row);
      }
    });
  }
}

function markAllAdminNotificationsRead() {
  fetch(`${API}/notifications/admin/mark-read`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders()
    },
    body: JSON.stringify({})
  })
    .then(() => loadAdminNotifications())
    .catch(() => {});
}

document.addEventListener("click", (e) => {
  const modal = document.getElementById("admin-notification-modal");
  if (!modal || modal.style.display === "none") return;
  const item = e.target.closest(".admin-notification-item");
  if (item) {
    const id = item.getAttribute("data-id");
    navigateFromNotification(item);
    markAdminNotificationRead(id);
    return;
  }
  if (e.target === modal) {
    closeAdminNotifications();
  }
});

/* =========================================================
   ADMIN DASHBOARD
========================================================= */
function loadAdminDashboard() {
  fetch(`${API}/admin/dashboard`, {
    headers: { ...getAuthHeaders() }
  })
    .then(res => res.json())
    .then(data => {
      document.getElementById("users").innerText = data.users;
      document.getElementById("products").innerText = data.products;
      document.getElementById("ordersCount").innerText = data.orders;
      document.getElementById("revenue").innerText = data.revenue;
    });
}
function adminLogout() {
  clearStoredItem("token");
  clearStoredItem("role");
  localStorage.removeItem("last_order_id");
  window.location.href = "login.html";
}
function logout() {
  clearStoredItem("token");
  clearStoredItem("role");
  clearStoredItem("username");
  clearStoredItem("mobile");
  localStorage.removeItem("cart");
  localStorage.removeItem("last_order_id");
  window.location.href = "login.html";
}

function reorderUserNavbar() {
  const navList = document.querySelector("nav ul");
  if (!navList) return;

  const findLiByHref = (href) =>
    Array.from(navList.querySelectorAll("li")).find(
      li => li.querySelector(`a[href="${href}"]`)
    );

  const homeLi = findLiByHref("home.html");
  const productsLi = findLiByHref("products.html");
  const scheduleLi = findLiByHref("schedule.html");
  const aboutLi = findLiByHref("aboutus.html");
  const cartLi = findLiByHref("cart.html");
  const menuLi = document.getElementById("user-menu-li");

  [homeLi, productsLi, scheduleLi, aboutLi, cartLi, menuLi]
    .filter(Boolean)
    .forEach(li => navList.appendChild(li));
}

function ensureUserNavMenu(isUserLoggedIn) {
  const navList = document.querySelector("nav ul");
  if (!navList) return;

  let menuLi = document.getElementById("user-menu-li");
  if (!isUserLoggedIn) {
    if (menuLi) menuLi.style.display = "none";
    return;
  }

  if (!menuLi) {
    menuLi = document.createElement("li");
    menuLi.id = "user-menu-li";
    menuLi.className = "user-menu";
    menuLi.innerHTML = `
      <button type="button" class="user-menu-btn" id="user-menu-btn" aria-label="Open menu">
        <span class="user-menu-dots" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </span>
      </button>
      <div class="user-menu-list" id="user-menu-list">
        <a href="user-dashboard.html">Profile</a>
        <a href="orders.html">My Orders</a>
        <button type="button" class="user-menu-action" onclick="logout()">Logout</button>
      </div>
    `;

    const loginNode = document.getElementById("login-link")?.closest("li");
    if (loginNode && loginNode.parentElement === navList) {
      navList.insertBefore(menuLi, loginNode);
    } else {
      navList.appendChild(menuLi);
    }

    const button = menuLi.querySelector("#user-menu-btn");
    button?.addEventListener("click", (e) => {
      e.stopPropagation();
      menuLi.classList.toggle("open");
    });

    document.addEventListener("click", (e) => {
      if (!menuLi.contains(e.target)) {
        menuLi.classList.remove("open");
      }
    });
  }

  menuLi.style.display = "";
  reorderUserNavbar();
}
let myOrdersCache = [];

function renderMyOrders(filter = "all") {
  const div = document.getElementById("my-orders");
  const empty = document.getElementById("orders-empty");
  if (!div) return;

  const filtered = myOrdersCache.filter(o => {
    if (filter === "all") return true;
    if (filter === "paid") return o.paymentStatus === "Confirmed";
    return (o.status || "").toLowerCase() === filter;
  });

  if (empty) {
    empty.style.display = filtered.length ? "none" : "block";
  }

  div.innerHTML = filtered.map(o => {
    const statusClass =
      o.status === "Approved"
        ? "status-approved"
        : o.status === "Cancelled"
          ? "status-cancelled"
          : "status-pending";
    const items = o.items || [];
    const paymentLabel = o.paymentStatus || "Pending";
    const total = items.reduce((sum, i) => {
      const price = i.price || i.product?.price || 0;
      return sum + price * i.qty;
    }, 0);

    const itemsHtml = items.map(i => {
      const price = i.price || i.product?.price || 0;
      const lineTotal = price * i.qty;
      return `
        <div class="order-item">
          <img src="${i.product?.image || ""}" alt="${i.product?.name || "Product"}">
          <div class="order-item-details">
            <p><strong>${i.product?.name || "Product"}</strong></p>
            <p>Qty: ${i.qty} • Price: ${price}</p>
          </div>
          <div>${lineTotal}</div>
        </div>
      `;
    }).join("");

    return `
      <div class="order-card">
        <div class="order-header">
          <div class="status-badge ${statusClass}">${o.status}</div>
          <div class="order-actions">
            ${o.status === "Pending" ? `<button onclick="cancelOrder('${o._id}')">Cancel</button>` : ""}
            <button class="btn-secondary" onclick="toggleOrderDetails('${o._id}')">Details</button>
          </div>
        </div>
        <div class="order-meta">
          <span>Payment: ${o.paymentMethod || "Pending"} • ${paymentLabel}</span>
          <span>Total: ${total}</span>
        </div>
        <div id="order-details-${o._id}" class="order-details" style="display:none;">
          <div class="order-items">
            ${itemsHtml}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function loadMyOrders() {
  if (!document.getElementById("my-orders")) return;

  fetch(`${API}/orders/my`, {
    headers: { ...getAuthHeaders() }
  })
    .then(res => res.json())
    .then(orders => {
      myOrdersCache = orders || [];
      const active = document.querySelector(".order-filters .tab.active");
      const filter = active ? active.dataset.filter : "all";
      renderMyOrders(filter);
    });
}

function toggleOrderDetails(orderId) {
  const el = document.getElementById(`order-details-${orderId}`);
  if (!el) return;
  el.style.display = el.style.display === "none" ? "block" : "none";
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".order-filters .tab");
  if (!btn) return;
  document.querySelectorAll(".order-filters .tab").forEach(t => t.classList.remove("active"));
  btn.classList.add("active");
  renderMyOrders(btn.dataset.filter);
});

document.addEventListener("DOMContentLoaded", loadMyOrders);

function startOrdersPolling() {
  if (orderPollerId) return;
  orderPollerId = setInterval(() => {
    if (document.getElementById("orders")) {
      loadAdminOrders();
    }
    if (document.getElementById("my-orders")) {
      loadMyOrders();
    }
  }, 15000);
}

function startOrdersSse() {
  const adminTable = document.getElementById("orders");
  const userOrders = document.getElementById("my-orders");
  if (!adminTable && !userOrders) return;

  if (typeof EventSource === "undefined") {
    startOrdersPolling();
    return;
  }

  try {
    orderSse = new EventSource(`${API}/stream/orders`);
    orderSse.onmessage = () => {
      if (adminTable) loadAdminOrders();
      if (userOrders) loadMyOrders();
    };
    orderSse.onerror = () => {
      if (orderSse && orderSse.readyState === 2) {
        orderSse.close();
        orderSse = null;
        startOrdersPolling();
      }
    };
  } catch (e) {
    startOrdersPolling();
  }
}
function searchProducts() {
  const q = document.getElementById("search").value;

  fetch(`${API}/products/search?q=${q}`)
    .then(res => res.json())
    .then(renderProducts);
}
function setActiveTab(btn) {
  document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
  if (!btn) return;
  btn.classList.add("active");
}

function loadAllProducts(btn) {
  setActiveTab(btn);

  fetch(`${API}/products`)
    .then(res => res.json())
    .then(renderProducts);
}

function loadByCategory(category, btn) {
  setActiveTab(btn);

  fetch(`${API}/products/category?category=${category}`)
    .then(res => res.json())
    .then(renderProducts);
}

function renderProducts(products) {
  const div = document.getElementById("product-list");
  if (!div) return;
  const baseUrl = API.replace("/api", "");

  div.innerHTML = products.map(p => `
    <div class="card">
      <img class="product-img" src="${p.image?.startsWith("http") ? p.image : `${baseUrl}${p.image || ""}`}">
      <h3>${p.name}</h3>
      <p>₹${p.price}</p>
      <p>Stock: ${p.quantity}</p>
      ${
        p.quantity > 0
          ? `
            <div class="product-qty-wrap">
              <button type="button" onclick="changeProductQty('${p._id}', -1)">-</button>
              <input id="qty-${p._id}" type="number" min="1" max="${p.quantity}" data-max="${p.quantity}" value="1" />
              <button type="button" onclick="changeProductQty('${p._id}', 1)">+</button>
            </div>
            <button onclick="addToCart('${p._id}')">Add to Cart</button>
          `
          : `<span style="color:red">Out of stock</span>`
      }
    </div>
  `).join("");
}

/* =========================================================
   INIT
========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  updateCartCount();
  if (document.getElementById("product-list")) {
    loadAllProducts(document.querySelector(".tab"));
  }
  if (document.getElementById("admin-products")) {
    loadAdminProducts();
    loadAdminOrders();
    loadAdminDashboard();
  }
});
document.addEventListener("DOMContentLoaded", () => {
  const user = getStoredItem("username");
  if (user) {
    const el = document.getElementById("nav-username");
    if (el) el.innerText = "Welcome, " + user;
  }

  const profileName = document.getElementById("profile-name");
  if (profileName) {
    profileName.innerText = getStoredItem("username") || "Guest";
  }
  const profileMobile = document.getElementById("profile-mobile");
  if (profileMobile) {
    profileMobile.innerText = getStoredItem("mobile") || "-";
  }
  const avatar = document.querySelector(".profile-avatar");
  if (avatar) {
    const name = getStoredItem("username") || "User";
    avatar.innerText = name.trim().charAt(0).toUpperCase() || "U";
  }

  const loginLink = document.getElementById("login-link");
  const profileLink = document.getElementById("profile-link");
  const ordersLink = document.getElementById("orders-link");
  const logoutLink = document.getElementById("logout-link");
  const isLoggedIn = !!getStoredItem("token");
  const isUserLoggedIn = isLoggedIn && getStoredItem("role") === "user";

  if (loginLink) loginLink.style.display = isLoggedIn ? "none" : "";
  if (profileLink) profileLink.style.display = "none";
  if (ordersLink) ordersLink.style.display = "none";
  if (logoutLink) logoutLink.style.display = "none";
  ensureUserNavMenu(isUserLoggedIn);
  reorderUserNavbar();

  document.querySelectorAll(".admin-nav-card[data-target]").forEach(card => {
    card.addEventListener("click", () => {
      const targetId = card.getAttribute("data-target");
      const section = document.getElementById(targetId);
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

});

function choosePayment(method) {
  const orderId =
    localStorage.getItem("last_order_id") ||
    document.body?.dataset?.orderId ||
    window.currentOrderId;
  if (!orderId) {
    alert("Order not found for payment");
    return;
  }
  const token = getStoredItem("token");
  if (!token) {
    alert("Please login to select payment method");
    window.location.href = "login.html";
    return;
  }

  fetch(`${API}/orders/${orderId}/payment`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders()
    },
    body: JSON.stringify({ method })
  })
    .then(async res => {
      const data = await res.json();
      if (!res.ok) {
        if (data.message === "Not allowed") {
          localStorage.removeItem("last_order_id");
          alert("This order is not linked to your current login. Please place order again.");
          window.location.href = "cart.html";
          return null;
        }
        alert(data.message || "Payment selection failed");
        return null;
      }
      return data;
    })
    .then(async data => {
      if (!data) return;
      if (method === "Pay on Shop") {
        alert("Your order request is placed and admin will confirm your order shortly.");
        await clearCartAfterPayment();
        localStorage.removeItem("last_order_id");
        window.location.href = "products.html";
        return;
      }

      const paymentMsg = document.getElementById("payment-message");
      if (paymentMsg) {
        if (method === "Pay by QR") {
          paymentMsg.innerText = "Order placed. Please complete payment by QR. Admin will confirm.";
        } else {
          paymentMsg.innerText = data.message || `Payment method saved: ${method}`;
        }
        paymentMsg.style.display = "block";
      }

      const qrSection = document.getElementById("qr-section");
      if (qrSection) {
        qrSection.style.display = method === "Pay by QR" ? "block" : "none";
      }

      const statusCard = document.getElementById("payment-status-card");
      const statusText = document.getElementById("payment-status-text");
      if (method === "Pay by QR" && statusCard && statusText) {
        statusText.innerText = "Order placed. Payment pending (QR).";
        statusCard.style.display = "block";
      }
    })
    .catch(() => alert("Failed to save payment method"));
}

// Razorpay removed




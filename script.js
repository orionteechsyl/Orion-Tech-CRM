/* ==========================================================
   ORION TECH — FRONTEND LOGIC
   Handles: PIN security, tab routing, API calls, base64 file
   conversion, marketing ROI, customer care alerts, wishlist
========================================================== */

// !!! IMPORTANT: Replace with your deployed Google Apps Script Web App URL !!!
const API_URL = "https://script.google.com/macros/s/AKfycbw9ARTC2v4idwkoZKE1jjUqykl-1oMbrU7i4VcYnyplJwuzayCUu6PhcuUA67aYn0M4/exec";

// Default PIN (change here). Session is remembered in localStorage.
const DEFAULT_PIN = "1466";
const AUTH_STORAGE_KEY = "orionTechAuth";
const LOGO_STORAGE_KEY = "orionTechLogo"; // base64 data URL of the custom shop logo
const SPLASH_DURATION_MS = 2000;

// Country code used to build WhatsApp / Call links from local phone numbers.
const WHATSAPP_COUNTRY_CODE = "88"; // Bangladesh

/* ================= STATE ================= */

const state = {
  currentTab: "dashboard",
  sales: [],
  suppliers: [],
  expenses: [],
  hr: [],
  marketing: [],
  wishlist: [],
  vault: [],
  contentTasks: [],
  complaints: [],
  employees: []
};

let pinEntry = "";
let activeWaTemplate = "welcome";
const vaultVisible = {}; // id -> boolean, whether a vault card's secret is currently shown

const WA_TEMPLATES = {
  welcome: function (name) { return `Hello ${name || "there"}, welcome to Orion Tech! Thank you for choosing us — let us know if you need anything.`; },
  due: function (name) { return `Hello ${name || "there"}, this is a gentle reminder about your remaining due balance with Orion Tech. Please let us know a convenient time to settle it.`; },
  feedback: function (name) { return `Hello ${name || "there"}, we'd love to hear how your recent purchase from Orion Tech is going. Any feedback for us?`; },
  referral: function (name) { return `Hello ${name || "there"}, thank you so much for referring a customer to Orion Tech! We really appreciate your support.`; },
  birthday: function (name) { return `Happy Birthday, ${name || "friend"}! 🎉 Wishing you a wonderful day from all of us at Orion Tech.`; },
  anniversary: function (name) { return `Hello ${name || "there"}, happy anniversary with your device from Orion Tech! Thank you for being with us.`; }
};

/* ================= INIT ================= */

document.addEventListener("DOMContentLoaded", function () {
  initSplashScreen();
  initLogoBranding();
  initPinLogin();

  initSidebar();
  initTabs();
  initYearFilter();
  initForms();
  initSearch();
  initVaultUI();
  initTaskFilters();
  initPayrollFilters();
  initWhatsappTemplates();
  initExportPrint();
  setDefaultDates();

  if (isAuthenticated()) {
    unlockApp(false);
  }
});

/* ================= SPLASH SCREEN ================= */

function initSplashScreen() {
  const splash = document.getElementById("splashScreen");
  if (!splash) return;

  setTimeout(function () {
    splash.classList.add("fade-out");
    setTimeout(function () {
      splash.classList.add("hidden");
    }, 700); // matches CSS fade-out transition duration
  }, SPLASH_DURATION_MS);
}

/* ================= CUSTOM SHOP LOGO / BRANDING ================= */

function getSavedLogo() {
  return localStorage.getItem(LOGO_STORAGE_KEY) || "";
}

function applyLogoToUI() {
  const logo = getSavedLogo();
  const markIds = ["splashLogoMark", "pinLogoMark", "sidebarLogoMark", "topbarLogoMark"];

  markIds.forEach(function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (logo) {
      el.innerHTML = '<img src="' + logo + '" alt="Shop Logo" />';
    } else {
      el.textContent = "OT";
    }
  });

  const modalPreview = document.getElementById("logoModalPreview");
  if (modalPreview) {
    modalPreview.innerHTML = logo ? '<img src="' + logo + '" alt="Shop Logo" />' : "OT";
  }
}

function initLogoBranding() {
  applyLogoToUI();

  const editBtn = document.getElementById("logoEditBtn");
  const overlay = document.getElementById("logoModalOverlay");
  const closeBtn = document.getElementById("logoModalCloseBtn");
  const fileInput = document.getElementById("logoFileInput");
  const saveBtn = document.getElementById("logoSaveBtn");
  const removeBtn = document.getElementById("logoRemoveBtn");
  const modalPreview = document.getElementById("logoModalPreview");

  let pendingLogoDataUrl = null;

  function openModal() {
    pendingLogoDataUrl = null;
    if (fileInput) fileInput.value = "";
    applyLogoToUI();
    if (overlay) overlay.classList.remove("hidden");
  }

  function closeModal() {
    if (overlay) overlay.classList.add("hidden");
  }

  if (editBtn) editBtn.addEventListener("click", openModal);
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (overlay) {
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeModal();
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", function () {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        showToast("Please select an image file.", "error");
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        showToast("Logo image should be under 2MB.", "error");
        return;
      }

      const reader = new FileReader();
      reader.onload = function (e) {
        pendingLogoDataUrl = e.target.result;
        if (modalPreview) {
          modalPreview.innerHTML = '<img src="' + pendingLogoDataUrl + '" alt="Shop Logo Preview" />';
        }
      };
      reader.readAsDataURL(file);
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", function () {
      if (!pendingLogoDataUrl) {
        showToast("Choose an image file first.", "error");
        return;
      }
      localStorage.setItem(LOGO_STORAGE_KEY, pendingLogoDataUrl);
      applyLogoToUI();
      closeModal();
      showToast("Shop logo updated.", "success");
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener("click", function () {
      localStorage.removeItem(LOGO_STORAGE_KEY);
      pendingLogoDataUrl = null;
      if (fileInput) fileInput.value = "";
      applyLogoToUI();
      showToast("Shop logo removed.", "success");
    });
  }
}

function bootDashboardData() {
  checkConnection();
  loadDashboard();
  loadSales();
  loadSuppliers();
  loadExpenses();
  loadHR();
  loadMarketing();
  loadWishlist();
  loadVault();
  loadContentTasks();
  loadComplaints();
  loadEmployees();
}

/* ================= PIN LOGIN ================= */

function isAuthenticated() {
  return localStorage.getItem(AUTH_STORAGE_KEY) === "true";
}

function initPinLogin() {
  const keypad = document.getElementById("pinKeypad");
  const pinInput = document.getElementById("pinInput");

  keypad.addEventListener("click", function (e) {
    const btn = e.target.closest("button[data-key]");
    if (!btn) return;

    const key = btn.getAttribute("data-key");

    if (key === "back") {
      pinEntry = pinEntry.slice(0, -1);
    } else if (pinEntry.length < 4) {
      pinEntry += key;
    }

    renderPinDots();

    if (pinEntry.length === 4) {
      validatePin();
    }
  });

  // Allow physical keyboard input too
  document.addEventListener("keydown", function (e) {
    const overlay = document.getElementById("pinOverlay");
    if (overlay.classList.contains("hidden")) return;

    if (e.key >= "0" && e.key <= "9" && pinEntry.length < 4) {
      pinEntry += e.key;
      renderPinDots();
      if (pinEntry.length === 4) validatePin();
    } else if (e.key === "Backspace") {
      pinEntry = pinEntry.slice(0, -1);
      renderPinDots();
    }
  });

  pinInput.focus();
}

function renderPinDots() {
  const dots = document.querySelectorAll("#pinDots span");
  dots.forEach(function (dot, i) {
    dot.classList.toggle("filled", i < pinEntry.length);
  });
}

function validatePin() {
  const storedPin = localStorage.getItem("orionTechPin") || DEFAULT_PIN;

  setTimeout(function () {
    if (pinEntry === storedPin) {
      unlockApp(true);
    } else {
      const dotsWrap = document.getElementById("pinDots");
      const errorEl = document.getElementById("pinError");
      dotsWrap.classList.add("shake");
      errorEl.classList.add("show");

      setTimeout(function () {
        dotsWrap.classList.remove("shake");
        pinEntry = "";
        renderPinDots();
      }, 400);
    }
  }, 150);
}

function unlockApp(persist) {
  document.getElementById("pinError").classList.remove("show");
  document.getElementById("pinOverlay").classList.add("hidden");
  document.getElementById("appShell").style.display = "flex";

  if (persist) {
    localStorage.setItem(AUTH_STORAGE_KEY, "true");
  }

  pinEntry = "";
  renderPinDots();

  bootDashboardData();
}

function lockApp() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  document.getElementById("pinOverlay").classList.remove("hidden");
  document.getElementById("appShell").style.display = "none";
  pinEntry = "";
  renderPinDots();
  document.getElementById("pinInput").focus();
}

/* ================= SIDEBAR / MOBILE NAV ================= */

function initSidebar() {
  const menuToggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  const lockBtn = document.getElementById("lockBtn");
  const mobileLockBtn = document.getElementById("mobileLockBtn");

  menuToggle.addEventListener("click", function () {
    sidebar.classList.toggle("open");
    overlay.classList.toggle("show");
  });

  overlay.addEventListener("click", function () {
    sidebar.classList.remove("open");
    overlay.classList.remove("show");
  });

  lockBtn.addEventListener("click", lockApp);
  mobileLockBtn.addEventListener("click", lockApp);
}

/* ================= TAB ROUTING ================= */

function initTabs() {
  const navItems = document.querySelectorAll(".nav-item");

  navItems.forEach(function (item) {
    item.addEventListener("click", function () {
      const tab = item.getAttribute("data-tab");
      switchTab(tab);

      // close mobile sidebar after selection
      document.getElementById("sidebar").classList.remove("open");
      document.getElementById("sidebarOverlay").classList.remove("show");
    });
  });
}

function switchTab(tab) {
  state.currentTab = tab;

  document.querySelectorAll(".nav-item").forEach(function (el) {
    el.classList.toggle("active", el.getAttribute("data-tab") === tab);
  });

  document.querySelectorAll(".tab-panel").forEach(function (el) {
    el.classList.toggle("active", el.id === "tab-" + tab);
  });

  if (tab === "care") {
    renderCustomerCare();
    renderWaBulkList();
  }
  if (tab === "vault") {
    renderVaultCards();
  }
  if (tab === "content") {
    renderTaskCards();
  }
}

/* ================= UTILITIES ================= */

function setDefaultDates() {
  const today = new Date().toISOString().split("T")[0];
  document.querySelectorAll('input[type="date"]').forEach(function (input) {
    if (!input.value) input.value = today;
  });
}

function initYearFilter() {
  const yearSelect = document.getElementById("filterYear");
  const currentYear = new Date().getFullYear();
  let options = '<option value="">All Years</option>';
  for (let y = currentYear; y >= currentYear - 5; y--) {
    options += `<option value="${y}" ${y === currentYear ? "selected" : ""}>${y}</option>`;
  }
  yearSelect.innerHTML = options;

  document.getElementById("applyFilterBtn").addEventListener("click", loadDashboard);
}

function formatCurrency(num) {
  const n = parseFloat(num) || 0;
  return "৳" + n.toLocaleString("en-BD", { maximumFractionDigits: 2 });
}

function formatDate(val) {
  if (!val) return "-";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch (e) {
    return val;
  }
}

function showToast(message, type) {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = "toast " + (type || "");
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(function () {
    toast.style.opacity = "0";
    setTimeout(function () { toast.remove(); }, 300);
  }, 3500);
}

function showLoading(show) {
  document.getElementById("loadingOverlay").classList.toggle("hidden", !show);
}

/**
 * Cleans a local phone number and prefixes the WhatsApp/dial country code.
 * Handles numbers already starting with 0, +88, or 88.
 */
function toIntlPhone(phone) {
  if (!phone) return "";
  let digits = phone.toString().replace(/\D/g, "");

  if (digits.startsWith(WHATSAPP_COUNTRY_CODE)) {
    return digits;
  }
  if (digits.startsWith("0")) {
    return WHATSAPP_COUNTRY_CODE + digits.substring(1);
  }
  return WHATSAPP_COUNTRY_CODE + digits;
}

function whatsappLink(phone, message) {
  const intl = toIntlPhone(phone);
  if (!intl) return "#";
  return `https://wa.me/${intl}?text=${encodeURIComponent(message || "")}`;
}

function callLink(phone) {
  const intl = toIntlPhone(phone);
  if (!intl) return "#";
  return `tel:+${intl}`;
}

function actionIconsHtml(phone, buyerName) {
  const greeting = `Hello ${buyerName || ""}, this is Orion Tech. How can we help you today?`;
  return `<div class="action-icons">
    <a class="icon-action whatsapp" href="${whatsappLink(phone, greeting)}" target="_blank" rel="noopener" title="WhatsApp">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.48 1.32 5L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.87 9.87 0 0012.04 2zm5.8 14.06c-.24.68-1.4 1.32-1.93 1.4-.5.08-1.11.11-1.79-.11-.41-.13-.94-.31-1.62-.6-2.85-1.23-4.71-4.08-4.85-4.27-.14-.19-1.16-1.54-1.16-2.94s.72-2.09.98-2.37c.26-.28.56-.35.75-.35.19 0 .38 0 .54.01.17.01.4-.07.63.48.24.56.81 1.95.88 2.09.07.14.12.31.02.5-.09.19-.14.31-.28.47-.14.17-.29.37-.42.5-.14.14-.28.28-.12.56.16.28.71 1.17 1.52 1.9 1.04.94 1.92 1.23 2.2 1.37.28.14.44.12.6-.07.17-.19.71-.83.9-1.12.19-.28.38-.23.63-.14.26.09 1.64.77 1.92.91.28.14.47.21.54.33.07.12.07.68-.17 1.36z"/></svg>
    </a>
    <a class="icon-action call" href="${callLink(phone)}" title="Call">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </a>
  </div>`;
}

/* ================= API LAYER ================= */

/**
 * Calls the Apps Script backend.
 * Uses POST with text/plain content-type to avoid CORS preflight issues.
 */
function callApi(action, payload) {
  const body = Object.assign({ action: action }, payload || {});

  return fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8" // avoids CORS preflight (OPTIONS) on Apps Script
    },
    body: JSON.stringify(body)
  })
    .then(function (res) {
      if (!res.ok) throw new Error("Network response was not ok (" + res.status + ")");
      return res.json();
    })
    .catch(function (err) {
      console.error("API Error:", err);
      return { success: false, message: "Connection failed: " + err.message };
    });
}

function checkConnection() {
  const dot = document.getElementById("connStatus");
  const text = document.getElementById("connText");

  callApi("getDashboard", {}).then(function (res) {
    if (res.success) {
      dot.classList.remove("offline");
      dot.classList.add("online");
      text.textContent = "Connected";
    } else {
      dot.classList.remove("online");
      dot.classList.add("offline");
      text.textContent = "Offline / Config Needed";
    }
  });
}

/* ================= DASHBOARD ================= */

function loadDashboard() {
  const month = document.getElementById("filterMonth").value;
  const year = document.getElementById("filterYear").value;

  showLoading(true);

  callApi("getDashboard", { month: month, year: year }).then(function (res) {
    showLoading(false);

    if (!res.success) {
      showToast(res.message || "Failed to load dashboard", "error");
      return;
    }

    document.getElementById("statTotalSales").textContent = formatCurrency(res.totalSales);
    document.getElementById("statTotalDues").textContent = formatCurrency(res.totalDues);
    document.getElementById("statTotalExpenses").textContent = formatCurrency(res.totalExpenses + res.totalHR);
    document.getElementById("statNetProfit").textContent = formatCurrency(res.netProfit);
    document.getElementById("statMarketingSpent").textContent = formatCurrency(res.totalMarketing || 0);
    document.getElementById("statFbRoi").textContent = formatCurrency(res.facebookRoi || 0);

    const summary = document.getElementById("dashboardSummaryText");
    const profitWord = res.netProfit >= 0 ? "profit" : "loss";
    summary.innerHTML =
      `Orion Tech recorded <strong>${res.salesCount}</strong> sale(s) in the selected period, ` +
      `generating <strong>${formatCurrency(res.totalSales)}</strong> in revenue with ` +
      `<strong>${formatCurrency(res.totalDues)}</strong> still due from customers. ` +
      `After expenses and HR costs, the shop is showing a net <strong>${profitWord}</strong> of ` +
      `<strong>${formatCurrency(Math.abs(res.netProfit))}</strong>. Marketing spend was ` +
      `<strong>${formatCurrency(res.totalMarketing || 0)}</strong> with a Facebook ROI of ` +
      `<strong>${formatCurrency(res.facebookRoi || 0)}</strong>.`;

    // Marketing tab mini snapshot uses the same filtered period
    document.getElementById("miniFbRevenue").textContent = formatCurrency(res.facebookRevenue || 0);
    document.getElementById("miniMarketingSpend").textContent = formatCurrency(res.totalMarketing || 0);

    // 50/50 partnership split
    document.getElementById("splitShamim").textContent = formatCurrency(res.shamimShare || 0);
    document.getElementById("splitMahfuj").textContent = formatCurrency(res.mahfujShare || 0);
  });
}

/* ================= SALES MODULE ================= */

function initForms() {
  document.getElementById("salesForm").addEventListener("submit", function (e) {
    e.preventDefault();
    submitSalesForm(e.target);
  });

  document.getElementById("supplierForm").addEventListener("submit", function (e) {
    e.preventDefault();
    submitSupplierForm(e.target);
  });

  document.getElementById("expenseForm").addEventListener("submit", function (e) {
    e.preventDefault();
    submitExpenseForm(e.target);
  });

  document.getElementById("hrForm").addEventListener("submit", function (e) {
    e.preventDefault();
    submitHRForm(e.target);
  });

  document.getElementById("marketingForm").addEventListener("submit", function (e) {
    e.preventDefault();
    submitMarketingForm(e.target);
  });

  document.getElementById("wishlistForm").addEventListener("submit", function (e) {
    e.preventDefault();
    submitWishlistForm(e.target);
  });

  document.getElementById("vaultForm").addEventListener("submit", function (e) {
    e.preventDefault();
    submitVaultForm(e.target);
  });

  document.getElementById("contentTaskForm").addEventListener("submit", function (e) {
    e.preventDefault();
    submitContentTaskForm(e.target);
  });

  document.getElementById("employeeForm").addEventListener("submit", function (e) {
    e.preventDefault();
    submitEmployeeForm(e.target);
  });

  document.getElementById("complaintForm").addEventListener("submit", function (e) {
    e.preventDefault();
    submitComplaintForm(e.target);
  });

  const fileInput = document.getElementById("supplierFileInput");
  fileInput.addEventListener("change", function () {
    const hint = document.getElementById("fileHint");
    if (fileInput.files && fileInput.files.length > 0) {
      hint.textContent = fileInput.files[0].name;
    } else {
      hint.textContent = "No file selected";
    }
  });
}

function submitSalesForm(form) {
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  showLoading(true);

  callApi("addSale", payload).then(function (res) {
    showLoading(false);

    if (res.success) {
      showToast("Sale record saved successfully.", "success");
      form.reset();
      setDefaultDates();
      loadSales();
      loadDashboard();
    } else {
      showToast(res.message || "Failed to save sale.", "error");
    }
  });
}

function loadSales() {
  callApi("getSales", {}).then(function (res) {
    if (!res.success) return;
    state.sales = res.data || [];
    renderSalesTable();
    if (state.currentTab === "care") renderCustomerCare();
  });
}

function renderSalesTable() {
  const tbody = document.querySelector("#salesTable tbody");
  const filtered = getFilteredSales();

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td class="empty-cell" colspan="9">No sales recorded yet.</td></tr>';
    return;
  }

  const rows = filtered.slice().reverse().slice(0, 100).map(function (row) {
    const source = row.Source || "Walk-in";
    return `<tr>
      <td>${formatDate(row.Date)}</td>
      <td>${row.BuyerName || "-"}</td>
      <td>${row.Phone || "-"}</td>
      <td>${row.LaptopModel || "-"}</td>
      <td>${row.SerialNumber || "-"}</td>
      <td><span class="source-badge ${source}">${source}</span></td>
      <td>${formatCurrency(row.Price)}</td>
      <td>${formatCurrency(row.DueAmount)}</td>
      <td>${actionIconsHtml(row.Phone, row.BuyerName)}</td>
    </tr>`;
  });

  tbody.innerHTML = rows.join("");
}

/* ================= WARRANTY / CUSTOMER SEARCH ================= */

function initSearch() {
  document.getElementById("customerSearchBtn").addEventListener("click", performSearch);
  document.getElementById("customerSearchInput").addEventListener("keypress", function (e) {
    if (e.key === "Enter") performSearch();
  });
}

function performSearch() {
  const query = document.getElementById("customerSearchInput").value.trim();
  const resultsEl = document.getElementById("searchResults");

  if (!query) {
    showToast("Enter a phone number or serial number to search.", "error");
    return;
  }

  resultsEl.innerHTML = '<p class="muted-text">Searching...</p>';

  callApi("searchCustomer", { query: query }).then(function (res) {
    if (!res.success) {
      resultsEl.innerHTML = '<p class="muted-text">Search failed.</p>';
      return;
    }

    if (!res.data.length) {
      resultsEl.innerHTML = '<p class="muted-text">No matching records found.</p>';
      return;
    }

    resultsEl.innerHTML = res.data.map(function (row) {
      const due = parseFloat(row.DueAmount) || 0;
      const badge = due > 0
        ? `<span class="badge due">Due: ${formatCurrency(due)}</span>`
        : `<span class="badge clear">No Due — Cleared</span>`;

      return `<div class="result-card">
        <div class="result-name">${row.BuyerName || "-"} — ${row.LaptopModel || "-"}</div>
        <div class="result-row"><span>Phone</span><span>${row.Phone || "-"}</span></div>
        <div class="result-row"><span>Serial Number</span><span>${row.SerialNumber || "-"}</span></div>
        <div class="result-row"><span>Purchase Date</span><span>${formatDate(row.Date)}</span></div>
        <div class="result-row"><span>Price</span><span>${formatCurrency(row.Price)}</span></div>
        <div class="result-footer">
          ${badge}
          ${actionIconsHtml(row.Phone, row.BuyerName)}
        </div>
      </div>`;
    }).join("");
  });
}

/* ================= SUPPLIERS MODULE (WITH FILE UPLOAD) ================= */

function fileToBase64(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () {
      resolve(reader.result); // includes data:mime;base64, prefix
    };
    reader.onerror = function (err) {
      reject(err);
    };
    reader.readAsDataURL(file);
  });
}

function submitSupplierForm(form) {
  const formData = new FormData(form);
  const payload = {
    date: formData.get("date"),
    supplierName: formData.get("supplierName"),
    laptopModel: formData.get("laptopModel"),
    buyPrice: formData.get("buyPrice")
  };

  const fileInput = document.getElementById("supplierFileInput");
  const submitBtn = document.getElementById("supplierSubmitBtn");

  submitBtn.disabled = true;
  submitBtn.textContent = "Saving...";
  showLoading(true);

  const proceed = function () {
    callApi("addSupplier", payload).then(function (res) {
      showLoading(false);
      submitBtn.disabled = false;
      submitBtn.textContent = "Save Supplier Record";

      if (res.success) {
        showToast("Supplier record saved successfully.", "success");
        form.reset();
        setDefaultDates();
        document.getElementById("fileHint").textContent = "No file selected";
        loadSuppliers();
      } else {
        showToast(res.message || "Failed to save supplier record.", "error");
      }
    });
  };

  if (fileInput.files && fileInput.files.length > 0) {
    const file = fileInput.files[0];

    // Basic size guard (Apps Script payloads work best under ~15MB base64)
    if (file.size > 15 * 1024 * 1024) {
      showLoading(false);
      submitBtn.disabled = false;
      submitBtn.textContent = "Save Supplier Record";
      showToast("File too large. Please use a file under 15MB.", "error");
      return;
    }

    fileToBase64(file).then(function (base64) {
      payload.fileBase64 = base64;
      payload.fileName = file.name;
      payload.mimeType = file.type || "application/octet-stream";
      proceed();
    }).catch(function () {
      showLoading(false);
      submitBtn.disabled = false;
      submitBtn.textContent = "Save Supplier Record";
      showToast("Failed to read file.", "error");
    });
  } else {
    proceed();
  }
}

function loadSuppliers() {
  callApi("getSuppliers", {}).then(function (res) {
    if (!res.success) return;
    state.suppliers = res.data || [];
    renderSuppliersTable();
  });
}

function renderSuppliersTable() {
  const tbody = document.querySelector("#suppliersTable tbody");

  if (!state.suppliers.length) {
    tbody.innerHTML = '<tr><td class="empty-cell" colspan="5">No supplier records yet.</td></tr>';
    return;
  }

  const rows = state.suppliers.slice().reverse().slice(0, 25).map(function (row) {
    const fileLink = row.FileURL
      ? `<a href="${row.FileURL}" target="_blank" rel="noopener">View File</a>`
      : "-";

    return `<tr>
      <td>${formatDate(row.Date)}</td>
      <td>${row.SupplierName || "-"}</td>
      <td>${row.LaptopModel || "-"}</td>
      <td>${formatCurrency(row.BuyPrice)}</td>
      <td>${fileLink}</td>
    </tr>`;
  });

  tbody.innerHTML = rows.join("");
}

/* ================= EXPENSES MODULE ================= */

function submitExpenseForm(form) {
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  showLoading(true);

  callApi("addExpense", payload).then(function (res) {
    showLoading(false);

    if (res.success) {
      showToast("Expense added.", "success");
      form.reset();
      setDefaultDates();
      loadExpenses();
      loadDashboard();
    } else {
      showToast(res.message || "Failed to add expense.", "error");
    }
  });
}

function loadExpenses() {
  callApi("getExpenses", {}).then(function (res) {
    if (!res.success) return;
    state.expenses = res.data || [];
    renderExpensesTable();
  });
}

function renderExpensesTable() {
  const tbody = document.querySelector("#expensesTable tbody");

  if (!state.expenses.length) {
    tbody.innerHTML = '<tr><td class="empty-cell" colspan="4">No expenses recorded yet.</td></tr>';
    return;
  }

  const rows = state.expenses.slice().reverse().slice(0, 20).map(function (row) {
    return `<tr>
      <td>${formatDate(row.Date)}</td>
      <td>${row.Category || "-"}</td>
      <td>${row.Description || "-"}</td>
      <td>${formatCurrency(row.Amount)}</td>
    </tr>`;
  });

  tbody.innerHTML = rows.join("");
}

/* ================= HR MODULE ================= */

function submitHRForm(form) {
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  showLoading(true);

  callApi("addHR", payload).then(function (res) {
    showLoading(false);

    if (res.success) {
      showToast("HR record added.", "success");
      form.reset();
      setDefaultDates();
      loadHR();
      loadDashboard();
    } else {
      showToast(res.message || "Failed to add HR record.", "error");
    }
  });
}

function loadHR() {
  callApi("getHR", {}).then(function (res) {
    if (!res.success) return;
    state.hr = res.data || [];
    renderHRTable();
    renderPayrollTable();
  });
}

function renderHRTable() {
  const tbody = document.querySelector("#hrTable tbody");

  if (!state.hr.length) {
    tbody.innerHTML = '<tr><td class="empty-cell" colspan="4">No HR records yet.</td></tr>';
    return;
  }

  const rows = state.hr.slice().reverse().slice(0, 20).map(function (row) {
    return `<tr>
      <td>${formatDate(row.Date)}</td>
      <td>${row.Type || "-"}</td>
      <td>${row.PersonName || "-"}</td>
      <td>${formatCurrency(row.Amount)}</td>
    </tr>`;
  });

  tbody.innerHTML = rows.join("");
}

/* ================= EMPLOYEE PAYROLL MODULE ================= */

function initPayrollFilters() {
  const yearSelect = document.getElementById("payrollFilterYear");
  const currentYear = new Date().getFullYear();
  let options = '<option value="">All Years</option>';
  for (let y = currentYear; y >= currentYear - 5; y--) {
    options += `<option value="${y}" ${y === currentYear ? "selected" : ""}>${y}</option>`;
  }
  yearSelect.innerHTML = options;

  document.getElementById("payrollFilterMonth").addEventListener("change", renderPayrollTable);
  document.getElementById("payrollFilterYear").addEventListener("change", renderPayrollTable);
}

function submitEmployeeForm(form) {
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  showLoading(true);

  callApi("addEmployee", payload).then(function (res) {
    showLoading(false);

    if (res.success) {
      showToast(res.message || "Employee saved.", "success");
      form.reset();
      loadEmployees();
    } else {
      showToast(res.message || "Failed to save employee.", "error");
    }
  });
}

function loadEmployees() {
  callApi("getEmployees", {}).then(function (res) {
    if (!res.success) return;
    state.employees = res.data || [];
    renderPayrollTable();
  });
}

function renderPayrollTable() {
  const tbody = document.querySelector("#payrollTable tbody");
  if (!tbody) return;

  if (!state.employees.length) {
    tbody.innerHTML = '<tr><td class="empty-cell" colspan="4">No employees added yet.</td></tr>';
    return;
  }

  const monthFilter = document.getElementById("payrollFilterMonth").value;
  const yearFilter = document.getElementById("payrollFilterYear").value;

  const rows = state.employees.map(function (emp) {
    const baseSalary = parseFloat(emp.BaseSalary) || 0;

    const paid = state.hr
      .filter(function (row) {
        if (row.Type !== "Salary" || row.PersonName !== emp.Name) return false;
        const d = new Date(row.Date);
        if (isNaN(d.getTime())) return false;
        if (monthFilter && (d.getMonth() + 1) !== parseInt(monthFilter)) return false;
        if (yearFilter && d.getFullYear() !== parseInt(yearFilter)) return false;
        return true;
      })
      .reduce(function (sum, row) { return sum + (parseFloat(row.Amount) || 0); }, 0);

    const due = baseSalary - paid;

    return `<tr>
      <td>${escapeHtml(emp.Name || "-")}</td>
      <td>${formatCurrency(baseSalary)}</td>
      <td>${formatCurrency(paid)}</td>
      <td style="color:${due > 0 ? "var(--danger)" : "var(--success)"}; font-weight:700;">${formatCurrency(due)}</td>
    </tr>`;
  });

  tbody.innerHTML = rows.join("");
}

/* ================= MARKETING & ADS MODULE ================= */

function submitMarketingForm(form) {
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  showLoading(true);

  callApi("addMarketing", payload).then(function (res) {
    showLoading(false);

    if (res.success) {
      showToast("Ad spend saved.", "success");
      form.reset();
      setDefaultDates();
      loadMarketing();
      loadDashboard();
    } else {
      showToast(res.message || "Failed to save ad spend.", "error");
    }
  });
}

function loadMarketing() {
  callApi("getMarketing", {}).then(function (res) {
    if (!res.success) return;
    state.marketing = res.data || [];
    renderMarketingTable();
  });
}

function renderMarketingTable() {
  const tbody = document.querySelector("#marketingTable tbody");

  if (!state.marketing.length) {
    tbody.innerHTML = '<tr><td class="empty-cell" colspan="3">No ad spend recorded yet.</td></tr>';
    return;
  }

  const rows = state.marketing.slice().reverse().slice(0, 25).map(function (row) {
    return `<tr>
      <td>${formatDate(row.Date)}</td>
      <td>${row.CampaignName || "-"}</td>
      <td>${formatCurrency(row.AmountSpent)}</td>
    </tr>`;
  });

  tbody.innerHTML = rows.join("");
}

/* ================= CUSTOMER CARE & ALERTS ================= */

/**
 * Returns the number of whole days between a purchase date and today.
 */
function daysSince(dateVal) {
  const purchaseDate = new Date(dateVal);
  if (isNaN(purchaseDate.getTime())) return null;

  const today = new Date();
  const p = new Date(purchaseDate.getFullYear(), purchaseDate.getMonth(), purchaseDate.getDate());
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return Math.round((t - p) / (1000 * 60 * 60 * 24));
}

function renderCustomerCare() {
  const feedbackBody = document.querySelector("#careFeedbackTable tbody");
  const serviceBody = document.querySelector("#careServiceTable tbody");
  const anniversaryBody = document.querySelector("#careAnniversaryTable tbody");

  const feedbackList = [];
  const serviceList = [];
  const anniversaryList = [];

  state.sales.forEach(function (row) {
    const days = daysSince(row.Date);
    if (days === null) return;

    if (days === 7) feedbackList.push(row);
    if (days === 182 || days === 183 || days === 180) serviceList.push(row); // ~6 months
    if (days === 365 || days === 366) anniversaryList.push(row); // ~1 year (leap-safe)
  });

  feedbackBody.innerHTML = buildCareRows(
    feedbackList,
    function (row) { return `Hello ${row.BuyerName}, how is your ${row.LaptopModel} running after a week? We'd love your feedback!`; }
  );

  serviceBody.innerHTML = buildCareRows(
    serviceList,
    function (row) { return `Hello ${row.BuyerName}, it's been 6 months since your ${row.LaptopModel} purchase — you're eligible for a free cleaning/service at Orion Tech. Would you like to book a slot?`; }
  );

  anniversaryBody.innerHTML = buildCareRows(
    anniversaryList,
    function (row) { return `Hello ${row.BuyerName}, happy 1-year anniversary with your ${row.LaptopModel} from Orion Tech! Thank you for being with us.`; }
  );
}

function buildCareRows(list, messageBuilder) {
  if (!list.length) {
    return '<tr><td class="empty-cell" colspan="4">No customers in this category today.</td></tr>';
  }

  return list.map(function (row) {
    const message = messageBuilder(row);
    return `<tr>
      <td>${row.BuyerName || "-"}</td>
      <td>${row.Phone || "-"}</td>
      <td>${row.LaptopModel || "-"}</td>
      <td>
        <a class="care-action-btn" href="${whatsappLink(row.Phone, message)}" target="_blank" rel="noopener">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.48 1.32 5L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.87 9.87 0 0012.04 2zm5.8 14.06c-.24.68-1.4 1.32-1.93 1.4-.5.08-1.11.11-1.79-.11-.41-.13-.94-.31-1.62-.6-2.85-1.23-4.71-4.08-4.85-4.27-.14-.19-1.16-1.54-1.16-2.94s.72-2.09.98-2.37c.26-.28.56-.35.75-.35.19 0 .38 0 .54.01.17.01.4-.07.63.48.24.56.81 1.95.88 2.09.07.14.12.31.02.5-.09.19-.14.31-.28.47-.14.17-.29.37-.42.5-.14.14-.28.28-.12.56.16.28.71 1.17 1.52 1.9 1.04.94 1.92 1.23 2.2 1.37.28.14.44.12.6-.07.17-.19.71-.83.9-1.12.19-.28.38-.23.63-.14.26.09 1.64.77 1.92.91.28.14.47.21.54.33.07.12.07.68-.17 1.36z"/></svg>
          WhatsApp
        </a>
      </td>
    </tr>`;
  }).join("");
}

/* ================= WISHLIST / PRE-ORDER MODULE ================= */

function submitWishlistForm(form) {
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  showLoading(true);

  callApi("addWishlist", payload).then(function (res) {
    showLoading(false);

    if (res.success) {
      showToast("Added to wishlist.", "success");
      form.reset();
      loadWishlist();
    } else {
      showToast(res.message || "Failed to add to wishlist.", "error");
    }
  });
}

function loadWishlist() {
  callApi("getWishlist", {}).then(function (res) {
    if (!res.success) return;
    state.wishlist = res.data || [];
    renderWishlist();
  });
}

function renderWishlist() {
  const container = document.getElementById("wishlistCards");

  if (!state.wishlist.length) {
    container.innerHTML = '<p class="muted-text">No wishlist / pre-order entries yet.</p>';
    return;
  }

  container.innerHTML = state.wishlist.slice().reverse().map(function (row) {
    return `<div class="wishlist-card">
      <div class="wl-info">
        <span class="wl-name">${row.CustomerName || "-"}</span>
        <span class="wl-model">${row.DesiredModel || "-"}</span>
        <span class="wl-phone">${row.Phone || "-"}</span>
      </div>
      ${actionIconsHtml(row.Phone, row.CustomerName)}
    </div>`;
  }).join("");
}

/* ================= SECURE VAULT MODULE ================= */

function initVaultUI() {
  const toggleBtn = document.getElementById("vaultFormToggleBtn");
  const secretInput = document.getElementById("vaultSecretInput");

  toggleBtn.addEventListener("click", function () {
    const showing = secretInput.type === "text";
    secretInput.type = showing ? "password" : "text";
    toggleBtn.textContent = showing ? "👁" : "🙈";
  });

  document.getElementById("vaultSearchInput").addEventListener("input", renderVaultCards);
}

function submitVaultForm(form) {
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  showLoading(true);

  callApi("addVaultEntry", payload).then(function (res) {
    showLoading(false);

    if (res.success) {
      showToast("Vault entry saved.", "success");
      form.reset();
      document.getElementById("vaultSecretInput").type = "password";
      document.getElementById("vaultFormToggleBtn").textContent = "👁";
      loadVault();
    } else {
      showToast(res.message || "Failed to save vault entry.", "error");
    }
  });
}

function loadVault() {
  callApi("getVaultEntries", {}).then(function (res) {
    if (!res.success) return;
    state.vault = res.data || [];
    if (state.currentTab === "vault") renderVaultCards();
  });
}

function renderVaultCards() {
  const container = document.getElementById("vaultCards");
  const query = (document.getElementById("vaultSearchInput").value || "").toLowerCase();

  let list = state.vault.slice().reverse();
  if (query) {
    list = list.filter(function (row) {
      return (row.Title || "").toLowerCase().indexOf(query) !== -1 ||
        (row.Category || "").toLowerCase().indexOf(query) !== -1 ||
        (row.Username || "").toLowerCase().indexOf(query) !== -1;
    });
  }

  if (!list.length) {
    container.innerHTML = '<p class="muted-text">No vault entries match.</p>';
    return;
  }

  container.innerHTML = list.map(function (row) {
    const isVisible = !!vaultVisible[row.ID];
    const secretDisplay = isVisible ? escapeHtml(row.Secret || "") : "••••••••";

    return `<div class="vault-card" data-id="${row.ID}">
      <div class="vault-card-top">
        <span class="vault-card-title">${escapeHtml(row.Title || "-")}</span>
        <span class="vault-category-badge">${escapeHtml(row.Category || "Other")}</span>
      </div>
      ${row.Username ? `<div class="vault-card-row"><span>Username / Account</span><span>${escapeHtml(row.Username)}</span></div>` : ""}
      <div class="vault-card-row">
        <span>Password / PIN</span>
        <span class="vault-secret-value">${secretDisplay}</span>
      </div>
      ${row.Notes ? `<div class="vault-notes">${escapeHtml(row.Notes)}</div>` : ""}
      <div class="vault-card-actions">
        <button class="vault-toggle-row-btn" data-id="${row.ID}">${isVisible ? "Hide" : "Show"}</button>
        <button class="vault-copy-row-btn" data-id="${row.ID}">Copy Password</button>
        <button class="vault-delete-btn" data-id="${row.ID}">Delete</button>
      </div>
    </div>`;
  }).join("");

  container.querySelectorAll(".vault-toggle-row-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const id = btn.getAttribute("data-id");
      vaultVisible[id] = !vaultVisible[id];
      renderVaultCards();
    });
  });

  container.querySelectorAll(".vault-copy-row-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const id = btn.getAttribute("data-id");
      const entry = state.vault.find(function (r) { return r.ID === id; });
      if (!entry) return;

      copyToClipboard(entry.Secret || "").then(function () {
        showToast("Password copied to clipboard.", "success");
      }).catch(function () {
        showToast("Could not copy — copy it manually.", "error");
      });
    });
  });

  container.querySelectorAll(".vault-delete-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const id = btn.getAttribute("data-id");
      if (!confirm("Delete this vault entry? This cannot be undone.")) return;

      showLoading(true);
      callApi("deleteVaultEntry", { id: id }).then(function (res) {
        showLoading(false);
        if (res.success) {
          showToast("Vault entry deleted.", "success");
          delete vaultVisible[id];
          loadVault();
        } else {
          showToast(res.message || "Failed to delete entry.", "error");
        }
      });
    });
  });
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise(function (resolve, reject) {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

function escapeHtml(str) {
  return (str || "").toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ================= CONTENT & TASKS MODULE ================= */

function initTaskFilters() {
  document.getElementById("taskFilterMonth").addEventListener("change", renderTaskCards);
  document.getElementById("taskFilterAssignee").addEventListener("change", renderTaskCards);
}

function submitContentTaskForm(form) {
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  // Checkboxes are only included in FormData when checked, so set explicit Yes/No values.
  payload.beforeFinal = form.elements.beforeFinal.checked ? "Yes" : "No";
  payload.deliveryFinalized = form.elements.deliveryFinalized.checked ? "Yes" : "No";
  payload.thumbnailReady = form.elements.thumbnailReady.checked ? "Yes" : "No";
  payload.uploadedToSocial = form.elements.uploadedToSocial.checked ? "Yes" : "No";

  showLoading(true);

  callApi("addContentTask", payload).then(function (res) {
    showLoading(false);

    if (res.success) {
      showToast("Task added.", "success");
      form.reset();
      setDefaultDates();
      loadContentTasks();
    } else {
      showToast(res.message || "Failed to add task.", "error");
    }
  });
}

function loadContentTasks() {
  callApi("getContentTasks", {}).then(function (res) {
    if (!res.success) return;
    state.contentTasks = res.data || [];
    if (state.currentTab === "content") renderTaskCards();
  });
}

const STATUS_OPTIONS = ["Pending", "First Version", "Completed"];
const TASK_FLAG_FIELDS = [
  { key: "BeforeFinal", label: "Before Final" },
  { key: "DeliveryFinalized", label: "Delivery Finalized" },
  { key: "ThumbnailReady", label: "Thumbnail Ready" },
  { key: "UploadedToSocial", label: "Uploaded YT/FB" }
];

function statusClass(status) {
  return "status-" + (status || "pending").toString().toLowerCase().replace(/\s+/g, "-");
}

function renderTaskCards() {
  const container = document.getElementById("taskCards");
  const monthFilter = document.getElementById("taskFilterMonth").value;
  const assigneeFilter = document.getElementById("taskFilterAssignee").value;

  let list = state.contentTasks.slice().reverse();

  if (monthFilter) {
    list = list.filter(function (row) {
      const d = new Date(row.Date);
      return !isNaN(d.getTime()) && (d.getMonth() + 1) === parseInt(monthFilter);
    });
  }
  if (assigneeFilter) {
    list = list.filter(function (row) { return row.AssignedTo === assigneeFilter; });
  }

  if (!list.length) {
    container.innerHTML = '<p class="muted-text">No tasks match these filters.</p>';
    return;
  }

  container.innerHTML = list.map(function (row) {
    const optionsHtml = STATUS_OPTIONS.map(function (s) {
      return `<option value="${s}" ${s === row.Status ? "selected" : ""}>${s}</option>`;
    }).join("");

    const flagsHtml = TASK_FLAG_FIELDS.map(function (f) {
      const on = row[f.key] === "Yes";
      return `<button type="button" class="task-flag-pill ${on ? "on" : ""}" data-id="${row.ID}" data-field="${f.key}" data-value="${on ? "No" : "Yes"}">${on ? "✓" : "○"} ${f.label}</button>`;
    }).join("");

    return `<div class="task-card" data-id="${row.ID}">
      <div class="task-card-top">
        <span class="task-file-name">${escapeHtml(row.FileName || "Untitled")}</span>
        <select class="task-status-select ${statusClass(row.Status)}" data-id="${row.ID}">${optionsHtml}</select>
      </div>
      <div class="task-card-meta">
        <span>📅 ${formatDate(row.Date)}</span>
        <span>👤 ${escapeHtml(row.AssignedTo || "Unassigned")}</span>
      </div>
      <div class="task-flags">${flagsHtml}</div>
      <div class="task-card-links">
        ${row.VideoLink ? `<a href="${row.VideoLink}" target="_blank" rel="noopener">Video Link</a>` : ""}
        ${row.ThumbnailLink ? `<a href="${row.ThumbnailLink}" target="_blank" rel="noopener">Thumbnail</a>` : ""}
      </div>
      ${row.Caption ? `<div class="task-card-caption">${escapeHtml(row.Caption)}</div>` : ""}
      <div class="task-card-actions">
        <button class="task-delete-btn" data-id="${row.ID}">Delete</button>
      </div>
    </div>`;
  }).join("");

  container.querySelectorAll(".task-status-select").forEach(function (select) {
    select.addEventListener("change", function () {
      const id = select.getAttribute("data-id");
      select.className = "task-status-select " + statusClass(select.value);

      callApi("updateContentTaskStatus", { id: id, status: select.value }).then(function (res) {
        if (res.success) {
          showToast("Task status updated.", "success");
          const row = state.contentTasks.find(function (r) { return r.ID === id; });
          if (row) row.Status = select.value;
        } else {
          showToast(res.message || "Failed to update status.", "error");
        }
      });
    });
  });

  container.querySelectorAll(".task-flag-pill").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const id = btn.getAttribute("data-id");
      const field = btn.getAttribute("data-field");
      const value = btn.getAttribute("data-value");

      callApi("updateContentTaskField", { id: id, field: field, value: value }).then(function (res) {
        if (res.success) {
          const row = state.contentTasks.find(function (r) { return r.ID === id; });
          if (row) row[field] = value;
          renderTaskCards();
        } else {
          showToast(res.message || "Failed to update task.", "error");
        }
      });
    });
  });

  container.querySelectorAll(".task-delete-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const id = btn.getAttribute("data-id");
      if (!confirm("Delete this task?")) return;

      showLoading(true);
      callApi("deleteContentTask", { id: id }).then(function (res) {
        showLoading(false);
        if (res.success) {
          showToast("Task deleted.", "success");
          loadContentTasks();
        } else {
          showToast(res.message || "Failed to delete task.", "error");
        }
      });
    });
  });
}

/* ================= COMPLAINTS MODULE ================= */

function submitComplaintForm(form) {
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  payload.status = "Open";

  showLoading(true);

  callApi("addComplaint", payload).then(function (res) {
    showLoading(false);

    if (res.success) {
      showToast("Complaint logged.", "success");
      form.reset();
      setDefaultDates();
      loadComplaints();
    } else {
      showToast(res.message || "Failed to log complaint.", "error");
    }
  });
}

function loadComplaints() {
  callApi("getComplaints", {}).then(function (res) {
    if (!res.success) return;
    state.complaints = res.data || [];
    renderComplaintsTable();
  });
}

function renderComplaintsTable() {
  const tbody = document.querySelector("#complaintsTable tbody");

  if (!state.complaints.length) {
    tbody.innerHTML = '<tr><td class="empty-cell" colspan="5">No complaints logged.</td></tr>';
    return;
  }

  const rows = state.complaints.slice().reverse().slice(0, 30).map(function (row) {
    const status = row.Status || "Open";
    return `<tr>
      <td>${formatDate(row.Date)}</td>
      <td>${escapeHtml(row.CustomerName || "-")}</td>
      <td>${escapeHtml(row.Phone || "-")}</td>
      <td>${escapeHtml(row.Issue || "-")}</td>
      <td><button class="status-badge ${statusClass(status)}" data-id="${row.ID}" data-status="${status}">${status}</button></td>
    </tr>`;
  });

  tbody.innerHTML = rows.join("");

  tbody.querySelectorAll(".status-badge").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const id = btn.getAttribute("data-id");
      const newStatus = btn.getAttribute("data-status") === "Open" ? "Resolved" : "Open";

      callApi("updateComplaintStatus", { id: id, status: newStatus }).then(function (res) {
        if (res.success) {
          const row = state.complaints.find(function (r) { return r.ID === id; });
          if (row) row.Status = newStatus;
          renderComplaintsTable();
        } else {
          showToast(res.message || "Failed to update status.", "error");
        }
      });
    });
  });
}

/* ================= WHATSAPP TEMPLATES & BULK CAMPAIGN ================= */

function initWhatsappTemplates() {
  const grid = document.getElementById("waTemplateGrid");

  grid.querySelectorAll(".wa-template-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      grid.querySelectorAll(".wa-template-btn").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      activeWaTemplate = btn.getAttribute("data-template");
      renderWaBulkList();
    });
  });

  grid.querySelector('[data-template="welcome"]').classList.add("active");
}

function renderWaBulkList() {
  const container = document.getElementById("waBulkList");
  const builder = WA_TEMPLATES[activeWaTemplate] || WA_TEMPLATES.welcome;

  // De-duplicate customers by phone number across sales records
  const seen = {};
  const customers = [];
  state.sales.forEach(function (row) {
    const phone = (row.Phone || "").toString().trim();
    if (!phone || seen[phone]) return;
    seen[phone] = true;
    customers.push({ name: row.BuyerName, phone: phone });
  });

  if (!customers.length) {
    container.innerHTML = '<p class="muted-text">No customers with phone numbers yet.</p>';
    return;
  }

  container.innerHTML = customers.map(function (c) {
    const message = builder(c.name);
    return `<div class="wa-bulk-row">
      <span><span class="wa-bulk-name">${escapeHtml(c.name || "-")}</span><span class="wa-bulk-phone">${escapeHtml(c.phone)}</span></span>
      <a class="wa-bulk-send-btn" href="${whatsappLink(c.phone, message)}" target="_blank" rel="noopener">Send</a>
    </div>`;
  }).join("");
}

/* ================= EXPORT CSV & PRINT ================= */

function initExportPrint() {
  document.getElementById("exportSalesCsvBtn").addEventListener("click", exportSalesCsv);
  document.getElementById("printSalesBtn").addEventListener("click", printSalesView);
  document.getElementById("salesDateFilterBtn").addEventListener("click", renderSalesTable);
}

function getFilteredSales() {
  const from = document.getElementById("salesFromDate").value;
  const to = document.getElementById("salesToDate").value;

  if (!from && !to) return state.sales.slice();

  return state.sales.filter(function (row) {
    const d = new Date(row.Date);
    if (isNaN(d.getTime())) return false;
    if (from && d < new Date(from)) return false;
    if (to && d > new Date(to)) return false;
    return true;
  });
}

function exportSalesCsv() {
  const list = getFilteredSales();
  if (!list.length) {
    showToast("No sales to export for the selected range.", "error");
    return;
  }

  const headers = ["Date", "BuyerName", "Phone", "Location", "LaptopModel", "SerialNumber", "Price", "DueAmount", "Source"];
  const csvRows = [headers.join(",")];

  list.forEach(function (row) {
    const line = headers.map(function (h) {
      const val = (row[h] !== undefined ? row[h] : "").toString().replace(/"/g, '""');
      return `"${val}"`;
    });
    csvRows.push(line.join(","));
  });

  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "orion-tech-sales-" + new Date().toISOString().split("T")[0] + ".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast("CSV exported.", "success");
}

function printSalesView() {
  const wrap = document.getElementById("salesTableWrap");
  wrap.classList.add("print-active");
  window.print();
  setTimeout(function () { wrap.classList.remove("print-active"); }, 500);
}

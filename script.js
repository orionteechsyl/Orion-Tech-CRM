/* ==========================================================
   ORION TECH — FRONTEND LOGIC
   Handles: tab routing, API calls, base64 file conversion, UI state
========================================================== */

// !!! IMPORTANT: Replace with your deployed Google Apps Script Web App URL !!!
const API_URL = "https://script.google.com/macros/s/AKfycbw4KApWiFHzYgFQGhVl69oOWziILOMd18Sv9j043uLu9--YzWz44544XyV6gFhOo23u/exec";

/* ================= STATE ================= */

const state = {
  currentTab: "dashboard",
  sales: [],
  suppliers: [],
  expenses: [],
  hr: []
};

/* ================= INIT ================= */

document.addEventListener("DOMContentLoaded", function () {
  initSidebar();
  initTabs();
  initYearFilter();
  initForms();
  initSearch();
  setDefaultDates();

  checkConnection();
  loadDashboard();
  loadSales();
  loadSuppliers();
  loadExpenses();
  loadHR();
});

/* ================= SIDEBAR / MOBILE NAV ================= */

function initSidebar() {
  const menuToggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");

  menuToggle.addEventListener("click", function () {
    sidebar.classList.toggle("open");
    overlay.classList.toggle("show");
  });

  overlay.addEventListener("click", function () {
    sidebar.classList.remove("open");
    overlay.classList.remove("show");
  });
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

    const summary = document.getElementById("dashboardSummaryText");
    const profitWord = res.netProfit >= 0 ? "profit" : "loss";
    summary.innerHTML =
      `Orion Tech recorded <strong>${res.salesCount}</strong> sale(s) in the selected period, ` +
      `generating <strong>${formatCurrency(res.totalSales)}</strong> in revenue with ` +
      `<strong>${formatCurrency(res.totalDues)}</strong> still due from customers. ` +
      `After expenses and HR costs, the shop is showing a net <strong>${profitWord}</strong> of ` +
      `<strong>${formatCurrency(Math.abs(res.netProfit))}</strong>.`;
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
  });
}

function renderSalesTable() {
  const tbody = document.querySelector("#salesTable tbody");

  if (!state.sales.length) {
    tbody.innerHTML = '<tr><td class="empty-cell" colspan="7">No sales recorded yet.</td></tr>';
    return;
  }

  const rows = state.sales.slice().reverse().slice(0, 25).map(function (row) {
    return `<tr>
      <td>${formatDate(row.Date)}</td>
      <td>${row.BuyerName || "-"}</td>
      <td>${row.Phone || "-"}</td>
      <td>${row.LaptopModel || "-"}</td>
      <td>${row.SerialNumber || "-"}</td>
      <td>${formatCurrency(row.Price)}</td>
      <td>${formatCurrency(row.DueAmount)}</td>
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
        ${badge}
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

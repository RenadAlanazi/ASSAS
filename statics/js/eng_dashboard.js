/* ================= Imports ================= */
import { db, auth } from "./firebase.js";
import { collection, onSnapshot, updateDoc, doc, serverTimestamp, query, orderBy, deleteDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { addActivity } from "./utils.js";

/* ================= Constants ================= */
const statusTranslation = {
  pending: "غير مكتمل",
};
const severityTranslation = {
  high: "عالية",
  Red: "عالية",
  medium: "متوسطة",
  Orange: "متوسطة",
  low: "منخفضة",
  Yellow: "منخفضة",
  Green: "طبيعي",
};
const damageTypeTranslation = {
  pothole: "حفرة",
  crack: "تشقق",
  water: "تجمع مياه",
  normal: "سليم",
};
const itemsPerPage = 8;
const isEnglish = () => localStorage.getItem("language") === "en";

const translateText = (ar, en) => {
  return isEnglish() ? en : ar;
};

/* ================= State ================= */
let allReports = [];
let filteredReports = [];
let markersMap = {};
let usersMap = {};
let activePopup = null;
let currentPage = 1;
let completedChart = null;
let inProgressChart = null;
let totalChart = null;
let assignedChart = null;

const tableBody = document.getElementById("tableBody");
const searchInput = document.getElementById("searchInput");
const filterSeverity = document.getElementById("filterSeverity");
const filterLocation = document.getElementById("filterLocation");
const filterDamageType = document.getElementById("filterDamageType");
const filterDateFrom = document.getElementById("filterDateFrom");
const filterDateTo = document.getElementById("filterDateTo");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");

/* ================= Helpers ================= */
function parseFirestoreDate(field) {
  if (!field) return null;
  if (typeof field.toDate === "function") return field.toDate();
  const date = new Date(field);
  return isNaN(date.getTime()) ? null : date;
}

function formatDate(date) {
  if (!date) return "-";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const getColor = (report) => {
  const sev = String(report.severity || "").toLowerCase();
  if (sev === "high" || sev === "red" || sev === "عالية") return "red";
  if (sev === "medium" || sev === "orange" || sev === "متوسطة") return "orange";
  if (sev === "low" || sev === "yellow" || sev === "منخفضة") return "yellow";
  return "green";
};

function normalizeDamageType(value) {
  const damage = String(value || "").trim().toLowerCase();
  if (["pothole", "hole", "حفرة"].includes(damage)) return "pothole";
  if (["crack", "cracks", "تشقق", "شقوق"].includes(damage)) return "crack";
  if (["water", "water_pool", "water accumulation", "تجمع مياه"].includes(damage)) return "water";
  if (["normal", "safe", "سليم", "طبيعي"].includes(damage)) return "normal";
  return damage;
}

function normalizeSeverity(val) {
  if (!val) return "";
  val = String(val).toLowerCase();
  if (["high", "red", "عالية"].includes(val)) return "high";
  if (["medium", "orange", "متوسطة"].includes(val)) return "medium";
  if (["low", "yellow", "منخفضة"].includes(val)) return "low";
  if (["green", "طبيعي"].includes(val)) return "green";
  return val;
}

function debounce(func, delay = 300) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
}

function getMap() {
  return typeof map !== "undefined" ? map : (typeof window !== "undefined" ? window.map : null);
}

function showToast(message, type = "assign") {
  const container = document.querySelector(".toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.classList.add("toast", type);
  const iconMap = { assign: "fa-user-plus", error: "fa-triangle-exclamation" };
  toast.innerHTML = `<i class="fa-solid ${iconMap[type] || "fa-info"}"></i><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

const getPredictionText = (report) => {
  const val = report.prediction_note || report.prediction;
  if (isEnglish()) {
    const map = {
      "مستقر": "Stable",
      "مستقر أو يتدهور ببطء": "Slow Deterioration",
      "قد يتفاقم": "Potential Deterioration",
      "سيتفاقم بمرور الوقت": "Ongoing Deterioration",
      "سيتفاقم بسرعة": "Rapid Deterioration",
    };
    return map[val] || val || "No analysis";
  }
  return val || "لا يوجد تحليل";
};

/* ================= Notification Helpers ================= */
const notificationIcons = {
  complete: "fa-check",
  success: "fa-check",
  upload: "fa-cloud-arrow-up",
  assign: "fa-user-plus",
  revert: "fa-rotate-left",
  delete: "fa-trash",
  error: "fa-triangle-exclamation",
  update: "fa-pen-to-square",
  general: "fa-bell",
};

const notificationTypes = new Set(Object.keys(notificationIcons));
const readNotificationStorageKey = "assasReadNotificationIds_Eng";
const notificationLifetimeMs = 7 * 24 * 60 * 60 * 1000;
let currentNotificationIds = [];

function getReadNotificationIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(readNotificationStorageKey)) || []);
  } catch (error) {
    return new Set();
  }
}

function saveReadNotificationIds(ids) {
  localStorage.setItem(readNotificationStorageKey, JSON.stringify([...ids]));
}

function getNotificationDate(timestamp) {
  if (!timestamp) return null;
  if (typeof timestamp.toDate === "function") return timestamp.toDate();
  const date = new Date(timestamp);
  return isNaN(date.getTime()) ? null : date;
}

function isExpiredNotification(data) {
  const createdAt = getNotificationDate(data.createdAt);
  return createdAt && Date.now() - createdAt.getTime() > notificationLifetimeMs;
}

function updateNotificationBadge() {
  const notificationBtn = document.getElementById("notificationBtn");
  const notificationCount = document.getElementById("notificationCount");
  if (!notificationCount) return;

  const readIds = getReadNotificationIds();
  const unreadCount = currentNotificationIds.filter((id) => !readIds.has(id)).length;

  notificationCount.textContent = unreadCount;
  notificationCount.classList.toggle("hidden", unreadCount === 0);
  notificationBtn?.classList.toggle("has-unread", unreadCount > 0);
}

function markNotificationsAsRead() {
  const readIds = getReadNotificationIds();
  currentNotificationIds.forEach((id) => readIds.add(id));
  saveReadNotificationIds(readIds);
  updateNotificationBadge();
}

function getNotificationType(type) {
  return notificationTypes.has(type) ? type : "general";
}

function isEngineerNotificationForCurrentUser(data) {
  const currentUserId = auth.currentUser?.uid;
  if (!currentUserId) return false;

  return data.targetUserId === currentUserId || data.actorUserId === currentUserId;
}

function formatTime(timestamp) {
  if (!timestamp) return "";
  const date = typeof timestamp.toDate === "function" ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(date.getTime())) return "";
  return isEnglish() ? date.toLocaleString("en-US") : date.toLocaleString("ar-SA");
}

/* ================= Dashboard Rendering ================= */
class CustomPopup extends google.maps.OverlayView {
  constructor(position, content) {
    super();
    this.position = position;
    this.containerDiv = document.createElement("div");
    this.containerDiv.innerHTML = content;
    this.containerDiv.style.position = "absolute";
    this.containerDiv.style.transform = "translate(-50%, -100%)";
    this.containerDiv.style.zIndex = "1000";
    this.hasCloseEvent = false;
  }
  onAdd() {
    const panes = this.getPanes();
    if (panes?.floatPane) panes.floatPane.appendChild(this.containerDiv);
    const closeBtn = this.containerDiv.querySelector("#closePopupBtn");
    if (closeBtn && !this.hasCloseEvent) {
      closeBtn.addEventListener("click", () => {
        this.setMap(null);
        activePopup = null;
      });
      this.hasCloseEvent = true;
    }
  }
  draw() {
    const projection = this.getProjection();
    if (!projection) return;
    const point = projection.fromLatLngToDivPixel(this.position);
    if (point) {
      this.containerDiv.style.left = `${point.x}px`;
      this.containerDiv.style.top = `${point.y}px`;
    }
  }
  onRemove() {
    if (this.containerDiv.parentElement) this.containerDiv.parentElement.removeChild(this.containerDiv);
  }
}

function buildPopupContent(report) {
  if (!report) return "";
  const employeeName = usersMap[report.created_by] || "-";
  const safeId = report.id ? report.id.substring(0, 5) : "-";
  return `
 <div style="position:relative;width:min(90vw,320px);max-height:80vh;overflow-y:auto;padding:20px;font-family:Cairo;text-align:${isEnglish() ? "left" : "right"};background:${document.body.classList.contains("dark") ? "#12211c" : "white"};color:${document.body.classList.contains("dark") ? "#f1f5f9" : "#000"};border-top:6px solid ${getColor(report)};border-radius:14px;box-shadow:0 15px 35px rgba(0,0,0,0.25);">
  <button id="closePopupBtn" style="position:absolute;top:10px;${isEnglish() ? "right" : "left"}:10px;border:none;background:${document.body.classList.contains("dark") ? "#173b32" : "#eee"};color:${document.body.classList.contains("dark") ? "#fff" : "#000"};width:30px;height:30px;border-radius:50%;cursor:pointer;">✕</button>

  ${report.image_url ? `<img src="${report.image_url}" style="width:100%;height:180px;object-fit:cover;border-radius:10px;margin-bottom:10px;" onerror="this.style.display='none'" />` : ""}

  <h4 style="margin:8px 0; color:#0c5742; font-size:18px">#${safeId}</h4>

  <p style="margin:5px 0;">👤 <b>${translateText("الموظف", "Employee")}:</b> ${employeeName}</p>

  <p style="margin:5px 0;">🚦 <b>${translateText("الحالة", "Status")}:</b> ${
    isEnglish()
      ? {
          pending: "Pending",
          in_progress: "In Progress",
          completed: "Completed"
        }[report.status] || "-"
      : statusTranslation[report.status] || "-"
  }</p>

  <hr style="margin:10px 0; opacity:0.2;" />

  <p style="margin:5px 0;">📍 <b>${translateText("الموقع", "Location")}:</b> ${report.street_name || "-"}</p>

  <p style="margin:5px 0;">⚠️ <b>${translateText("الخطورة", "Severity")}:</b> ${
    isEnglish()
      ? {
          high: "High",
          Red: "High",
          red: "High",
          medium: "Medium",
          Orange: "Medium",
          orange: "Medium",
          low: "Low",
          Yellow: "Low"
        }[report.severity] || "-"
      : severityTranslation[
          normalizeSeverity(report.severity)
        ] || "-"
  }</p>

  <p style="margin:5px 0;">🤖 <b>${translateText("التنبؤ", "Prediction")}:</b> ${getPredictionText(report)}</p>
</div>
 `;
}

function renderMapMarkers() {
  const gMap = getMap();
  if (typeof google === "undefined" || !gMap) return;
  const currentIds = new Set(allReports.map((r) => r.id));
  Object.keys(markersMap).forEach((id) => {
    if (!currentIds.has(id)) {
      markersMap[id].marker.setMap(null);
      delete markersMap[id];
    }
  });
  allReports.forEach((report) => {
    if (!report.latitude || !report.longitude) return;
    if (!markersMap[report.id]) {
      const color = getColor(report);
      const position = new google.maps.LatLng(parseFloat(report.latitude), parseFloat(report.longitude));
      const marker = new google.maps.Marker({
        position,
        icon: { url: `https://maps.google.com/mapfiles/ms/icons/${color}-dot.png` },
      });
      marker.setMap(null);
      marker.addListener("click", () => {
        if (activePopup) activePopup.setMap(null);
        activePopup = new CustomPopup(position, buildPopupContent(report));
        activePopup.setMap(gMap);
      });
      markersMap[report.id] = { marker, position, popupContent: buildPopupContent(report) };
    }
  });
}

function renderTablePaginated() {
  if (!tableBody) return;
  tableBody.innerHTML = "";
  const totalItems = filteredReports.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  currentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const pageData = filteredReports.slice(startIndex, startIndex + itemsPerPage);
  
  const rowsHtml = pageData.map((report) => {
    const color = getColor(report);
    const createdDate = parseFirestoreDate(report.created_at || report.created_at_string);
    const safeId = report.id ? report.id.substring(0, 5) : "-";
    return `
      <tr data-id="${report.id}" style="cursor: pointer;">
<td>
    <button 
      class="action-btn assign-btn" 
      aria-label="${translateText("إسناد التقرير", "Assign report")}"
    >
      <i class="fa-solid fa-user-plus"></i>
    </button>
  </td>

  <td class="focus-col" style="cursor: pointer;">#${safeId}</td>

  <td>${formatDate(createdDate)}</td>

  <td>${report.street_name || translateText("غير محدد", "Not specified")}</td>

<td>${
  isEnglish()
    ? {
        pothole: "Pothole",
        crack: "Crack",
        water: "Water Pooling",
        normal: "Normal",
        "حفرة": "Pothole",
        "تشقق": "Crack",
        "تجمع مياه": "Water Pooling",
        "سليم": "Normal"
      }[
        normalizeDamageType(report.damage_type)
      ] || report.damage_type || "-"
    : damageTypeTranslation[
        normalizeDamageType(report.damage_type)
      ] || report.damage_type || "-"
}</td>
<td>${getPredictionText(report)}</td>
  <td><span class="status-dot tooltip ${color}"></span></td>
</tr>
`;
  }).join("");
  tableBody.insertAdjacentHTML("beforeend", rowsHtml);
const pageInfo = document.getElementById("pageInfo");
const totalPagesCount = Math.max(1, Math.ceil(filteredReports.length / itemsPerPage));

if (pageInfo) {
  pageInfo.innerText = translateText(
    `صفحة ${currentPage} من ${totalPagesCount}`,
    `Page ${currentPage} of ${totalPagesCount}`
  );
}

prevPageBtn.disabled = currentPage === 1;
nextPageBtn.disabled = currentPage === totalPagesCount;
}

function applyFiltersAndSearchCore() {
  const searchVal = (searchInput?.value || "").trim().toLowerCase();
  const severityVal = filterSeverity?.value;
  const locationVal = filterLocation?.value;
  const damageVal = filterDamageType?.value;

  let dateFromVal = null;
  if (filterDateFrom?.value) {
    dateFromVal = new Date(filterDateFrom.value);
    dateFromVal.setHours(0, 0, 0, 0);
  }
  let dateToVal = null;
  if (filterDateTo?.value) {
    dateToVal = new Date(filterDateTo.value);
    dateToVal.setHours(23, 59, 59, 999);
  }

  filteredReports = [];
  const mapVisibleIds = new Set();
  let firstMatch = null;

  allReports.forEach((report) => {
    let matches = true;
    if (report.status !== "pending") return;

    if (searchVal) {
      const idMatch = report.id?.toLowerCase().includes(searchVal);
      const streetMatch = report.street_name?.toLowerCase().includes(searchVal);
      if (!idMatch && !streetMatch) matches = false;
    }
    if (severityVal) {
      if (normalizeSeverity(report.severity) !== severityVal.toLowerCase()) matches = false;
    }

    if (damageVal) {
      const reportDamage = normalizeDamageType(report.damage_type || report.prediction || "");
      const selectedDamage = normalizeDamageType(damageVal);
      if (reportDamage !== selectedDamage) matches = false;
    }

    if (locationVal && !String(report.street_name || "").toLowerCase().includes(locationVal.toLowerCase())) matches = false;

    const reportDate = parseFirestoreDate(report.created_at || report.created_at_string);
    if (reportDate) {
      if (dateFromVal && reportDate < dateFromVal) matches = false;
      if (dateToVal && reportDate > dateToVal) matches = false;
    }

    if (matches) {
      filteredReports.push(report);
      mapVisibleIds.add(report.id);
      if (!firstMatch) firstMatch = report.id;
    }
  });

  const gMap = getMap();
  Object.entries(markersMap).forEach(([id, obj]) => {
    const isVisible = mapVisibleIds.has(id);
    obj.marker.setMap(isVisible ? gMap : null);
  });

  currentPage = 1;
  renderTablePaginated();
}

const applyFiltersAndSearch = debounce(applyFiltersAndSearchCore, 300);

function createChart(id, color) {
  const canvas = document.getElementById(id);
  if (!canvas || typeof window.Chart === "undefined") return null;
  const ctx = canvas.getContext("2d");
  return new window.Chart(ctx, {
    type: "doughnut",
    data: {
      datasets: [{
        data: [0, 100],
        backgroundColor: [color, "#eeeeee"],
        borderWidth: 0,
        cutout: "75%",
      }],
    },
    options: {
      responsive: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        datalabels: {
          display: (context) => context.dataIndex === 0,
          color: document.body.classList.contains("dark") ? "#fff" : "#000",
          font: { size: 22, weight: "bold" },
          anchor: "center",
          align: "center",
          formatter: (value) => Math.round(value) + "%",
        },
      },
    },
    plugins: [{
      id: "centerText",
      beforeDraw(chart) {
        const { ctx } = chart;
        const meta = chart.getDatasetMeta(0);
        if (!meta.data.length) return;
        const centerX = meta.data[0].x;
        const centerY = meta.data[0].y;
        const value = chart.data.datasets[0].data[0] || 0;
        const text = Math.round(value) + "%";
        ctx.save();
        ctx.font = `bold ${chart.height / 4.5}px Cairo`;
        ctx.fillStyle = document.body.classList.contains("dark") ? "#fff" : "#000";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, centerX, centerY);
        ctx.restore();
      },
    }],
  });
}


function updateChartDataSafe(chart, value, total) {
  if (chart && chart.data?.datasets?.length) {
    const percentage = total <= 0 ? 0 : (value / total) * 100;
    const remainder = 100 - percentage;
    chart.data.datasets[0].data = [percentage, remainder];
    chart.update();
  }
}

function updateChartsTotals(reports) {
  const currentUserId = auth.currentUser?.uid;
  if (!currentUserId) return;
  let counts = { pending: 0, assignedToMe: 0, completed: 0, inProgress: 0 };
  reports.forEach((r) => {
    if (r.status === "pending") counts.pending++;
    if (r.assigned_to === currentUserId) {
      counts.assignedToMe++;
      if (r.status === "completed") counts.completed++;
      if (r.status === "in_progress") counts.inProgress++;
    }
  });
  updateChartDataSafe(totalChart, counts.pending, reports.length);
  updateChartDataSafe(assignedChart, counts.assignedToMe, reports.length);
  updateChartDataSafe(completedChart, counts.completed, counts.assignedToMe);
  updateChartDataSafe(inProgressChart, counts.inProgress, counts.assignedToMe);
}

window.focusMarker = function (id) {
  const item = markersMap[id];
  const gMap = getMap();
  if (!item || !gMap) return;
  gMap.setZoom(15);
  gMap.panTo(item.position);
  if (activePopup) activePopup.setMap(null);
  activePopup = new CustomPopup(item.position, item.popupContent);
  activePopup.setMap(gMap);
};

window.assignReport = async function(id) {
  const user = auth.currentUser;
  if (!user) return;
  const report = allReports.find((r) => r.id === id);
  if (!report || report.assigned_to) return;
  try {
    await updateDoc(doc(db, "reports", id), {
      assigned_to: user.uid,
      assigned_at: serverTimestamp(),
      status: "in_progress",
    });
    const engineerName = usersMap[user.uid] || user.displayName || "المهندس";
    await addActivity(`تم إسناد البلاغ #${id.substring(0, 5)} إلى المهندس ${engineerName}`, "assign", {
      reportId: id,
      targetUserId: user.uid,
      actorUserId: user.uid,
    });
    showToast("تم إسناد البلاغ لك بنجاح", "assign");
  } catch (err) {
    showToast("فشل في إسناد البلاغ", "error");
  }
};

/* ================= Event Listeners ================= */
function bindEvents() {
  const filterInputs = [searchInput, filterSeverity, filterDamageType, filterLocation, filterDateFrom, filterDateTo];
  filterInputs.forEach((el) => { if (el) el.addEventListener("input", applyFiltersAndSearch); });
  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener("click", () => {
      filterInputs.forEach((el) => { if (el) el.value = ""; });
      currentPage = 1;
      applyFiltersAndSearchCore();
    });
  }
  if (prevPageBtn) {
    prevPageBtn.addEventListener("click", () => {
      if (currentPage > 1) { currentPage--; renderTablePaginated(); }
    });
  }
  if (nextPageBtn) {
    nextPageBtn.addEventListener("click", () => {
      const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
      if (currentPage < totalPages) { currentPage++; renderTablePaginated(); }
    });
  }
  tableBody?.addEventListener("click", (e) => {
    const row = e.target.closest("tr");
    if (!row) return;
    const id = row.getAttribute("data-id");
    if (!id) return;
    if (e.target.closest(".assign-btn")) { window.assignReport(id); return; }
    if (e.target.closest(".focus-col")) { window.focusMarker(id); }
  });
}

/* ================= Initialization ================= */
function initDataListeners() {
  let isAuthReady = false;
  onAuthStateChanged(auth, (user) => {
    isAuthReady = true;
    updateChartsTotals(allReports);
    applyFiltersAndSearchCore();
  });
  onSnapshot(collection(db, "users"), (snapshot) => {
    usersMap = {};
    snapshot.docs.forEach((docSnap) => { usersMap[docSnap.id] = docSnap.data().name || "-"; });
    if (allReports.length > 0 && isAuthReady) {
      renderMapMarkers();
      renderTablePaginated();
    }
  });
  onSnapshot(collection(db, "reports"), (snapshot) => {
    allReports = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    if (isAuthReady) {
      updateChartsTotals(allReports);
      renderMapMarkers();
      applyFiltersAndSearchCore();
    }
  });
}

function initNotifications() {
  const notificationBtn = document.getElementById("notificationBtn");
  const notificationPanel = document.getElementById("notificationPanel");
  const notificationList = document.getElementById("notificationList");
  const notificationCount = document.getElementById("notificationCount");

  if (!notificationBtn || !notificationPanel || !notificationList || !notificationCount) return;

  notificationBtn.addEventListener("click", () => {
    notificationPanel.classList.toggle("hidden");
    if (!notificationPanel.classList.contains("hidden")) {
      markNotificationsAsRead();
    }
  });

  const q = query(collection(db, "activity_logs"), orderBy("createdAt", "desc"));

  onSnapshot(q, (snapshot) => {
    const freshDocs = [];
    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      
      if (isExpiredNotification(data)) {
        deleteDoc(doc(db, "activity_logs", docSnap.id)).catch(() => {});
        return;
      }
      if (!isEngineerNotificationForCurrentUser(data)) {
        return;
      }
      
      freshDocs.push(docSnap);
    });

    currentNotificationIds = freshDocs.map((docSnap) => docSnap.id);
    const readIds = getReadNotificationIds();

    notificationList.innerHTML = "";
    updateNotificationBadge();

    if (freshDocs.length === 0) {
      const empty = document.createElement("div");
      empty.className = "notification-empty";
      empty.textContent = translateText("لا توجد إشعارات حالياً", "No notifications currently");
      notificationList.appendChild(empty);
      return;
    }

    freshDocs.forEach((docSnap) => {
      const data = docSnap.data();
      const type = getNotificationType(data.type);
      const isUnread = !readIds.has(docSnap.id);

      const div = document.createElement("div");
      div.className = `notification-item ${type}${isUnread ? " unread" : ""}`;

      const icon = document.createElement("div");
      icon.className = "notification-icon";
      icon.innerHTML = `<i class="fa-solid ${notificationIcons[type]}"></i>`;

      const content = document.createElement("div");
      content.className = "notification-content";

      const title = document.createElement("div");
      title.className = "notification-title";
      title.textContent = data.message || "";

      const time = document.createElement("div");
      time.className = "notification-time";
      time.textContent = formatTime(data.createdAt);

      content.appendChild(title);
      content.appendChild(time);
      div.appendChild(icon);
      div.appendChild(content);

      notificationList.appendChild(div);
    });
  });
}


function initCharts() {
  totalChart = createChart("totalChart", "#9b59b6");
  assignedChart = createChart("assignedChart", "#3498db");
  completedChart = createChart("completedChart", "#2ecc71");
  inProgressChart = createChart("inProgressChart", "#f39c12");
}

function initApp() {
  initCharts();
  bindEvents();
  initDataListeners();
  initNotifications();
}
initApp();

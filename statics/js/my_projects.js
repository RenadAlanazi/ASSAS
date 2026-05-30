/* ================= Imports ================= */
import { db, auth } from "./firebase.js";
import { collection, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

/* ================= Language Helpers ================= */
function getLang() {
  return localStorage.getItem("language") || "ar";
}

function translateText(ar, en) {
  return getLang() === "en" ? en : ar;
}

const isEnglish = () => getLang() === "en";

function translateDynamicValue(value) {
  if (!isEnglish()) return value;
  const map = {};
  return map[value] || value;
}

/* ================= Theme Helpers ================= */
function applyTheme() {
  const theme = localStorage.getItem("theme") || "light";
  if (theme === "dark") {
    document.body.classList.add("dark");
  } else {
    document.body.classList.remove("dark");
  }
}

applyTheme();

/* ================= Constants ================= */
const itemsPerPage = 8;

function translateSeverity(val) {
  const key = String(val || "").toLowerCase();
  const map = {
    high: { ar: "عالية", en: "High" },
    red: { ar: "عالية", en: "High" },
    medium: { ar: "متوسطة", en: "Medium" },
    orange: { ar: "متوسطة", en: "Medium" },
    low: { ar: "منخفضة", en: "Low" },
    yellow: { ar: "منخفضة", en: "Low" }
  };
  return map[key]?.[isEnglish() ? "en" : "ar"] || val || "-";
}

function translateStatus(val) {
  const map = {
    completed: { ar: "مكتمل", en: "Completed" },
    in_progress: { ar: "قيد التنفيذ", en: "In Progress" },
    pending: { ar: "غير مكتمل", en: "Pending" }
  };
  return map[val]?.[isEnglish() ? "en" : "ar"] || val || "-";
}

function translateDamageType(val) {
  const key = normalizeDamageType(val);
  const map = {
    pothole: { ar: "حفرة", en: "Pothole" },
    crack: { ar: "تشقق", en: "Crack" },
    water: { ar: "تجمع مياه", en: "Water Pooling" },
    normal: { ar: "سليم", en: "Normal" }
  };
  return map[key]?.[isEnglish() ? "en" : "ar"] || val || "-";
}

function translatePrediction(val) {
  const map = {
    "مستقر": { ar: "مستقر", en: "Stable" },
    "مستقر أو يتدهور ببطء": { ar: "مستقر أو يتدهور ببطء", en: "Slow Deterioration" },
    "قد يتفاقم": { ar: "قد يتفاقم", en: "Potential Deterioration" },
    "سيتفاقم بمرور الوقت": { ar: "سيتفاقم بمرور الوقت", en: "Ongoing Deterioration" },
    "سيتفاقم بسرعة": { ar: "سيتفاقم بسرعة", en: "Rapid Deterioration" }
  };
  return map[val]?.[isEnglish() ? "en" : "ar"] || val || "-";
}

/* ================= State ================= */
let usersMap = {};
let allReports = [];
let filteredReports = [];
let currentPage = 1;

const tableBody = document.getElementById("tableBody");
const searchInput = document.getElementById("searchInput");
const filterSeverity = document.getElementById("filterSeverity");
const filterLocation = document.getElementById("filterLocation");
const filterStatus = document.getElementById("filterStatus");
const filterDamageType = document.getElementById("filterDamageType");
const filterDateFrom = document.getElementById("filterDateFrom");
const filterDateTo = document.getElementById("filterDateTo");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const pageInfo = document.getElementById("pageInfo");
const reportDetailsCard = document.getElementById("reportDetailsCard");

/* ================= Helpers ================= */
const formatDate = (date) => {
  if (!date) return "-";
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}-${month}-${day}`;
};

function normalizeDamageType(value) {
  const damage = String(value || "").trim().toLowerCase();

  if (["pothole", "hole", "حفرة", "حفره"].includes(damage)) return "pothole";
  if (["crack", "cracks", "تشقق", "شقوق", "تشققات"].includes(damage)) return "crack";
  if (["water", "water_pool", "water accumulation", "تجمع مياه", "مياه"].includes(damage)) return "water";
  if (["normal", "safe", "سليم", "طبيعي"].includes(damage)) return "normal";

  return damage;
}

function getReportDamageType(report) {
  return normalizeDamageType(
    report.damage_type ||
    report.damageType ||
    report.damage
  );
}

/* ================= My Projects Rendering ================= */
const renderTablePaginated = () => {
  tableBody.innerHTML = "";
  const totalItems = filteredReports.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageData = filteredReports.slice(startIndex, endIndex);

  pageData.forEach((report) => {
    const createdDate = report.created_at
      ? new Date(report.created_at.toDate ? report.created_at.toDate() : report.created_at)
      : null;

    const assignedDate = report.assigned_at
      ? new Date(report.assigned_at.toDate ? report.assigned_at.toDate() : report.assigned_at)
      : null;

    const completedDate = report.completion_date
      ? new Date(report.completion_date.toDate ? report.completion_date.toDate() : report.completion_date)
      : null;

    const completedClass = report.status === "completed" ? "row-completed" : "";

    tableBody.insertAdjacentHTML("beforeend", `
      <tr data-id="${report.id}" class="${completedClass}" style="cursor: pointer;">
        <td>
          <button class="action-btn update-btn" onclick="event.stopPropagation(); window.location.href='update.html?id=${report.id}';">
            <i class="fa-solid fa-pen"></i>
          </button>
        </td>
        <td class="focus-col">#${report.id.substring(0, 5)}</td>
        <td>${translateStatus(report.status)}</td>
        <td>${report.street_name || "غير محدد"}</td>
        <td>${formatDate(createdDate)}</td>
        <td>${formatDate(assignedDate)}</td>
        <td>${formatDate(completedDate)}</td>
      </tr>
    `);
  });

  pageInfo.innerText = translateText(`صفحة ${currentPage} من ${totalPages}`, `Page ${currentPage} of ${totalPages}`);
  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage === totalPages;
};

const applyFiltersAndSearch = () => {
  const searchVal = searchInput.value.trim().toLowerCase();
  const severityVal = filterSeverity.value;
  const locationVal = filterLocation.value;
  const statusVal = filterStatus.value;
  const damageTypeVal = filterDamageType.value;

  const dateFromVal = filterDateFrom.value ? new Date(filterDateFrom.value) : null;
  if (dateFromVal) dateFromVal.setHours(0, 0, 0, 0);

  const dateToVal = filterDateTo.value ? new Date(filterDateTo.value) : null;
  if (dateToVal) dateToVal.setHours(23, 59, 59, 999);

  filteredReports = allReports.filter(report => {
    let match = true;

    if (searchVal) {
      const street = (report.street_name || "").toLowerCase();
      if (!report.id.includes(searchVal) && !street.includes(searchVal)) match = false;
    }

    if (severityVal) {
      const reportSev = String(report.severity || "").toLowerCase();
      const filterSev = severityVal.toLowerCase();
      let isSeverityMatch = false;

      if (filterSev === "high" && (reportSev === "high" || reportSev === "red")) {
        isSeverityMatch = true;
      } else if (filterSev === "medium" && (reportSev === "medium" || reportSev === "orange")) {
        isSeverityMatch = true;
      } else if (filterSev === "low" && (reportSev === "low" || reportSev === "yellow")) {
        isSeverityMatch = true;
      }

      if (!isSeverityMatch) match = false;
    }

    if (statusVal && report.status !== statusVal) match = false;
    if (locationVal && (!report.street_name || !report.street_name.includes(locationVal))) match = false;

    if (damageTypeVal) {
      const reportType = normalizeDamageType(report.damage_type || report.prediction || "");
      const selectedType = normalizeDamageType(damageTypeVal);
      if (reportType !== selectedType) match = false;
    }

    if (dateFromVal && report.created_at && new Date(report.created_at.toDate?.() || report.created_at) < dateFromVal) match = false;
    if (dateToVal && report.created_at && new Date(report.created_at.toDate?.() || report.created_at) > dateToVal) match = false;

    return match;
  });

  currentPage = 1;
  renderTablePaginated();
};

const renderDetails = (report) => {
  if (!report) return;

  const isCompleted = report.status === "completed";
  const canFlip = isCompleted && report.completion_image;

  const placeholderImg = '../statics/img/placeholder.png';
  const frontImageSrc = report.image_url || placeholderImg;
  const backImageSrc = report.completion_image || placeholderImg;

  const imageHTML = canFlip
    ? `<div class="details-image flip-container" onclick="this.classList.toggle('flip')">
         <div class="details-inner">
           <div class="details-front">
             <img src="${frontImageSrc}" alt="Original" onerror="this.src='${placeholderImg}'" />
           </div>
           <div class="details-back">
             <img src="${backImageSrc}" alt="Completed" onerror="this.src='${placeholderImg}'" />
           </div>
         </div>
       </div>`
    : `<div class="details-image">
         <div class="details-inner">
           <div class="details-front">
             <img src="${frontImageSrc}" alt="Report Image" onerror="this.src='${placeholderImg}'" />
           </div>
         </div>
       </div>`;

  reportDetailsCard.className = `report-details ${report.status}`;
  reportDetailsCard.classList.remove("hidden");

    reportDetailsCard.innerHTML = `
      <div class="details-info">
        <div class="details-info-header">
          <h3>${translateText('رقم البلاغ', 'Report ID')}: #${report.id.substring(0, 5)}...</h3>
        </div>
        <div class="info-grid">
          <div class="info-item"><i class="fa-solid fa-location-dot"></i> <span>${translateText('الموقع', 'Location')}: ${report.street_name || translateText('غير محدد', 'Not specified')}</span></div>
          <div class="info-item"><i class="fa-solid fa-user"></i> <span>${translateText('الموظف', 'Employee')}: ${usersMap[report.created_by] || "-"}</span></div>
          <div class="info-item"><i class="fa-solid fa-helmet-safety"></i> <span>${translateText('المهندس', 'Engineer')}: ${usersMap[report.assigned_to] || "-"}</span></div>
          <div class="info-item"><i class="fa-solid fa-wrench"></i> <span>${translateText('الضرر', 'Damage')}: ${translateDamageType(report.damage_type || report.prediction)}</span></div>
          <div class="info-item"><i class="fa-solid fa-triangle-exclamation"></i> <span>${translateText('الخطورة', 'Severity')}: ${translateSeverity(report.severity)}</span></div>
          <div class="info-item"><i class="fa-solid fa-brain"></i> <span>${translateText('التنبؤ', 'Prediction')}: ${translatePrediction(report.prediction || report.prediction_note || "-")}</span></div>
        </div>
      </div>
      ${imageHTML}
    `;
};

/* ================= Event Listeners ================= */
[
  searchInput,
  filterSeverity,
  filterLocation,
  filterStatus,
  filterDamageType,
  filterDateFrom,
  filterDateTo
].forEach((el) => el.addEventListener("input", applyFiltersAndSearch));

prevPageBtn.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    renderTablePaginated();
  }
});

nextPageBtn.addEventListener("click", () => {
  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
  if (currentPage < totalPages) {
    currentPage++;
    renderTablePaginated();
  }
});

resetFiltersBtn.addEventListener("click", () => {
  filterSeverity.value = "";
  filterLocation.value = "";
  filterStatus.value = "";
  filterDamageType.value = "";
  filterDateFrom.value = "";
  filterDateTo.value = "";
  searchInput.value = "";
  applyFiltersAndSearch();
});

tableBody.addEventListener("click", (e) => {
  const row = e.target.closest("tr");
  if (!row) return;

  const id = row.getAttribute("data-id");
  if (!id) return;

  const report = allReports.find(r => r.id === id);
  renderDetails(report);
});

/* ================= Initialization ================= */
onSnapshot(collection(db, "users"), (snapshot) => {
  usersMap = {};
  snapshot.docs.forEach(docSnap => {
    const data = docSnap.data();
    usersMap[docSnap.id] = data.name || "-";
  });
});

onAuthStateChanged(auth, (user) => {
  if (!user) return;

  const q = query(
    collection(db, "reports"),
    where("assigned_to", "==", user.uid),
    where("status", "in", ["in_progress", "completed"])
  );

  onSnapshot(q, (snapshot) => {
    allReports = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    applyFiltersAndSearch();
  });
});

/* ================= Imports ================= */
import { db, auth } from "./firebase.js";
import {
  collection,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { addActivity, showToast } from "./utils.js";

/* ================= Language and Theme Helpers ================= */
function getLang() {
  return localStorage.getItem("language") || "ar";
}

const isEnglish = () => getLang() === "en";

function translateText(ar, en) {
  return isEnglish() ? en : ar;
}

function applyTheme() {
  const theme = localStorage.getItem("theme") || "light";
  if (theme === "dark") {
    document.body.classList.add("dark");
  } else {
    document.body.classList.remove("dark");
  }
}

/* ================= Constants ================= */
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

  return map[key]?.[isEnglish() ? "en" : "ar"] || "-";
}

function translateStatus(val) {
  const map = {
    completed: { ar: "مكتمل", en: "Completed" },
    in_progress: { ar: "قيد التنفيذ", en: "In Progress" },
    pending: { ar: "غير مكتمل", en: "Pending" }
  };

  return map[val]?.[isEnglish() ? "en" : "ar"] || "-";
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
const btnAll = document.getElementById("btnAll");
const btnMine = document.getElementById("btnMine");

let currentView = "all";
let usersMap = {};
let allReports = [];
let filteredReports = [];
let currentPage = 1;
const itemsPerPage = 8;

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


const getCurrentUserId = () => {
  try {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    return (
      storedUser?.uid ||
      storedUser?.firebase_uid ||
      storedUser?.user_id ||
      storedUser?.id ||
      auth.currentUser?.uid ||
      null
    );
  }
  catch (error) {
    return auth.currentUser?.uid || null;
  }
};

const showConfirmModal = (title, text) => {
  return new Promise((resolve) => {
    const modal = document.getElementById("customModal");
    document.getElementById("modalTitle").innerText = title;
    document.getElementById("modalText").innerText = text;
    const confirmBtn = document.getElementById("confirmBtn");
    const cancelBtn = document.getElementById("cancelBtn");
    modal.classList.remove("hidden");
    const cleanUp = () => {
      modal.classList.add("hidden");
      confirmBtn.onclick = null;
      cancelBtn.onclick = null;
    };
    confirmBtn.onclick = () => {
      cleanUp();
      resolve(true);
    };
    cancelBtn.onclick = () => {
      cleanUp();
      resolve(false);
    };
  });
};

/* ================= Projects Rendering ================= */
const applyFiltersAndSearch = () => {
  const searchVal = searchInput.value.trim().toLowerCase();
  const severityVal = filterSeverity.value;
  const locationVal = filterLocation.value;
  const statusVal = filterStatus.value;
  const damageTypeVal = filterDamageType.value;
  const currentUserId = getCurrentUserId();
  const dateFromVal = filterDateFrom.value ? new Date(filterDateFrom.value) : null;
  
  if (dateFromVal) dateFromVal.setHours(0, 0, 0, 0);
  
  const dateToVal = filterDateTo.value ? new Date(filterDateTo.value) : null;
  if (dateToVal) dateToVal.setHours(23, 59, 59, 999);

  filteredReports = allReports.filter((report) => {
    let match = true;
    if (currentView === "mine" && report.created_by !== currentUserId) match = false;

    if (searchVal) {
      const street = report.street_name ? report.street_name.toLowerCase() : "";
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
      const reportType = getReportDamageType(report);
      const selectedType = normalizeDamageType(damageTypeVal);
      if (reportType !== selectedType) match = false;
    }

    if (dateFromVal && report.created_at && new Date(report.created_at.toDate ? report.created_at.toDate() : report.created_at) < dateFromVal) match = false;
    if (dateToVal && report.created_at && new Date(report.created_at.toDate ? report.created_at.toDate() : report.created_at) > dateToVal) match = false;
    
    return match;
  });

  currentPage = 1;
  renderTablePaginated();
};

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
    const createdDate = report.created_at ? new Date(report.created_at.toDate ? report.created_at.toDate() : report.created_at) : null;
    const assignedDate = report.assigned_at ? new Date(report.assigned_at.toDate ? report.assigned_at.toDate() : report.assigned_at) : null;
    const completionDate = report.completion_date ? new Date(report.completion_date.toDate ? report.completion_date.toDate() : report.completion_date) : null;
    const completedClass = report.status === "completed" ? "row-completed" : "";

    tableBody.insertAdjacentHTML(
      "beforeend",
      `<tr data-id="${report.id}" class="${completedClass}" style="cursor: pointer;">
        <td class="actions-col">
          <button class="action-btn delete-btn" title="حذف البلاغ">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
        <td class="actions-col">
          ${report.status === "pending" ? `
            <div class="assign-dropdown">
              <button class="action-btn assign-toggle-btn">
                <i class="fa-solid fa-user-plus"></i>
              </button>
              <div class="assign-menu hidden">
                ${Object.entries(usersMap)
                  .filter(([id, user]) => user.role === "engineer")
                  .map(([id, user]) => `
                    <div class="assign-item" data-user="${id}" data-report="${report.id}">
                      ${user.name}
                    </div>
                  `).join("")}
              </div>
            </div>
          ` : ""}
          ${report.status === "in_progress" ? `
            <button class="action-btn complete-btn" title="إنهاء البلاغ">
              <i class="fa-solid fa-check"></i>
            </button>
          ` : ""}
          ${report.status === "completed" ? `
            <button class="action-btn revert-btn" title="إرجاع إلى قيد المراجعة">
              <i class="fa-solid fa-rotate-left"></i>
            </button>
          ` : ""}
        </td>
        <td class="focus-col">#${report.id.substring(0, 5)}</td>
        <td>${translateStatus(report.status)}</td>
        <td>${report.street_name || translateText("غير محدد", "Not specified")}</td>
        <td>${formatDate(createdDate)}</td>
        <td>${formatDate(assignedDate)}</td>
        <td>${formatDate(completionDate)}</td>
      </tr>`
    );
  });

  pageInfo.innerText = `صفحة ${currentPage} من ${totalPages}`;
  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage === totalPages;
};

const renderDetails = (report) => {
  if (!report) return;
  const isCompleted = report.status === "completed";
  const canFlip = isCompleted && report.completion_image;
  const placeholderImg = '../statics/img/placeholder.png';
  const frontImageSrc = report.image_url || placeholderImg;
  const backImageSrc = report.completion_image || placeholderImg;

  const imageHTML = canFlip
    ? `
    <div class="details-image flip-container" onclick="this.classList.toggle('flip')">
      <div class="details-inner">
        <div class="details-front">
          <img src="${frontImageSrc}" alt="Original" onerror="this.src='${placeholderImg}'" />
        </div>
        <div class="details-back">
          <img src="${backImageSrc}" alt="Completed" onerror="this.src='${placeholderImg}'" />
        </div>
      </div>
    </div>`
    : `
    <div class="details-image">
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
        <h3>${translateText("رقم البلاغ", "Report ID")}: #${report.id.substring(0, 5)}...</h3>
      </div>
      <div class="info-grid">
        <div class="info-item"><i class="fa-solid fa-location-dot"></i> <span>${translateText("الموقع", "Location")}: ${report.street_name || translateText("غير محدد", "Not specified")}</span></div>
        <div class="info-item"><i class="fa-solid fa-user"></i> <span>${translateText("الموظف", "Employee")}: ${usersMap[report.created_by]?.name || "-"}</span></div>
        <div class="info-item"><i class="fa-solid fa-helmet-safety"></i> <span>${translateText("المهندس", "Engineer")}: ${usersMap[report.assigned_to]?.name || "-"}</span></div>
        <div class="info-item"><i class="fa-solid fa-wrench"></i> <span>${translateText("الضرر", "Damage")}: ${translateDamageType(report.damage_type || report.prediction)}</span></div>
        <div class="info-item"><i class="fa-solid fa-triangle-exclamation"></i> <span>${translateText("الخطورة", "Severity")}: ${translateSeverity(report.severity)}</span></div>
        <div class="info-item"><i class="fa-solid fa-brain"></i> <span>${translateText("التنبؤ", "Prediction")}: ${translatePrediction(report.prediction || report.prediction_note)}</span></div>
      </div>
    </div>
    ${imageHTML}
  `;
};

const deleteReport = async (id) => {
  const confirmed = await showConfirmModal(
    translateText("حذف البلاغ؟", "Delete Report?"),
    translateText("سيتم حذف البلاغ نهائيًا من النظام", "This report will be permanently deleted from the system")
  );
  if (!confirmed) return;
  try {
    const report = allReports.find((item) => item.id === id);
    await deleteDoc(doc(db, "reports", id));
     await addActivity(
      `تم حذف البلاغ #${id.substring(0,5)}`,
      "delete",
      {
        reportId: id,
        targetUserId: report?.assigned_to || null,
        actorUserId: auth.currentUser?.uid || null,
      }
    );
    showToast(translateText("تم حذف البلاغ", "Report deleted"), "delete");
    if (reportDetailsCard.innerHTML.includes(id.substring(0, 5))) {
      reportDetailsCard.classList.add("hidden");
    }
  } catch (err) {
    showToast(translateText("حدث خطأ أثناء عملية الحذف", "Error occurred during deletion"), "error");
  }
};

const completeReport = async (id) => {
  try {
    const report = allReports.find((item) => item.id === id);
    const engineerId = report?.assigned_to || null;
    const engineerName = usersMap[engineerId]?.name || "المهندس";

    await updateDoc(doc(db, "reports", id), {
      status: "completed",
      completion_date: serverTimestamp()
    });
     await addActivity(
      `تم إكمال البلاغ #${id.substring(0,5)} بواسطة المهندس ${engineerName}`,
      "complete",
      {
        reportId: id,
        targetUserId: engineerId,
        actorUserId: auth.currentUser?.uid || null,
      }
    );
    showToast(translateText("تم تغير حالة البلاغ إلى 'مكتمل'", "Report status changed to 'Completed'"), "complete");
  } catch (err) {
    showToast(translateText("فشل في عملية إكمال البلاغ", "Failed to complete report"), "error");
  }
};

/* ================= Event Listeners ================= */
btnAll?.addEventListener("click", () => {
  currentView = "all";
  btnAll.classList.add("active");
  btnMine?.classList.remove("active");
  applyFiltersAndSearch();
});

btnMine?.addEventListener("click", () => {
  currentView = "mine";
  btnMine.classList.add("active");
  btnAll?.classList.remove("active");
  applyFiltersAndSearch();
});

[
  searchInput,
  filterSeverity,
  filterLocation,
  filterStatus,
  filterDamageType,
  filterDateFrom,
  filterDateTo,
].forEach((el) => {
  el.addEventListener("input", applyFiltersAndSearch);
  el.addEventListener("change", applyFiltersAndSearch);
});

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
  currentView = "all";
  btnAll?.classList.add("active");
  btnMine?.classList.remove("active");
  applyFiltersAndSearch();
});

tableBody.addEventListener("click", async (e) => {
  const row = e.target.closest("tr");
  if (!row) return;

  const reportId = row.dataset.id;

  if (e.target.closest(".delete-btn")) {
    await deleteReport(reportId);
    return;
  }

  if (e.target.closest(".complete-btn")) {
    await completeReport(reportId);
    return;
  }

  if (e.target.closest(".revert-btn")) {
    const report = allReports.find((item) => item.id === reportId);
    const engineerId = report?.assigned_to || null;
    const engineerName = usersMap[engineerId]?.name || "المهندس";

    try {
      await updateDoc(doc(db, "reports", reportId), {
        status: "pending",
        assigned_to: null,
        assigned_at: null,
        completion_date: null,
        completed_at: null,
        completion_image: null
      });
      await addActivity(
  `تم إرجاع البلاغ #${reportId.substring(0,5)} إلى غير مكتمل بواسطة المهندس ${engineerName}`,
  "revert",
  {
    reportId,
    targetUserId: engineerId,
    actorUserId: auth.currentUser?.uid || null,
  }
);
      showToast(translateText("تم تغيير حالة البلاغ إلى 'غير مكتمل'", "Report status changed to 'Pending'"), "revert");
    } catch (err) {
      showToast(translateText("فشل في عملية تغيير حالة البلاغ", "Failed to change report status"), "error");
    }
    return;
  }

  if (e.target.closest(".assign-item")) {
    const el = e.target.closest(".assign-item");
    const engineerName = el.textContent.trim();
    try {
      await updateDoc(doc(db, "reports", el.dataset.report), {
        assigned_to: el.dataset.user,
        assigned_at: serverTimestamp(),
        status: "in_progress"
      });
      await addActivity(
        `تم إسناد البلاغ #${el.dataset.report.substring(0, 5)} إلى ${engineerName}`,
        "assign",
        {
          reportId: el.dataset.report,
          targetUserId: el.dataset.user,
          actorUserId: auth.currentUser?.uid || null,
        }
      );
      showToast(translateText(`تم إسناد البلاغ للمهندس ${engineerName}`, `Report assigned to engineer ${engineerName}`), "assign");
      el.closest(".assign-menu").classList.add("hidden");
    } catch (err) {
      showToast(translateText("فشل الإسناد", "Assignment failed"), "error");
    }
    return;
  }

  if (e.target.closest(".assign-toggle-btn")) {
    const dropdown = e.target.closest(".assign-dropdown").querySelector(".assign-menu");
    document.querySelectorAll(".assign-menu").forEach(m => {
      if (m !== dropdown) m.classList.add("hidden");
    });
    dropdown.classList.toggle("hidden");
    return;
  }

  const report = allReports.find(r => r.id === reportId);
  if (report) renderDetails(report);
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".assign-dropdown")) {
    document.querySelectorAll(".assign-menu").forEach(m => {
      m.classList.add("hidden");
    });
  }
});

/* ================= Initialization ================= */
onSnapshot(collection(db, "users"), (snapshot) => {
  usersMap = {};
  snapshot.docs.forEach(docSnap => {
    const data = docSnap.data();
    usersMap[docSnap.id] = {
      name: data.name || "-",
      role: data.role || "user"
    };
  });
});

onSnapshot(collection(db, "reports"), (snapshot) => {
  allReports = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
  applyTheme();
  applyFiltersAndSearch();
});

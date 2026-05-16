/* =================================================== IMPORTS =================================================== */
import { db, storage, auth } from "./firebase.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";
import { addActivity } from "./utils.js";

/* =================================================== CONSTANTS =================================================== */
const reportIdEl = document.getElementById("reportId");
const statusBadgeEl = document.getElementById("statusBadge");
const reportImageContainer = document.getElementById("reportImageContainer");
const completionImageEl = document.getElementById("completionImage");
const fileNameDisplay = document.getElementById("fileNameDisplay");
const notesEl = document.getElementById("notes");
const updateBtn = document.getElementById("updateBtn");
const smallUploadBtn = document.querySelector(".small-upload-btn");
const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");
const step3 = document.getElementById("step3");
const isEnglish = () => localStorage.getItem("language") === "en"; // Translation improvement added

const translateText = (ar, en) => { // Translation improvement added
  return isEnglish() ? en : ar;
};

/* =================================================== STATE/VARIABLES =================================================== */
const params = new URLSearchParams(window.location.search);
const reportId = params.get("id");
let loadedReport = null;

/* =================================================== HELPERS/UTILS =================================================== */
const showToast = (message, action = "complete") => {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const icons = {
    complete: "fa-check",
    error: "fa-triangle-exclamation"
  };
  const toast = document.createElement("div");
  toast.className = `toast ${action}`;
  toast.innerHTML = `
    <i class="fa-solid ${icons[action] || "fa-info"}"></i>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-10px)";
    setTimeout(() => toast.remove(), 300);
  }, 2000);
};

function updateStatusUI(status) {
  statusBadgeEl.classList.remove("completed", "progress", "pending");
  step1.classList.remove("active");
  step2.classList.remove("active");
  step3.classList.remove("active");
  step1.classList.add("active");
  step2.classList.add("active");
  switch (status) {
    case "completed":
      statusBadgeEl.textContent = translateText("مكتمل", "Completed"); // Translation improvement added
      statusBadgeEl.classList.add("completed");
      step3.classList.add("active");
      break;
    case "pending":
      statusBadgeEl.textContent = translateText("غير مكتمل", "Pending"); // Translation improvement added
      statusBadgeEl.classList.add("pending");
      break;
    case "in_progress":
      statusBadgeEl.textContent = translateText("قيد التنفيذ", "In Progress"); // Translation improvement added
      statusBadgeEl.classList.add("progress");
      break;
    default:
      statusBadgeEl.textContent = translateText("غير معروف", "Unknown"); // Translation improvement added
  }
}

function renderReportImage(imageUrl) {
  reportImageContainer.innerHTML = "";
  if (!imageUrl) {
    reportImageContainer.innerHTML = `<span class="placeholder-text">${translateText("لا توجد صورة لهذا البلاغ", "No photo is available for this report")}</span>`; // Translation improvement added
    return;
  }
  const img = document.createElement("img");
  img.src = imageUrl;
  img.alt = translateText("صورة البلاغ", "Report Photo"); // Translation improvement added
  img.onerror = () => {
    reportImageContainer.innerHTML = `<span class="placeholder-text">${translateText("تعذر تحميل الصورة", "Could not load the photo")}</span>`; // Translation improvement added
  };
  reportImageContainer.appendChild(img);
}

function lockForm() {
  updateBtn.disabled = true;
  completionImageEl.disabled = true;
  notesEl.disabled = true;
  if (smallUploadBtn) {
    smallUploadBtn.classList.add("disabled");
  }
  document.querySelectorAll('input[name="status"]').forEach((radio) => (radio.disabled = true));
}

async function getUserName(userId) {
  if (!userId) return translateText("المهندس", "Engineer"); // Translation improvement added

  try {
    const userSnap = await getDoc(doc(db, "users", userId));

    if (userSnap.exists()) {
      const user = userSnap.data();
      return user.name || user.displayName || user.email || translateText("المهندس", "Engineer"); // Translation improvement added
    }
  }
  catch (error) {
    console.error("User name lookup error:", error);
  }

  return auth.currentUser?.displayName || auth.currentUser?.email || translateText("المهندس", "Engineer"); // Translation improvement added
}

function getStatusActivity(status, displayId, engineerName) {
  switch (status) {
    case "in_progress":
      return {
        message: translateText(`تم إسناد البلاغ #${displayId} إلى المهندس ${engineerName}`, `Report #${displayId} has been assigned to engineer ${engineerName}`), // Translation improvement added
        type: "assign",
      };
    case "completed":
      return {
        message: translateText(`تم إكمال البلاغ #${displayId} بواسطة المهندس ${engineerName}`, `Report #${displayId} has been completed by engineer ${engineerName}`), // Translation improvement added
        type: "complete",
      };
    case "pending":
      return {
        message: translateText(`تم إرجاع البلاغ #${displayId} إلى غير مكتمل بواسطة المهندس ${engineerName}`, `Report #${displayId} has been reverted to pending by engineer ${engineerName}`), // Translation improvement added
        type: "revert",
      };
    default:
      return {
        message: translateText(`تم تحديث البلاغ #${displayId} بواسطة المهندس ${engineerName}`, `Report #${displayId} has been updated by engineer ${engineerName}`), // Translation improvement added
        type: "update",
      };
  }
}

/* =================================================== MAIN LOGIC =================================================== */
async function loadReport() {
  if (!reportId) {
    reportIdEl.textContent = translateText("لا يوجد رقم بلاغ", "No report ID"); // Translation improvement added
    lockForm();
    return;
  }
  try {
    const docRef = doc(db, "reports", reportId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      reportIdEl.textContent = translateText("البلاغ غير موجود", "Report not found"); // Translation improvement added
      lockForm();
      return;
    }
    const report = snap.data();
    loadedReport = report;
    const displayId = reportId.substring(0, 5);
    reportIdEl.textContent = `#${displayId}`;
    notesEl.value = report.notes || "";
    renderReportImage(report.image_url || "");
    if (report.completion_image) {
      fileNameDisplay.textContent = translateText("تم رفع صورة مسبقاً", "Image already uploaded"); // Translation improvement added
    }
    const currentStatus = report.status || "pending";
    updateStatusUI(currentStatus);
    if (currentStatus !== "in_progress") {
      lockForm();
      return;
    }
  } catch (error) {
    console.error("Load error:", error); // Translation improvement added
    reportIdEl.textContent = translateText("خطأ في تحميل البيانات", "Error loading data"); // Translation improvement added
    lockForm();
  }
}

/* =================================================== EVENT LISTENERS =================================================== */
completionImageEl.addEventListener("change", () => {
  const file = completionImageEl.files[0];
  fileNameDisplay.textContent = file ? file.name : translateText("لم يتم اختيار ملف", "No file selected"); // Translation improvement added
});

updateBtn.addEventListener("click", async () => {
  if (!reportId) {
    showToast(translateText("لا يوجد رقم بلاغ", "No report ID"), "error"); // Translation improvement added
    return;
  }
  const selectedStatus = document.querySelector('input[name="status"]:checked')?.value;
  const notes = notesEl.value.trim();
  const file = completionImageEl.files[0];
  if (!selectedStatus) {
    showToast(translateText("اختر الحالة", "Select status"), "error"); // Translation improvement added
    return;
  }
  if (selectedStatus === "completed" && !file) {
    showToast(
      translateText("يجب رفع صورة الإصلاح عند اكتمال البلاغ", "Upload a repair photo before marking the report as completed"), // Translation improvement added
      "error"
    );
    return;
  }
  updateBtn.disabled = true;
  updateBtn.textContent = translateText("جاري التحديث...", "Updating..."); // Translation improvement added
  try {
    const docRef = doc(db, "reports", reportId);
    const currentReportSnap = await getDoc(docRef);
    const currentReport = currentReportSnap.exists() ? currentReportSnap.data() : loadedReport;
    const engineerId = currentReport?.assigned_to || auth.currentUser?.uid || null;
    const engineerName = await getUserName(engineerId);
    const displayId = reportId.substring(0, 5);
    const activity = getStatusActivity(selectedStatus, displayId, engineerName);
    const updateData = {
      status: selectedStatus,
      notes,
      completion_date: selectedStatus === "completed" ? new Date().toISOString() : null,
    };
    if (file) {
      const storageRef = ref(storage, `reports/${reportId}/completion_${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      updateData.completion_image = downloadURL;
    }
    if (selectedStatus === "pending") {
      updateData.assigned_to = null;
      updateData.assigned_at = null;
    }
    await updateDoc(docRef, updateData);
    await addActivity(
      activity.message,
      activity.type,
      {
        reportId,
        targetUserId: engineerId,
      }
    );
    updateStatusUI(selectedStatus);
    if (selectedStatus !== "in_progress") {
      lockForm();
    }
    showToast(
      translateText("تم تحديث الحالة بنجاح", "Status updated successfully"), // Translation improvement added
      "complete"
    );
  } catch (error) {
    console.error("خطأ في التحديث:", error);
    showToast(
      translateText("حدث خطأ أثناء التحديث", "The update could not be saved"), // Translation improvement added
      "error"
    );
  } finally {
    updateBtn.disabled = false;
    updateBtn.textContent = translateText("تحديث الحالة", "Update Status"); // Translation improvement added
  }
  setTimeout(() => {
    window.location.href = "my_projects.html";
  }, 2500);
});

/* =================================================== INITIALIZATION =================================================== */
loadReport();

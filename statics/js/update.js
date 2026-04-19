import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/* ===============================
   Elements
=============================== */
const reportIdEl = document.getElementById("reportId");
const statusBadgeEl = document.getElementById("statusBadge");
const reportImageContainer = document.getElementById("reportImageContainer");
const completionImageEl = document.getElementById("completionImage");
const fileNameDisplay = document.getElementById("fileNameDisplay");
const notesEl = document.getElementById("notes");
const updateBtn = document.getElementById("updateBtn");
const smallUploadBtn = document.querySelector(".small-upload-btn");

/* Progress Steps */
const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");
const step3 = document.getElementById("step3");

/* ===============================
   URL Params
=============================== */
const params = new URLSearchParams(window.location.search);
const reportId = params.get("id");

/* ===============================
   Status UI
=============================== */
function updateStatusUI(status) {
  statusBadgeEl.classList.remove("completed", "progress", "pending");

  step1.classList.remove("active");
  step2.classList.remove("active");
  step3.classList.remove("active");

  // دائمًا البلاغ عند المهندس يبدأ من المرحلة الثانية
  step1.classList.add("active");
  step2.classList.add("active");

  switch (status) {
    case "completed":
      statusBadgeEl.textContent = "مكتمل";
      statusBadgeEl.classList.add("completed");
      step3.classList.add("active");
      break;

    case "pending":
      statusBadgeEl.textContent = "غير مكتمل";
      statusBadgeEl.classList.add("pending");
      break;

    case "in_progress":
      statusBadgeEl.textContent = "قيد التنفيذ";
      statusBadgeEl.classList.add("progress");
      break;

    default:
      statusBadgeEl.textContent = "غير معروف";
  }
}

/* ===============================
   Original Report Image
=============================== */
function renderReportImage(imageUrl) {
  reportImageContainer.innerHTML = "";

  if (!imageUrl) {
    reportImageContainer.innerHTML =
      '<span class="placeholder-text">لا توجد صورة لهذا البلاغ</span>';
    return;
  }

  const img = document.createElement("img");
  img.src = imageUrl;
  img.alt = "صورة البلاغ";

  img.onerror = () => {
    reportImageContainer.innerHTML =
      '<span class="placeholder-text">تعذر تحميل الصورة</span>';
  };

  reportImageContainer.appendChild(img);
}

/* ===============================
   Upload Label
=============================== */
completionImageEl.addEventListener("change", () => {
  const file = completionImageEl.files[0];
  fileNameDisplay.textContent = file ? file.name : "لم يتم اختيار ملف";
});

/* ===============================
   Lock UI
=============================== */
function lockForm() {
  updateBtn.disabled = true;
  completionImageEl.disabled = true;
  notesEl.disabled = true;

  if (smallUploadBtn) {
    smallUploadBtn.classList.add("disabled");
  }

  document
    .querySelectorAll('input[name="status"]')
    .forEach((radio) => (radio.disabled = true));
}

/* ===============================
   Load Report
=============================== */
async function loadReport() {
  if (!reportId) {
    reportIdEl.textContent = "لا يوجد رقم بلاغ";
    lockForm();
    return;
  }

  try {
    const docRef = doc(db, "reports", reportId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      reportIdEl.textContent = "البلاغ غير موجود";
      lockForm();
      return;
    }

    const report = snap.data();

    reportIdEl.textContent = `#${reportId.slice(-6)}`;
    notesEl.value = report.notes || "";

    renderReportImage(report.image_url || "");

    const currentStatus = report.status || "pending";
    updateStatusUI(currentStatus);

    // المهندس يدخل فقط على قيد التنفيذ
    if (currentStatus !== "in_progress") {
      lockForm();
      return;
    }
  } catch (error) {
    console.error("خطأ في تحميل البلاغ:", error);
    reportIdEl.textContent = "خطأ في تحميل البيانات";
    lockForm();
  }
}

/* ===============================
   Update Report
=============================== */
updateBtn.addEventListener("click", async () => {
  if (!reportId) {
    alert("لا يوجد رقم بلاغ");
    return;
  }

  const selectedStatus = document.querySelector(
    'input[name="status"]:checked'
  )?.value;

  const notes = notesEl.value.trim();

  if (!selectedStatus) {
    alert("اختر الحالة");
    return;
  }

  try {
    const docRef = doc(db, "reports", reportId);

    const updateData = {
      status: selectedStatus,
      notes,
      completion_date:
        selectedStatus === "completed" ? new Date().toISOString() : null,
    };

    // إذا صارت غير مكتمل، ينفك تعيين المهندس
    if (selectedStatus === "pending") {
      updateData.assigned_to = null;
    }

    await updateDoc(docRef, updateData);

    updateStatusUI(selectedStatus);
    alert("تم تحديث الحالة بنجاح ✅");
  } catch (error) {
    console.error("خطأ في التحديث:", error);
    alert("حدث خطأ أثناء التحديث");
  }
});

/* ===============================
   Init
=============================== */
loadReport();
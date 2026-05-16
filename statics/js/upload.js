// upload.js
import { auth } from "./firebase.js"; // تأكدي أن المسار صحيح
import { getSelectedLocation } from "./map.js";
import { addActivity, showToast } from "./utils.js";

// DOM elements
const fileInput = document.getElementById("fileInput");
const uploadLabel = document.querySelector(".file-upload-label");
const submitBtn = document.getElementById("submitBtn");
const streetInput = document.getElementById("streetName");
const latInput = document.getElementById("latitude");
const lngInput = document.getElementById("longitude");

// Translation helpers // Translation improvement added
const isEnglish = () => localStorage.getItem("language") === "en"; // Translation improvement added
const t = (ar, en) => isEnglish() ? en : ar; // Translation improvement added

// ------------------- Auth Check -------------------
auth.onAuthStateChanged((user) => {
  if (!user) {
    alert(t("❌ يجب تسجيل الدخول للرفع", "❌ You must login to upload")); // Translation improvement added
    submitBtn.disabled = true;
  } else {
    submitBtn.disabled = false;
  }
});

// ------------------- UI Helpers -------------------
function updateFileName(name, isSelected = true) { // Translation improvement added
  const p = document.getElementById("fileNameDisplay");
  if (!p) return;

  p.textContent = isSelected
    ? t(`ملف مختار: ${name}`, `Selected file: ${name}`)
    : name;
}

fileInput.addEventListener("change", () => {
  if (fileInput.files.length) {
    const file = fileInput.files[0];
    if (file.type.startsWith("image/")) {
      updateFileName(file.name);
    } else {
      alert(t("❌ عذراً، يُسمح برفع الصور فقط", "❌ Please upload an image file only")); // Translation improvement added
      fileInput.value = "";
    }
  }
});

// ------------------- Drag & Drop -------------------
uploadLabel.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadLabel.classList.add("dragging");
});

uploadLabel.addEventListener("dragleave", () => {
  uploadLabel.classList.remove("dragging");
});

uploadLabel.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadLabel.classList.remove("dragging");

  const files = e.dataTransfer.files;
  if (!files.length) return;

  const file = files[0];

  // Allow only images
  if (!file.type.startsWith("image/")) {
    showToast(
      t("❌ يُسمح برفع الصور فقط", "❌ Please upload an image file only"), // Translation improvement added
      "error"
    );
    return;
  }

  // Put dropped file into input
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  fileInput.files = dataTransfer.files;

  updateFileName(file.name);

  showToast(
    t("تم اختيار الصورة بنجاح", "Photo selected successfully"), // Translation improvement added
    "success"
  );
});

// ------------------- Submit Handler -------------------
submitBtn.addEventListener("click", async () => {
  const file = fileInput.files[0];
  const mapLocation = getSelectedLocation();
  const manualStreet = streetInput.value.trim();

  const fullAddress =
    mapLocation?.city &&
    mapLocation?.neighborhood &&
    mapLocation?.street
      ? `${mapLocation.city} - ${mapLocation.neighborhood} - ${mapLocation.street}`
      : manualStreet;

  const user = auth.currentUser;

  // 1. Validation
  if (!user) {
    showToast(
      t("يجب تسجيل الدخول", "Please log in first"), // Translation improvement added
      "error"
    );
    return;
  }

  if (!file) {
    showToast(
      t("اختر صورة أولاً", "Please select a photo first"), // Translation improvement added
      "error"
    );
    return;
  }

  const latitude =
    latInput.value
      ? parseFloat(latInput.value)
      : mapLocation?.lat;

  const longitude =
    lngInput.value
      ? parseFloat(lngInput.value)
      : mapLocation?.lng;

  if (latitude == null || longitude == null) {
    showToast(
      t("اختر الموقع أو أدخل الإحداثيات", "Select location or enter coordinates"), // Translation improvement added
      "error"
    );
    return;
  }

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = t("⏳ جاري التحليل والرفع...", "⏳ Uploading..."); // Translation improvement added

    // Prepare Form Data
    const formData = new FormData();
    formData.append("image", file);
    formData.append("latitude", latitude);
    formData.append("longitude", longitude);
    formData.append("street_name", fullAddress);
    formData.append("created_by", user.uid);

    // API Call
    const response = await fetch(
      "https://assas-backend-o9r8.onrender.com/upload-image",
      {
        method: "POST",
        body: formData
      }
    );

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      await addActivity(
        t("تم رفع بلاغ جديد", "A new report has been uploaded"), // Translation improvement added
        "upload",
        { reportId: result.reportId || result.id || null }
      );

      showToast(
        t("تم تحليل الصورة وحفظ البلاغ بنجاح", "Report analyzed and saved successfully!"), // Translation improvement added
        "upload"
      );

      console.log("AI Result:", result.analysis);

      // Reset form
      fileInput.value = "";
      streetInput.value = "";
      latInput.value = "";
      lngInput.value = "";
      updateFileName(t("اسحب الملف هنا", "Drag a photo here"), false); // Translation improvement added
    } else {
      showToast(
        t("خطأ من السيرفر: ", "Server error: ") + (result.error || ""), // Translation improvement added
        "error"
      );
    }
  } catch (error) {
    console.error("Upload Error:", error);
    showToast(
      t("فشل الاتصال بسيرفر الذكاء الاصطناعي", "Failed to connect to the AI server"), // Translation improvement added
      "error"
    );
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = t("إرسال البلاغ", "Submit Report"); // Translation improvement added
  }
});

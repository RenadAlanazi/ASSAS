/* ================= Imports ================= */
import { auth } from "../js/firebase.js";
import {
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

/* ================= Language Helpers ================= */
function getLang() {
  return localStorage.getItem("language") || "ar";
}

function translateText(ar, en) {
  return getLang() === "en" ? en : ar;
}

function translateDynamicValue(value) {
  if (getLang() !== "en") return value;

  const map = {
    "نشط": "Active",
    "إدارة البلاغات": "Reports Management",
    "موظف ميداني": "Field Employee",
    "تحديث الصورة الشخصية": "Updated profile picture",
    "لا يوجد نشاط قريب": "No recent activity",
    "موظف": "Employee",
    "مهندس": "Engineer",
  };

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

/* ================= Profile Loading ================= */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../templates/login.html";
    return;
  }

  const cachedUser = localStorage.getItem('user');
  let localData = cachedUser ? JSON.parse(cachedUser) : null;

  if (localData) {
    fillProfileData(localData);
  }

  try {
    const token = await user.getIdToken();
    const response = await fetch(
      "https://assas-backend-o9r8.onrender.com/profile",
      {
        headers: { Authorization: "Bearer " + token },
      }
    );

    if (response.ok) {
      const serverData = await response.json();

      if (
        !serverData.profile_image &&
        localData &&
        localData.profile_image
      ) {
        serverData.profile_image = localData.profile_image;
      }

      localStorage.setItem("user", JSON.stringify(serverData));

      if (JSON.stringify(serverData) !== JSON.stringify(localData)) {
        fillProfileData(serverData);
      }
    }
  } catch (error) {
    console.error("خطأ في جلب البيانات من السيرفر:", error);
  }
});

/* ================= Profile Rendering ================= */
function fillProfileData(data) {
  if (!data) return;

  const safeUpdateText = (id, newText) => {
    const element = document.getElementById(id);
    const textValue = String(newText || "");
    if (element && element.innerText !== textValue) {
      element.innerText = textValue;
    }
  };

  /* Role data is normalized before rendering translated labels. */
  const rawRole = String(data.role || "").toLowerCase().trim();
  const isEmployee = rawRole === "employee";

  safeUpdateText("name", data.name);
  safeUpdateText("employee_id", data.employee_id);

  safeUpdateText(
    "role",
    translateText(isEmployee ? "موظف" : "مهندس", isEmployee ? "Employee" : "Engineer")
  );

  const taskLabel = document.getElementById("task_label");
  if (taskLabel) {
    const expectedLabel = isEmployee
      ? translateText("عدد البلاغات المرفوعة", "Uploaded Reports")
      : translateText("عدد البلاغات المستلمة", "Received Reports");
    if (taskLabel.innerText !== expectedLabel) {
      taskLabel.innerText = expectedLabel;
    }
  }

  safeUpdateText("phone", data.phone);
  safeUpdateText("email", data.email);

  safeUpdateText(
    "department",
    translateDynamicValue(data.department || "إدارة البلاغات")
  );
  safeUpdateText(
    "role_display",
    translateDynamicValue(data.role_display || "موظف ميداني")
  );
  safeUpdateText(
    "status",
    translateDynamicValue(data.status || "نشط")
  );
  safeUpdateText("joined_date", data.joined_date);

  /* The profile image is updated only when the resolved source changes. */
  const profileImg = document.getElementById("profile_img");
  const userName = data.name || "User";
  let targetSrc = "";

  if (data.profile_image && data.profile_image.startsWith("http")) {
    targetSrc = data.profile_image;
  } else {
    const firstChar = userName.trim().charAt(0);
    targetSrc = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      firstChar
    )}&background=145b44&color=fff&size=128&length=1`;
  }

  if (profileImg && profileImg.getAttribute("src") !== targetSrc) {
    profileImg.src = targetSrc;
  }

  safeUpdateText("total_reports", data.total_reports ?? 0);
  safeUpdateText("reports_in_progress", data.reports_in_progress ?? 0);
  safeUpdateText("completed_reports", data.completed_reports ?? 0);
  safeUpdateText(
    "last_activity",
    translateDynamicValue(data.last_activity || "لا يوجد نشاط قريب")
  );
}

/* ================= Profile Image Upload ================= */
const imageInput = document.getElementById("imageInput");
const profileImgMain = document.getElementById("profile_img");
const saveBtn = document.getElementById("save_image_btn");

imageInput.addEventListener("change", function () {
  const file = this.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      profileImgMain.src = e.target.result;
      saveBtn.style.display = "block";
    };
    reader.readAsDataURL(file);
  }
});

saveBtn.addEventListener("click", async () => {
  const file = imageInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("profile_image", file);

  try {
    saveBtn.disabled = true;
    saveBtn.textContent = translateText("⏳ جاري الحفظ...", "⏳ Uploading...");

    const user = auth.currentUser;
    if (!user) {
      alert(translateText("❌ انتهت الجلسة، يرجى تسجيل الدخول", "❌ Session expired, please log in"));
      return;
    }
    const token = await user.getIdToken();

    const response = await fetch(
      "https://assas-backend-o9r8.onrender.com/update-profile-image",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      }
    );

    const result = await response.json();

    if (result.success) {
      alert(translateText("✅ تم حفظ الصورة وتثبيتها بنجاح", "✅ Profile image saved successfully"));

      let currentUserData = JSON.parse(localStorage.getItem("user") || "{}");
      currentUserData.profile_image = result.image_url;
      localStorage.setItem("user", JSON.stringify(currentUserData));

      profileImgMain.src = result.image_url;
      saveBtn.style.display = "none";
    } else {
      alert(
        translateText("❌ فشل الحفظ: ", "❌ Save failed: ") + result.error
      );
    }
  } catch (error) {
    console.error("Upload error:", error);
    alert(translateText("❌ حدث خطأ في الاتصال بالسيرفر", "❌ Server connection error"));
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = translateText("حفظ الصورة", "Save Image");
  }
});

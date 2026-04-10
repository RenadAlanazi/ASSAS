import { auth } from "../js/firebase.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

/* 1. التحقق من المستخدم وجلب البيانات */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../templates/login.html";
    return;
  }

  // تحميل سريع من الكاش (Local Storage) أول ما تفتح الصفحة
  const cachedUser = localStorage.getItem('user');
  if (cachedUser) {
    fillProfileData(JSON.parse(cachedUser));
  }

  try {
    const token = await user.getIdToken();
    const response = await fetch("https://assas-backend-o9r8.onrender.com/profile", {
      headers: { Authorization: "Bearer " + token }
    });

    if (response.ok) {
      const data = await response.json();
      fillProfileData(data); // تحديث الصفحة بالبيانات الجديدة
      localStorage.setItem('user', JSON.stringify(data)); // حفظ لللمرة الجاية
    }
  } catch (error) {
    console.error("خطأ في جلب البيانات:", error);
  }
});

/* 2. دالة تعبئة البيانات (معدلة حسب الـ HTML حقك بالضبط) */
function fillProfileData(data) {
  if (!data) return;

  // الجزء العلوي (الاسم والـ ID والرتبة)
  document.getElementById("name").innerText = data.name || "أحمد علي";
  document.getElementById("employee_id").innerText = data.employee_id || "ID-0000";
  document.getElementById("role").innerText = data.role === "employee" ? "موظف" : (data.role || "");

  // التواصل
  document.getElementById("phone").innerText = data.phone || "";
  document.getElementById("email").innerText = data.email || "";

  // --- معلومات العمل  ---
  
  // القسم: ياخذ من مفتاح department في السيرفر
  document.getElementById("department").innerText = data.department || "إدارة البلاغات";

  // الدور الوظيفي: هنا بنحط فيه "إدارة البلاغات" أو أي مسمى ثاني تبيه
  document.getElementById("role_display").innerText = data.role_display || "موظف ميداني";

  // حالة الحساب والتاريخ
  document.getElementById("status").innerText = data.status || "نشط";
  document.getElementById("joined_date").innerText = data.joined_date || "";

  // --- ملخص النشاط ---
  document.getElementById("total_reports").innerText = data.total_reports ?? 0;
  document.getElementById("reports_in_progress").innerText = data.reports_in_progress ?? 0;
  document.getElementById("completed_reports").innerText = data.completed_reports ?? 0;
  document.getElementById("last_activity").innerText = data.last_activity || "لا يوجد نشاط قريب";

}

/* --- دالة تسجيل الخروج --- */
const logoutUser = () => {
    signOut(auth).then(() => {
        // مسح بيانات الجلسة من المتصفح
        localStorage.removeItem('user');
        console.log("تم تسجيل الخروج بنجاح");
        // التوجه لصفحة تسجيل الدخول
        window.location.href = "index.html?logout=success";
    }).catch((error) => {
        console.error("خطأ أثناء تسجيل الخروج:", error);
        alert("حدث خطأ أثناء محاولة تسجيل الخروج");
    });
};

/* --- ربط الزر بالحدث (Event Listener) --- */
// نستخدم هذه الطريقة لضمان أن الزر سيعمل حتى لو ضغطتِ على الأيقونة التي بداخله
document.addEventListener("click", (e) => {
    const btn = e.target.closest(".logout-btn");
    if (btn) {
        e.preventDefault();
        console.log("تم الضغط على زر تسجيل الخروج");
        logoutUser();
    }
});

/* 4. زر الرجوع */
window.goBack = function () {
  window.history.back();
};
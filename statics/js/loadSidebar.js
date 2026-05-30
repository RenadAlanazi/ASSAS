/* ================= Imports ================= */
import { auth } from "../js/firebase.js";
import { signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

/* ================= Sidebar Rendering ================= */
async function initializeSidebar() {
  const container = document.getElementById("sidebar-container");
  if (!container) return;

  try {
    const response = await fetch("sidebar.html");
    container.innerHTML = await response.text();

    const userData = JSON.parse(localStorage.getItem("user"));
    const role = userData ? userData.role : "employee";

    const nav = document.getElementById("dynamic-nav");
    const menuItems = {
      employee: [
        { text: "لوحة التحكم", textEn: "Dashboard", icon: "fa-chart-line", href: "emp_dashboard.html" },
        { text: "رفع بلاغ", textEn: "Upload Report", icon: "fa-camera", href: "upload.html" },
        { text: "المشاريع", textEn: "Projects", icon: "fa-folder-open", href: "projects.html" },
        { text: "الصفحة الشخصية", textEn: "Profile", icon: "fa-user", href: "profile.html" },
      ],
      engineer: [
        { text: "لوحة التحكم", textEn: "Dashboard", icon: "fa-gauge-high", href: "eng_dashboard.html" },
        { text: "مشاريعي", textEn: "My Projects", icon: "fa-list-check", href: "my_projects.html" },
        { text: "تحديث البلاغ", textEn: "Update Report", icon: "fa-pen-to-square", href: "update.html" },
        { text: "الصفحة الشخصية", textEn: "Profile", icon: "fa-user", href: "profile.html" },
      ],
    };

    const currentLinks = menuItems[role] || menuItems.employee;

    currentLinks.forEach((item) => {
      const li = document.createElement("li");
      if (window.location.pathname.includes(item.href)) {
        li.className = "active";
      }

      li.innerHTML = `<a href="${item.href}" data-ar="${item.text}" data-en="${item.textEn}"><i class="fa-solid ${item.icon}"></i> ${item.text}</a>`;
      nav.appendChild(li);
    });

    if (typeof window.applyLanguage === "function") {
      window.applyLanguage();
    }

    setupLogoutListener();
  } catch (error) {
    console.error("خطأ في تحميل السايد بار:", error);
  }
}

/* ================= Logout Handling ================= */
function setupLogoutListener() {
  document.removeEventListener("click", handleLogoutClick);
  document.addEventListener("click", handleLogoutClick);
}

function handleLogoutClick(e) {
  const btn = e.target.closest(".logout-btn");
  if (btn) {
    e.preventDefault();
    console.log("جاري محاولة تسجيل الخروج...");

    signOut(auth)
      .then(() => {
        localStorage.clear();
        console.log("تم تسجيل الخروج بنجاح");
        window.location.replace("index.html?logout=success");
      })
      .catch((error) => {
        console.error("خطأ Firebase:", error);
        alert("فشل تسجيل الخروج: " + error.message);
      });
  }
}

/* ================= Initialization ================= */
document.addEventListener("DOMContentLoaded", initializeSidebar);

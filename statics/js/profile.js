import { auth } from "../js/firebase.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

/* Check user */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../templates/login.html";
    return;
  }

  try {
    const token = await user.getIdToken();

    const response = await fetch(
      "https://assas-backend-o9r8.onrender.com/profile",
      {
        headers: {
          Authorization: "Bearer " + token,
        },
      }
    );

    if (!response.ok) {
      throw new Error("فشل تحميل البيانات");
    }

    const data = await response.json();

    /* Fill data */
 document.getElementById("employee_id").innerText = data.employee_id || "";
document.getElementById("role_display").innerText = data.role_display || "";
document.getElementById("status").innerText = data.status || "";
document.getElementById("joined_date").innerText = data.joined_date || "";

document.getElementById("total_reports").innerText = data.total_reports || 0;
document.getElementById("reports_in_progress").innerText = data.reports_in_progress || 0;
document.getElementById("completed_reports").innerText = data.completed_reports || 0;
document.getElementById("last_activity").innerText = data.last_activity || "";

  } catch (error) {
    console.error("Profile error:", error);
  }
});

/* Logout */
document.querySelector(".logout-btn").addEventListener("click", () => {
  signOut(auth).then(() => {
    window.location.href = "../templates/login.html";
  });
});

/* Back */
window.goBack = function () {
  window.history.back();
};
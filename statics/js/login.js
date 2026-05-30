/* ================= Imports ================= */
import { auth } from "../js/firebase.js";
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

/* ================= Language Helpers ================= */
const isEnglish = () => localStorage.getItem("language") === "en";

/* ================= Login Flow ================= */
window.handleLogin = async function (e) {
  e.preventDefault();

  const email = document.querySelector('[name="email"]').value;
  const password = document.querySelector('[name="password"]').value;

  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    const token = await userCredential.user.getIdToken();

    localStorage.setItem("token", token);
    
    const response = await fetch(
      "https://assas-backend-o9r8.onrender.com/profile",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(isEnglish() ? "Failed to verify user on server" : "فشل التحقق من المستخدم في السيرفر");
    }

    const data = await response.json();
    const currentPath = window.location.pathname;


    if (data.role === "engineer") {
      if (currentPath.includes("emp_login")) {
        alert(isEnglish() 
          ? "This account is registered as an engineer. Please login from the engineer page." 
          : "هذا الحساب مسجل كمهندس. يرجى تسجيل الدخول من صفحة المهندسين.");
        await signOut(auth);
        return;
      }

      localStorage.setItem("user", JSON.stringify(data));
      window.location.href = "../templates/eng_dashboard.html";

    } else if (data.role === "employee") {
      if (currentPath.includes("eng_login")) {
        alert(isEnglish() 
          ? "This account is registered as an employee. Please login from the employee page." 
          : "هذا الحساب مسجل كموظف. يرجى تسجيل الدخول من صفحة الموظفين.");
        await signOut(auth);
        return;
      }

      localStorage.setItem("user", JSON.stringify(data));
      window.location.href = "../templates/emp_dashboard.html";

    } else {
      alert(isEnglish() ? "Unknown user type in the system" : "نوع المستخدم غير معروف في النظام");
      await signOut(auth);
    }

  } catch (error) {
    console.error("Login Error:", error);
    if (error.code === "auth/wrong-password" || error.code === "auth/user-not-found") {
      alert(isEnglish() ? "Invalid email or password" : "البريد الإلكتروني أو كلمة المرور غير صحيحة");
    } else {
      alert(isEnglish() ? "An error occurred during login, please try again" : "حدث خطأ أثناء تسجيل الدخول، يرجى المحاولة مرة أخرى");
    }
  }
};

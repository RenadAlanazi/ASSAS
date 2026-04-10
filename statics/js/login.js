import { auth } from "../js/firebase.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";


/* Handle Login*/
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

    /* Send token to Flask */
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
      throw new Error("فشل التحقق من المستخدم");
    }

    const data = await response.json();

    // 🔥  : حفظ بيانات المستخدم في ذاكرة المتصفح
    // نحفظ الكائن 'data' الذي يحتوي على الاسم، الدور، والإيميل القادم من Flask
    localStorage.setItem("user", JSON.stringify(data));

  

    /* 🔥 Role-based redirect */
    if (data.role === "engineer") {
      window.location.href = "../templates/eng_dashboard.html";
    } else if (data.role === "employee") {
      window.location.href = "../templates/emp_dashboard.html";
    } else {
      alert("نوع المستخدم غير معروف");
    }
  } catch (error) {
    if (error.message.includes("auth")) {
      alert("البريد الإلكتروني أو كلمة المرور غير صحيحة");
    } else {
      alert("حدث خطأ، حاول مرة أخرى");
    }
  }
};

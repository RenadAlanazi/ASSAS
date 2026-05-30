const toastContainer = document.getElementById("toastContainer");

/* ================= Toast Messages ================= */
function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  toast.innerHTML = `
    <i class="fa-solid ${
      type === "success"
        ? "fa-check"
        : "fa-triangle-exclamation"
    }"></i>

    <span>${message}</span>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

/* ================= Reset Code Request ================= */
const emailInput = document.getElementById("email");
const sendCodeBtn = document.getElementById("sendCodeBtn");

if (sendCodeBtn) {
  sendCodeBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();

    if (!email) {
      showToast("الرجاء إدخال البريد الإلكتروني", "error");
      return;
    }

    try {
      sendCodeBtn.disabled = true;
      sendCodeBtn.textContent = "جاري الإرسال...";

      const response = await fetch(
        "https://assas-backend-o9r8.onrender.com/auth/send-reset-code",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "تعذر إرسال الكود");
      }

      localStorage.setItem("reset_email", email);

      showToast("تم إرسال الكود إلى بريدك الإلكتروني", "success");

      setTimeout(() => {
        window.location.href = "verify_code.html";
      }, 1000);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      sendCodeBtn.disabled = false;
      sendCodeBtn.textContent = "إرسال الكود";
    }
  });
}

/* ================= Code Verification ================= */
const codeInput = document.getElementById("code");
const verifyCodeBtn = document.getElementById("verifyCodeBtn");

if (verifyCodeBtn) {
  verifyCodeBtn.addEventListener("click", async () => {
    const email = localStorage.getItem("reset_email");
    const code = codeInput.value.trim();

    if (!email) {
      showToast("الرجاء إدخال البريد الإلكتروني أولاً", "error");

      setTimeout(() => {
        window.location.href = "forgot_password.html";
      }, 1000);

      return;
    }

    if (!code) {
      showToast("الرجاء إدخال كود التحقق", "error");
      return;
    }

    try {
      verifyCodeBtn.disabled = true;
      verifyCodeBtn.textContent = "جاري التحقق...";

      const response = await fetch(
        "https://assas-backend-o9r8.onrender.com/auth/verify-reset-code",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            code,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "كود التحقق غير صحيح");
      }

      localStorage.setItem("reset_code", code);

      showToast("تم التحقق من الكود", "success");

      setTimeout(() => {
        window.location.href = "reset_password.html";
      }, 1000);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      verifyCodeBtn.disabled = false;
      verifyCodeBtn.textContent = "تحقق";
    }
  });
}

/* ================= Password Update ================= */

const newPassword = document.getElementById("newPassword");
const confirmPassword = document.getElementById("confirmPassword");
const resetPasswordBtn = document.getElementById("resetPasswordBtn");

if (resetPasswordBtn) {
  resetPasswordBtn.addEventListener("click", async () => {
    const email = localStorage.getItem("reset_email");
    const code = localStorage.getItem("reset_code");
    const password = newPassword.value.trim();
    const confirm = confirmPassword.value.trim();

    if (!email || !code) {
      showToast(
        "انتهت جلسة إعادة التعيين، الرجاء البدء من جديد",
        "error"
      );

      setTimeout(() => {
        window.location.href = "forgot_password.html";
      }, 1000);

      return;
    }

    if (!password || !confirm) {
      showToast("الرجاء تعبئة جميع الحقول", "error");
      return;
    }

    if (password.length < 6) {
      showToast(
        "كلمة المرور يجب أن تكون 6 خانات على الأقل",
        "error"
      );

      return;
    }

    if (password !== confirm) {
      showToast("كلمة المرور غير متطابقة", "error");
      return;
    }

    try {
      resetPasswordBtn.disabled = true;
      resetPasswordBtn.textContent = "جاري التحديث...";

      const response = await fetch(
        "https://assas-backend-o9r8.onrender.com/auth/reset-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            code,
            new_password: password,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "تعذر تحديث كلمة المرور"
        );
      }

      localStorage.removeItem("reset_email");
      localStorage.removeItem("reset_code");

      showToast(
        "تم تحديث كلمة المرور بنجاح",
        "success"
      );

      setTimeout(() => {
        window.location.href = "eng_login.html";
      }, 1500);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      resetPasswordBtn.disabled = false;
      resetPasswordBtn.textContent = "تحديث كلمة المرور";
    }
  });
}

import { auth } from "../js/firebase.js";
import {
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

/* 1. التحقق من المستخدم وجلب البيانات */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../templates/login.html";
    return;
  }

  // أ. تحميل فوري من الذاكرة المحلية (LocalStorage) لسرعة الاستجابة
  const cachedUser = localStorage.getItem('user');
  let localData = cachedUser ? JSON.parse(cachedUser) : null;

  if (localData) {
    fillProfileData(localData);
  }

  try {
    const token = await user.getIdToken();
    const response = await fetch("https://assas-backend-o9r8.onrender.com/profile", {
      headers: { Authorization: "Bearer " + token }
    });

    if (response.ok) {
      const serverData = await response.json();
      
      // ج. حماية الصورة: إذا السيرفر لم يرسل رابطاً بعد، نتمسك بما لدينا في الكاش
      if (!serverData.profile_image && localData && localData.profile_image) {
          serverData.profile_image = localData.profile_image;
      }

      // د. تحديث الذاكرة المحلية بالبيانات "المعربة والذكية" القادمة من الباكند الجديد
      localStorage.setItem('user', JSON.stringify(serverData));
      
      // هـ. التحديث الذكي: المقارنة تمنع الومضة (Flickering) عند تحميل البيانات الحية
      if (JSON.stringify(serverData) !== JSON.stringify(localData)) {
          fillProfileData(serverData); 
      }
    }
  } catch (error) {
    console.error("خطأ في جلب البيانات من السيرفر:", error);
  }
});

/* 2. دالة تعبئة البيانات (النسخة النهائية المستقرة) */
function fillProfileData(data) {
  if (!data) return;

  const safeUpdateText = (id, newText) => {
    const element = document.getElementById(id);
    const textValue = String(newText || "");
    if (element && element.innerText !== textValue) {
      element.innerText = textValue;
    }
  };

  // --- منطق الرتبة (لضمان المزامنة بين حساب الموظف والمهندس) ---
  const rawRole = String(data.role || "").toLowerCase().trim();
  const isEmployee = rawRole === "employee";

  safeUpdateText("name", data.name);
  safeUpdateText("employee_id", data.employee_id);
  
  // تحديث الرتبة العلوية
  safeUpdateText("role", isEmployee ? "موظف" : "مهندس");

  // تحديث تسمية الإحصائيات بناءً على الرتبة (مرفوعة للموظف / مستلمة للمهندس)
  const taskLabel = document.getElementById("task_label");
  if (taskLabel) {
    const expectedLabel = isEmployee ? "عدد البلاغات المرفوعة" : "عدد البلاغات المستلمة";
    if (taskLabel.innerText !== expectedLabel) {
      taskLabel.innerText = expectedLabel;
    }
  }

  safeUpdateText("phone", data.phone);
  safeUpdateText("email", data.email);
  
  // البيانات التالية تأتي الآن "جاهزة ومعربة" من الباكند الجديد (مثلMaintenance -> قسم الصيانة)
  safeUpdateText("department", data.department);
  safeUpdateText("role_display", data.role_display);
  safeUpdateText("status", data.status);
  safeUpdateText("joined_date", data.joined_date);

  // --- إدارة الصورة وحل مشكلة الحروف العربية (ثبات فوري) ---
  const profileImg = document.getElementById("profile_img");
  const userName = data.name || "User";
  let targetSrc = "";

  if (data.profile_image && data.profile_image.startsWith('http')) {
      targetSrc = data.profile_image;
  } else {
      // استخراج أول حرف يدوياً لضمان ظهوره عربياً فوراً وبدون تبديل من الإنجليزية
      const firstChar = userName.trim().charAt(0);
      targetSrc = `https://ui-avatars.com/api/?name=${encodeURIComponent(firstChar)}&background=145b44&color=fff&size=128&length=1`;
  }

  // تحديث الصورة فقط إذا تغير الرابط فعلاً لمنع Shifting
  if (profileImg && profileImg.getAttribute('src') !== targetSrc) {
      profileImg.src = targetSrc;
  }

  safeUpdateText("total_reports", data.total_reports ?? 0);
  safeUpdateText("reports_in_progress", data.reports_in_progress ?? 0);
  safeUpdateText("completed_reports", data.completed_reports ?? 0);
  safeUpdateText("last_activity", data.last_activity);
}

/* 3. منطق رفع وحفظ الصورة الشخصية */
const imageInput = document.getElementById('imageInput');
const profileImgMain = document.getElementById('profile_img'); 
const saveBtn = document.getElementById('save_image_btn');

imageInput.addEventListener('change', function() {
    const file = this.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            profileImgMain.src = e.target.result;
            saveBtn.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
});

saveBtn.addEventListener('click', async () => {
    const file = imageInput.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('profile_image', file);

    try {
        saveBtn.disabled = true;
        saveBtn.textContent = "⏳ جاري الحفظ...";
        
        const user = auth.currentUser;
        if (!user) {
            alert("❌ انتهت الجلسة، يرجى تسجيل الدخول");
            return;
        }
        const token = await user.getIdToken(); 

        const response = await fetch('https://assas-backend-o9r8.onrender.com/update-profile-image', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            alert("✅ تم حفظ الصورة وتثبيتها بنجاح");
            
            let currentUserData = JSON.parse(localStorage.getItem('user') || '{}');
            currentUserData.profile_image = result.image_url;
            localStorage.setItem('user', JSON.stringify(currentUserData));
            
            profileImgMain.src = result.image_url;
            saveBtn.style.display = 'none';
        } else {
            alert("❌ فشل الحفظ: " + result.error);
        }
    } catch (error) {
        console.error("Upload error:", error);
        alert("❌ حدث خطأ في الاتصال بالسيرفر");
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "حفظ الصورة";
    }
});
function applyDarkMode() {
  const savedTheme = localStorage.getItem("theme");
  const darkSwitch = document.getElementById("darkModeSwitch");

  if (savedTheme === "dark") {
    document.body.classList.add("dark");
    if (darkSwitch) darkSwitch.checked = true;
  } else {
    document.body.classList.remove("dark");
    if (darkSwitch) darkSwitch.checked = false;
  }
}

window.applyLanguage = function () {
  const lang = localStorage.getItem("language") || "ar";

  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "en" ? "ltr" : "rtl";

  if (lang === "en") {
    document.body.classList.add("english-mode");
  } else {
    document.body.classList.remove("english-mode");
  }

  const languageSwitch = document.getElementById("languageSwitch");

  if (languageSwitch) {
    languageSwitch.checked = lang === "en";
  }

  document.querySelectorAll("[data-ar]").forEach((el) => {
    if (el.querySelector("i")) {
      const text =
        lang === "ar"
          ? el.dataset.ar
          : el.dataset.en;

      const icon = el.querySelector("i");

      el.innerHTML = `${icon.outerHTML} ${text}`;

    } else {
      el.innerHTML =
        lang === "ar"
          ? el.dataset.ar
          : el.dataset.en;
    }
  });

  document.querySelectorAll("[data-placeholder-ar]").forEach((el) => {
    el.placeholder =
      lang === "ar"
        ? el.dataset.placeholderAr
        : el.dataset.placeholderEn;
  });

  document.querySelectorAll("[data-icon-ar][data-icon-en]").forEach((el) => {
    const icon = el.querySelector("i");

    if (icon) {
      icon.className =
        lang === "ar"
          ? el.dataset.iconAr
          : el.dataset.iconEn;
    }
  });
};

window.toggleLanguage = function () {
  const currentLang =
    localStorage.getItem("language") || "ar";

  const newLang =
    currentLang === "ar" ? "en" : "ar";

  localStorage.setItem(
    "language",
    newLang
  );

  window.applyLanguage();

  setTimeout(() => {
    window.location.reload();
  }, 100);
};

window.toggleDarkMode = function () {
  const isDark =
    document.body.classList.toggle("dark");

  localStorage.setItem(
    "theme",
    isDark ? "dark" : "light"
  );

  location.reload();
};

document.addEventListener("DOMContentLoaded", () => {
  applyDarkMode();
  window.applyLanguage();

  document.addEventListener("click", (e) => {
    if (e.target.closest(".language-toggle")) {
      window.toggleLanguage();
    }
  });
});

(() => {
  const THEME_KEY = "jobTrackerTheme";
  const systemPreference = window.matchMedia("(prefers-color-scheme: dark)");

  function getStoredTheme() {
    try {
      const storedTheme = localStorage.getItem(THEME_KEY);
      return storedTheme === "light" || storedTheme === "dark" ? storedTheme : null;
    } catch (_error) {
      return null;
    }
  }

  function applyTheme(theme) {
    const isDark = theme === "dark";
    document.documentElement.dataset.theme = theme;

    const toggle = document.getElementById("theme-toggle");
    if (toggle) {
      toggle.setAttribute("aria-pressed", String(isDark));
      toggle.textContent = `dark mode: ${isDark ? "on" : "off"}`;
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (_error) {
      // The selected theme still applies for the current page when storage is unavailable.
    }
  }

  applyTheme(getStoredTheme() || (systemPreference.matches ? "dark" : "light"));

  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(document.documentElement.dataset.theme);

    document.getElementById("theme-toggle")?.addEventListener("click", () => {
      const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(nextTheme);
      saveTheme(nextTheme);
    });
  });

  systemPreference.addEventListener("change", (event) => {
    if (!getStoredTheme()) {
      applyTheme(event.matches ? "dark" : "light");
    }
  });

  window.addEventListener("storage", (event) => {
    if (event.key === THEME_KEY && (event.newValue === "light" || event.newValue === "dark")) {
      applyTheme(event.newValue);
    }
  });
})();

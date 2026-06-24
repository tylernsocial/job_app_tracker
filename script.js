const STORAGE_KEY = "jobApplications";

const form = document.getElementById("job-form");
const jobList = document.getElementById("job-list");
const formError = document.getElementById("form-error");

let applications = loadApplications();
renderApplications();

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const application = {
    id: crypto.randomUUID(),
    company: String(formData.get("company") || "").trim(),
    role: String(formData.get("role") || "").trim(),
    appliedDate: String(formData.get("appliedDate") || "").trim(),
    status: String(formData.get("status") || "Applied"),
  };

  if (!application.company || !application.role || !application.appliedDate) {
    formError.textContent = "Please fill in company, role, and applied date.";
    return;
  }

  formError.textContent = "";
  applications.unshift(application);
  saveApplications();
  renderApplications();
  form.reset();
});

jobList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const id = target.dataset.id;
  if (!id) {
    return;
  }

  applications = applications.filter((application) => application.id !== id);
  saveApplications();
  renderApplications();
});

function renderApplications() {
  if (applications.length === 0) {
    jobList.innerHTML = "<li>No applications yet.</li>";
    return;
  }

  jobList.innerHTML = applications
    .map(
      (application) => `
      <li class="job-item">
        <strong>${escapeHTML(application.company)}</strong> — ${escapeHTML(application.role)}
        <div class="job-meta">Applied: ${escapeHTML(application.appliedDate)} · Status: ${escapeHTML(application.status)}</div>
        <button class="delete-btn" data-id="${application.id}" type="button" aria-label="Delete application for ${escapeHTML(application.company)}">Delete</button>
      </li>
    `
    )
    .join("");
}

function loadApplications() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function saveApplications() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
}

function escapeHTML(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

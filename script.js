const STORAGE_KEY = "jobApplications";
const STATUS_ORDER = ["Applied", "Interviewing", "Accepted", "Rejected"];
const STATUS_META = {
  Applied: { label: "Applied", className: "status-applied" },
  Interviewing: { label: "Interviewing", className: "status-interviewing" },
  Accepted: { label: "Accepted", className: "status-accepted" },
  Rejected: { label: "Rejected", className: "status-rejected" },
};

const form = document.getElementById("job-form");
const jobList = document.getElementById("job-list");
const formError = document.getElementById("form-error");
const submitButton = document.getElementById("submit-button");
const cancelEditButton = document.getElementById("cancel-edit");
const searchInput = document.getElementById("search");
const sortSelect = document.getElementById("sort");
const filterButtons = document.querySelectorAll("[data-filter]");
const totalCount = document.getElementById("total-count");
const activeCount = document.getElementById("active-count");
const interviewCount = document.getElementById("interview-count");
const successCount = document.getElementById("success-count");
const rejectedCount = document.getElementById("rejected-count");

let applications = loadApplications();
let activeFilter = "All";

render();

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const id = String(formData.get("id") || "");
  const application = normalizeApplication({
    id: id || crypto.randomUUID(),
    company: formData.get("company"),
    role: formData.get("role"),
    applicationLink: formData.get("applicationLink"),
    appliedDate: formData.get("appliedDate"),
    status: formData.get("status"),
    source: formData.get("source"),
    notes: formData.get("notes"),
    updatedAt: new Date().toISOString(),
  });

  if (!application.company || !application.role || !application.appliedDate) {
    formError.textContent = "Company, role, and applied date are required.";
    return;
  }

  if (application.applicationLink && !isValidURL(application.applicationLink)) {
    formError.textContent = "Use a full application link, like https://company.com/job.";
    return;
  }

  if (id) {
    applications = applications.map((item) => (item.id === id ? application : item));
  } else {
    applications.unshift(application);
  }

  saveApplications();
  resetForm();
  render();
});

jobList.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) {
    return;
  }

  const id = actionButton.dataset.id;
  const action = actionButton.dataset.action;
  const application = applications.find((item) => item.id === id);

  if (!application) {
    return;
  }

  if (action === "delete") {
    applications = applications.filter((item) => item.id !== id);
    saveApplications();
    render();
    return;
  }

  if (action === "edit") {
    fillForm(application);
    return;
  }
});

jobList.addEventListener("change", (event) => {
  const select = event.target;
  if (!(select instanceof HTMLSelectElement) || select.dataset.action !== "status") {
    return;
  }

  applications = applications.map((application) =>
    application.id === select.dataset.id
      ? { ...application, status: select.value, updatedAt: new Date().toISOString() }
      : application
  );
  saveApplications();
  render();
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter || "All";
    filterButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    renderApplications();
  });
});

searchInput.addEventListener("input", renderApplications);
sortSelect.addEventListener("change", renderApplications);
cancelEditButton.addEventListener("click", resetForm);

function render() {
  renderSummary();
  renderApplications();
}

function renderSummary() {
  totalCount.textContent = String(applications.length);
  activeCount.textContent = String(applications.filter((item) => item.status !== "Rejected" && item.status !== "Accepted").length);
  interviewCount.textContent = String(applications.filter((item) => item.status === "Interviewing").length);
  successCount.textContent = String(applications.filter((item) => item.status === "Accepted").length);
  rejectedCount.textContent = String(applications.filter((item) => item.status === "Rejected").length);
}

function renderApplications() {
  const query = searchInput.value.trim().toLowerCase();
  const visibleApplications = applications
    .filter((application) => activeFilter === "All" || application.status === activeFilter)
    .filter((application) => {
      if (!query) {
        return true;
      }

      return [
        application.company,
        application.role,
        application.source,
        application.notes,
        application.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .sort(sortApplications);

  if (visibleApplications.length === 0) {
    jobList.innerHTML = `
      <article class="empty-state">
        <p>No applications match this view.</p>
        <span>Add one above or adjust your filters.</span>
      </article>
    `;
    return;
  }

  jobList.innerHTML = visibleApplications.map(renderApplication).join("");
}

function renderApplication(application) {
  const status = STATUS_META[application.status] || STATUS_META.Applied;
  const link = application.applicationLink
    ? `<a href="${escapeAttribute(application.applicationLink)}" target="_blank" rel="noreferrer">application</a>`
    : `<span>no link</span>`;
  const notes = application.notes ? `<p class="notes">${escapeHTML(application.notes)}</p>` : "";
  const source = application.source ? `<span>${escapeHTML(application.source)}</span>` : "<span>source open</span>";

  return `
    <article class="job-item ${status.className}">
      <div class="job-main">
        <div>
          <p class="company">${escapeHTML(application.company)}</p>
          <h2>${escapeHTML(application.role)}</h2>
        </div>
        <span class="status-pill ${status.className}">${status.label}</span>
      </div>

      <dl class="job-details">
        <div>
          <dt>applied</dt>
          <dd>${formatDate(application.appliedDate)}</dd>
        </div>
        <div>
          <dt>link</dt>
          <dd>${link}</dd>
        </div>
        <div>
          <dt>source</dt>
          <dd>${source}</dd>
        </div>
      </dl>

      ${notes}

      <div class="row-actions">
        <label>
          status
          <select data-action="status" data-id="${application.id}">
            ${STATUS_ORDER.map(
              (statusOption) =>
                `<option value="${statusOption}"${statusOption === application.status ? " selected" : ""}>${statusOption}</option>`
            ).join("")}
          </select>
        </label>
        <button class="text-button" type="button" data-action="edit" data-id="${application.id}">edit</button>
        <button class="text-button danger" type="button" data-action="delete" data-id="${application.id}">delete</button>
      </div>
    </article>
  `;
}

function sortApplications(first, second) {
  const sortValue = sortSelect.value;

  if (sortValue === "oldest") {
    return new Date(first.appliedDate) - new Date(second.appliedDate);
  }

  if (sortValue === "company") {
    return first.company.localeCompare(second.company);
  }

  if (sortValue === "status") {
    return STATUS_ORDER.indexOf(first.status) - STATUS_ORDER.indexOf(second.status);
  }

  return new Date(second.appliedDate) - new Date(first.appliedDate);
}

function fillForm(application) {
  form.elements.id.value = application.id;
  form.elements.company.value = application.company;
  form.elements.role.value = application.role;
  form.elements.applicationLink.value = application.applicationLink;
  form.elements.appliedDate.value = application.appliedDate;
  form.elements.status.value = application.status;
  form.elements.source.value = application.source;
  form.elements.notes.value = application.notes;
  submitButton.textContent = "save changes";
  cancelEditButton.hidden = false;
  formError.textContent = "";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetForm() {
  form.reset();
  form.elements.id.value = "";
  form.elements.status.value = "Applied";
  submitButton.textContent = "add application";
  cancelEditButton.hidden = true;
  formError.textContent = "";
}

function loadApplications() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.map(normalizeApplication) : [];
  } catch (_error) {
    return [];
  }
}

function saveApplications() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
}

function normalizeApplication(application) {
  return {
    id: String(application.id || crypto.randomUUID()),
    company: String(application.company || "").trim(),
    role: String(application.role || "").trim(),
    applicationLink: String(application.applicationLink || application.link || "").trim(),
    appliedDate: String(application.appliedDate || "").trim(),
    status: STATUS_META[application.status] ? application.status : "Applied",
    source: String(application.source || "").trim(),
    notes: String(application.notes || "").trim(),
    updatedAt: String(application.updatedAt || new Date().toISOString()),
  };
}

function formatDate(value) {
  if (!value) {
    return "not set";
  }

  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function isValidURL(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_error) {
    return false;
  }
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHTML(value).replaceAll("`", "&#96;");
}

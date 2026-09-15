const STORAGE_KEY = "jobApplications";
const STATUS_ORDER = ["Applied", "Interviewing", "Offer", "Accepted", "Rejected"];
const STATUS_META = {
  Applied: { label: "Applied", className: "status-applied" },
  Interviewing: { label: "Interviewing", className: "status-interviewing" },
  Offer: { label: "Offer", className: "status-offer" },
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
const exportButton = document.getElementById("export-csv");
const importButton = document.getElementById("import-csv");
const importFileInput = document.getElementById("import-csv-file");
const exportMessage = document.getElementById("export-message");
const filterButtons = document.querySelectorAll("[data-filter]");
const statusInput = document.getElementById("status");
const interviewRoundInput = document.getElementById("interviewRound");
const interviewRoundField = document.getElementById("interview-round-field");
const interviewRoundLabel = document.getElementById("interview-round-label");
const backToTopButton = document.getElementById("back-to-top");

let applications = loadApplications();
let activeFilter = "All";

const requestedFilter = new URLSearchParams(window.location.search).get("filter");
if (requestedFilter === "All" || STATUS_META[requestedFilter]) {
  activeFilter = requestedFilter;
  filterButtons.forEach((button) =>
    button.classList.toggle("is-active", button.dataset.filter === activeFilter)
  );
}

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
    interviewRound: formData.get("interviewRound"),
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
      ? {
          ...application,
          status: select.value,
          interviewRound:
            select.value === "Interviewing" && !application.interviewRound ? 1 : application.interviewRound,
          updatedAt: new Date().toISOString(),
        }
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
exportButton.addEventListener("click", exportApplicationsToCSV);
importButton.addEventListener("click", () => importFileInput.click());
importFileInput.addEventListener("change", importApplicationsFromCSV);
cancelEditButton.addEventListener("click", resetForm);
statusInput.addEventListener("change", updateInterviewRoundField);
window.addEventListener("scroll", updateBackToTopVisibility, { passive: true });
window.addEventListener("resize", updateBackToTopVisibility);
backToTopButton.addEventListener("click", () => {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
});
updateBackToTopVisibility();

function updateBackToTopVisibility() {
  const revealPoint = Math.max(400, window.innerHeight * 0.6);
  backToTopButton.hidden = window.scrollY < revealPoint;
}

function render() {
  updateExportState();
  renderApplications();
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

function updateExportState() {
  const hasApplications = applications.length > 0;
  exportButton.disabled = !hasApplications;
  exportMessage.textContent = hasApplications ? "" : "nothing to export yet.";
}

function exportApplicationsToCSV() {
  if (applications.length === 0) {
    updateExportState();
    return;
  }

  const columns = [
    ["Company", "company"],
    ["Job title", "role"],
    ["Application status", "status"],
    ["Current interview round", "interviewRound"],
    ["Application date", "appliedDate"],
    ["Job posting URL", "applicationLink"],
    ["Source", "source"],
    ["Notes", "notes"],
  ];

  const csvRows = [
    columns.map(([label]) => escapeCSVValue(label)).join(","),
    ...applications.map((application) =>
      columns
        .map(([, field]) => {
          const value = field === "appliedDate" ? formatDateForCSV(application[field]) : application[field];

          return escapeCSVValue(value);
        })
        .join(",")
    ),
  ];

  const csvContent = `\uFEFF${csvRows.join("\r\n")}`;
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const downloadUrl = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");

  downloadLink.href = downloadUrl;
  downloadLink.download = `job-applications-${getLocalDateStamp()}.csv`;
  document.body.append(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
}

async function importApplicationsFromCSV() {
  const [file] = importFileInput.files;
  importFileInput.value = "";

  if (!file) {
    return;
  }

  importButton.disabled = true;
  exportMessage.textContent = "importing...";

  try {
    const { importedApplications, invalidCount } = parseApplicationsCSV(await file.text());
    const existingKeys = new Set(applications.map(getApplicationDuplicateKey));
    const uniqueImports = [];
    let duplicateCount = 0;

    importedApplications.forEach((application) => {
      const duplicateKey = getApplicationDuplicateKey(application);
      if (existingKeys.has(duplicateKey)) {
        duplicateCount += 1;
        return;
      }

      existingKeys.add(duplicateKey);
      uniqueImports.push(application);
    });

    if (uniqueImports.length > 0) {
      applications = [...uniqueImports, ...applications];
      saveApplications();
      render();
    }

    const importedLabel = `${uniqueImports.length} application${uniqueImports.length === 1 ? "" : "s"} imported.`;
    const duplicateLabel = duplicateCount
      ? ` ${duplicateCount} duplicate${duplicateCount === 1 ? "" : "s"} skipped.`
      : "";
    const invalidLabel = invalidCount
      ? ` ${invalidCount} invalid row${invalidCount === 1 ? "" : "s"} skipped.`
      : "";
    exportMessage.textContent = `${importedLabel}${duplicateLabel}${invalidLabel}`;
  } catch (error) {
    exportMessage.textContent = error instanceof Error ? error.message : "could not import that csv file.";
  } finally {
    importButton.disabled = false;
  }
}

function parseApplicationsCSV(csvText) {
  const rows = parseCSVRows(csvText.replace(/^\uFEFF/, ""));
  if (rows.length < 2) {
    throw new Error("the csv does not contain any applications.");
  }

  const columnAliases = {
    company: "company",
    jobtitle: "role",
    applicationstatus: "status",
    currentinterviewround: "interviewRound",
    applicationdate: "appliedDate",
    jobpostingurl: "applicationLink",
    source: "source",
    notes: "notes",
  };
  const columnIndexes = {};

  rows[0].forEach((heading, index) => {
    const normalizedHeading = heading.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const field = columnAliases[normalizedHeading];
    if (field) {
      columnIndexes[field] = index;
    }
  });

  if (columnIndexes.company === undefined || columnIndexes.role === undefined || columnIndexes.appliedDate === undefined) {
    throw new Error("use a csv created by this tracker's export button.");
  }

  const importedApplications = [];
  let invalidCount = 0;

  rows.slice(1).forEach((row) => {
    if (row.every((value) => !value.trim())) {
      return;
    }

    const getValue = (field) => {
      const index = columnIndexes[field];
      return index === undefined ? "" : String(row[index] || "").trim();
    };
    const company = getValue("company");
    const role = getValue("role");
    const appliedDate = normalizeImportedDate(getValue("appliedDate"));
    const applicationLink = getValue("applicationLink");

    if (!company || !role || !isValidDateInput(appliedDate) || (applicationLink && !isValidURL(applicationLink))) {
      invalidCount += 1;
      return;
    }

    const importedStatus = getValue("status");
    const status = STATUS_ORDER.find((item) => item.toLowerCase() === importedStatus.toLowerCase()) || "Applied";
    importedApplications.push(
      normalizeApplication({
        company,
        role,
        status,
        interviewRound: getValue("interviewRound"),
        appliedDate,
        applicationLink,
        source: getValue("source"),
        notes: getValue("notes"),
        updatedAt: new Date().toISOString(),
      })
    );
  });

  if (importedApplications.length === 0) {
    throw new Error(
      invalidCount ? "no valid applications were found in that csv." : "the csv does not contain any applications."
    );
  }

  return { importedApplications, invalidCount };
}

function parseCSVRows(csvText) {
  const rows = [];
  let row = [];
  let value = "";
  let insideQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];

    if (insideQuotes) {
      if (character === '"' && csvText[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        insideQuotes = false;
      } else {
        value += character;
      }
    } else if (character === '"' && value === "") {
      insideQuotes = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (insideQuotes) {
    throw new Error("the csv has an unfinished quoted value.");
  }

  if (value || row.length) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }

  return rows;
}

function normalizeImportedDate(value) {
  const formulaDate = value.match(/^="(\d{4}-\d{2}-\d{2})"$/);
  return formulaDate ? formulaDate[1] : value;
}

function isValidDateInput(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && formatDateObjectForCSV(date) === value;
}

function getApplicationDuplicateKey(application) {
  return [
    application.company,
    application.role,
    application.status,
    application.interviewRound || "",
    application.appliedDate,
    application.applicationLink,
    application.source,
    application.notes,
  ]
    .map((value) => String(value).trim().toLowerCase())
    .join("\u001F");
}

function renderApplication(application) {
  const status = STATUS_META[application.status] || STATUS_META.Applied;
  const link = application.applicationLink
    ? `<a href="${escapeAttribute(application.applicationLink)}" target="_blank" rel="noreferrer">application</a>`
    : `<span>no link</span>`;
  const notes = application.notes ? `<p class="notes">${escapeHTML(application.notes)}</p>` : "";
  const source = application.source ? `<span>${escapeHTML(application.source)}</span>` : "<span>source open</span>";
  const interviewRound = application.interviewRound
    ? `<div><dt>round</dt><dd>${application.interviewRound}</dd></div>`
    : "";

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
        ${interviewRound}
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
  form.elements.interviewRound.value = application.interviewRound || "";
  form.elements.source.value = application.source;
  form.elements.notes.value = application.notes;
  submitButton.textContent = "save changes";
  cancelEditButton.hidden = false;
  formError.textContent = "";
  updateInterviewRoundField();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetForm() {
  form.reset();
  form.elements.id.value = "";
  form.elements.status.value = "Applied";
  form.elements.interviewRound.value = "";
  submitButton.textContent = "add application";
  cancelEditButton.hidden = true;
  formError.textContent = "";
  updateInterviewRoundField();
}

function updateInterviewRoundField() {
  const isInterviewing = statusInput.value === "Interviewing";
  const tracksInterviewProgress = statusInput.value !== "Applied";
  interviewRoundField.hidden = !tracksInterviewProgress;
  interviewRoundInput.required = isInterviewing;
  interviewRoundLabel.textContent = isInterviewing
    ? "current interview round"
    : statusInput.value === "Rejected"
      ? "interview round rejected at (optional)"
      : "furthest interview round (optional)";
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
    interviewRound:
      Number.isInteger(Number(application.interviewRound)) && Number(application.interviewRound) > 0
        ? Number(application.interviewRound)
        : null,
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

function formatDateForCSV(value) {
  const dateText = value ? String(value).trim() : "";
  return dateText ? `="${dateText}"` : "";
}

function getLocalDateStamp() {
  return formatDateObjectForCSV(new Date());
}

function formatDateObjectForCSV(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function escapeCSVValue(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
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

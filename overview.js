const STORAGE_KEY = "jobApplications";
const funnelTimeline = document.getElementById("funnel-timeline");

const applications = loadApplications();
renderFunnel();

function renderFunnel() {
  const maxRound = Math.max(0, ...applications.map((item) => item.interviewRound || 0));
  const interviewStages = Array.from({ length: maxRound }, (_, index) => {
    const round = index + 1;
    return {
      label: `Interview round ${round}`,
      value: applications.filter((item) => item.interviewRound >= round).length,
      rejectedValue: applications.filter(
        (item) => item.status === "Rejected" && item.interviewRound === round
      ).length,
      color: interviewStageColor(round),
    };
  });

  const stages = [
    {
      label: "Applications",
      value: applications.length,
      rejectedValue: applications.filter(
        (item) => item.status === "Rejected" && !item.interviewRound
      ).length,
      color: "#50759b",
    },
    ...interviewStages,
    {
      label: "Offers",
      value: applications.filter((item) => item.status === "Offer" || item.status === "Accepted").length,
      color: "#b96f36",
    },
    {
      label: "Accepted",
      value: applications.filter((item) => item.status === "Accepted").length,
      color: "#397a54",
    },
  ];

  const transitions = Math.max(stages.length - 1, 1);
  const desktopStep = Math.max(30, Math.min(72, Math.floor(520 / transitions)));
  const mobileStep = Math.max(14, Math.min(30, Math.floor(170 / transitions)));

  funnelTimeline.innerHTML = `
    <div class="funnel-timeline" style="--desktop-step: ${desktopStep}px; --mobile-step: ${mobileStep}px">
      ${stages
        .map(
          (stage, index) => `
            <article class="funnel-stage" style="--step-index: ${index}; color: ${stage.color}">
              <span class="funnel-stage-index">${String(index + 1).padStart(2, "0")}</span>
              <p class="funnel-stage-label">${stage.label}</p>
              <strong class="funnel-stage-value">${stage.value}</strong>
              <span class="funnel-node" aria-hidden="true"></span>
              ${
                stage.rejectedValue !== undefined
                  ? `<div class="funnel-rejected-branch">
                      <span>Rejected</span>
                      <strong>${stage.rejectedValue}</strong>
                    </div>`
                  : ""
              }
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function interviewStageColor(round) {
  const hue = ((round * 137.508 + 18) % 360).toFixed(3);
  return `hsl(${hue} 34% 45%)`;
}

function loadApplications() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((application) => ({
      status: String(application.status || "Applied"),
      interviewRound:
        Number.isInteger(Number(application.interviewRound)) && Number(application.interviewRound) > 0
          ? Number(application.interviewRound)
          : null,
    }));
  } catch (_error) {
    return [];
  }
}

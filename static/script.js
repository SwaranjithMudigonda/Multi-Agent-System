let currentThreadId = localStorage.getItem("travel_thread_id") || null;
let latestAnswerMarkdown = "";
let waitingForApproval = false;

const AGENT_LABELS = {
  flight_agent: "✈️ Flight Agent",
  hotel_agent: "🏨 Hotel Agent",
  weather_agent: "🌦️ Weather Agent",
  budget_agent: "💰 Budget Agent",
  itinerary_agent: "🗓️ Itinerary Agent"
};

function setPrompt(text) {
  document.getElementById("userInput").value = text;
}

function setLoading(isLoading, mode = "draft") {
  const sendBtn = document.getElementById("sendBtn");
  const btnText = document.getElementById("btnText");
  const btnLoader = document.getElementById("btnLoader");
  const approveBtn = document.getElementById("approveBtn");
  const reviseBtn = document.getElementById("reviseBtn");

  sendBtn.disabled = isLoading;
  approveBtn.disabled = isLoading;
  reviseBtn.disabled = isLoading;

  if (isLoading && mode === "draft") {
    btnText.classList.add("hidden");
    btnLoader.classList.remove("hidden");
  } else {
    btnText.classList.remove("hidden");
    btnLoader.classList.add("hidden");
  }
}

function showError(message) {
  const errorBox = document.getElementById("errorBox");
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
  errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
}

function hideError() {
  const errorBox = document.getElementById("errorBox");
  errorBox.classList.add("hidden");
  errorBox.textContent = "";
}

function renderMarkdown(element, markdown) {
  let content = "";
  if (Array.isArray(markdown)) {
    content = markdown
      .map((part) => {
        if (typeof part === "object" && part !== null) {
          return part.text || part.content || "";
        }
        return String(part || "");
      })
      .join("");
  } else if (typeof markdown === "object" && markdown !== null) {
    content = markdown.text || markdown.content || JSON.stringify(markdown);
  } else {
    content = String(markdown || "");
  }

  if (typeof marked !== "undefined") {
    try {
      element.innerHTML = marked.parse(content);
    } catch (e) {
      element.innerText = content;
    }
  } else {
    element.innerText = content;
  }
}


const SPECIALIST_CONFIG = {
  flight_agent: {
    name: "Flight Agent",
    icon: "✈️",
    adapter: "AviationStack MCP (uvx)",
    field: "flight_results",
    desc: "Airports & flight route discovery"
  },
  hotel_agent: {
    name: "Hotel Agent",
    icon: "🏨",
    adapter: "Tavily Search MCP",
    field: "hotel_results",
    desc: "Accommodation & neighborhood stays"
  },
  weather_agent: {
    name: "Weather Agent",
    icon: "🌦️",
    adapter: "OpenWeather MCP",
    field: "weather_results",
    desc: "Live climate & forecast analytics"
  },
  budget_agent: {
    name: "Budget Agent",
    icon: "💰",
    adapter: "Cost Analyst",
    field: "budget_results",
    desc: "Budget feasibility & affordability check"
  },
  itinerary_agent: {
    name: "Itinerary Agent",
    icon: "🗓️",
    adapter: "LangGraph Synthesizer",
    field: "itinerary",
    desc: "Integrated multi-agent travel plan"
  }
};

function toggleCardOutput(id) {
  const content = document.getElementById(id);
  if (!content) return;
  content.classList.toggle("hidden");
}

function showWorkflow(data) {
  const section = document.getElementById("workflowSection");
  const reasoning = document.getElementById("supervisorReasoning");
  const guardrailBadge = document.getElementById("guardrailBadge");
  const constraintsWrap = document.getElementById("tripConstraints");
  const cardsGrid = document.getElementById("specialistCardsGrid");

  // 1. Guardrail Badge
  if (data.guardrail_allowed === false) {
    guardrailBadge.textContent = "Guardrail Blocked";
    guardrailBadge.classList.add("blocked");
    document.getElementById("stepGuardrailStatus").textContent = "Blocked";
  } else {
    guardrailBadge.textContent = "Guardrail Passed";
    guardrailBadge.classList.remove("blocked");
    document.getElementById("stepGuardrailStatus").textContent = "Passed";
  }

  // 2. Stepper Statuses
  const selectedAgents = data.selected_agents || [];
  document.getElementById("stepSpecialistsStatus").textContent = `${selectedAgents.length} Invoked`;

  const hitlStatus = document.getElementById("stepHitlStatus");
  const hitlConnector = document.getElementById("connectorHitl");
  const stepHitl = document.getElementById("stepHitl");

  if (data.requires_approval) {
    hitlStatus.textContent = "Awaiting Review";
    hitlStatus.className = "step-badge badge-warning";
    hitlConnector.classList.add("active");
    stepHitl.classList.add("active");
  } else if (data.approved === true) {
    hitlStatus.textContent = "Approved ✅";
    hitlStatus.className = "step-badge badge-success";
    hitlConnector.classList.add("active");
    stepHitl.classList.add("active");
  } else {
    hitlStatus.textContent = "Completed";
    hitlStatus.className = "step-badge";
    hitlConnector.classList.add("active");
    stepHitl.classList.add("active");
  }

  // 3. Supervisor Reasoning
  reasoning.textContent = data.supervisor_reasoning || "Supervisor analyzed requirements and dispatched specialist agents.";

  // 4. Trip Constraints Pills
  constraintsWrap.innerHTML = "";
  const constraints = data.trip_constraints || {};
  const constraintIcons = {
    destination: "📍 Destination",
    origin: "🛫 Origin",
    duration: "⏳ Duration",
    budget: "💰 Budget",
    travel_style: "🎒 Style"
  };

  Object.entries(constraints).forEach(([key, val]) => {
    if (val && typeof val === "string" && val.trim() !== "") {
      const pill = document.createElement("span");
      pill.className = "constraint-pill";
      const label = constraintIcons[key] || key;
      pill.innerHTML = `<strong>${label}:</strong> ${val}`;
      constraintsWrap.appendChild(pill);
    }
  });

  // 5. Specialist Execution Cards Grid
  cardsGrid.innerHTML = "";
  selectedAgents.forEach((agentKey, index) => {
    const config = SPECIALIST_CONFIG[agentKey] || {
      name: agentKey,
      icon: "⚙️",
      adapter: "Agent Specialist",
      field: "",
      desc: "Specialist execution node"
    };

    const card = document.createElement("div");
    card.className = "specialist-card";

    const previewId = `specialist-output-${index}`;
    const rawData = config.field && data[config.field] ? String(data[config.field]).trim() : "";

    card.innerHTML = `
      <div class="specialist-card-header">
        <div class="specialist-icon-box">${config.icon}</div>
        <div class="specialist-info">
          <h4>${config.name}</h4>
          <span class="mcp-adapter-pill">${config.adapter}</span>
        </div>
        <span class="status-indicator-dot"></span>
      </div>
      <p class="specialist-card-desc">${config.desc}</p>
      ${rawData ? `
        <button class="view-raw-btn" onclick="toggleCardOutput('${previewId}')">
          <span>Peek Data</span> ▾
        </button>
        <div id="${previewId}" class="specialist-raw-output hidden">${rawData}</div>
      ` : ""}
    `;

    cardsGrid.appendChild(card);
  });

  section.classList.remove("hidden");
}


function showResult(answer, threadId, isDraft = false) {
  latestAnswerMarkdown = answer || "";

  const resultSection = document.getElementById("resultSection");
  const resultBox = document.getElementById("resultBox");
  const threadInfo = document.getElementById("threadInfo");
  const resultTitle = document.getElementById("resultTitle");

  renderMarkdown(resultBox, latestAnswerMarkdown);
  threadInfo.textContent = `Thread ID: ${threadId}`;
  resultTitle.textContent = isDraft ? "Draft Travel Plan" : "Your Final AI Travel Plan";
  resultSection.classList.remove("hidden");

  resultSection.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function showApproval(data) {
  waitingForApproval = true;
  const section = document.getElementById("approvalSection");
  const approvalRequest = document.getElementById("approvalRequest");
  approvalRequest.textContent = data.approval_request ||
    "Approve the draft or provide feedback before the final plan is generated.";
  section.classList.remove("hidden");
}

function hideApproval() {
  waitingForApproval = false;
  document.getElementById("approvalSection").classList.add("hidden");
  document.getElementById("approvalFeedback").value = "";
}

async function sendMessage() {
  hideError();

  if (waitingForApproval) {
    showError("Please approve or revise the current draft before starting another plan.");
    return;
  }

  const input = document.getElementById("userInput");
  const message = input.value.trim();

  if (!message) {
    showError("Please enter your travel request first.");
    return;
  }

  setLoading(true, "draft");

  try {
    const response = await fetch("/api/travel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: message,
        thread_id: currentThreadId
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Something went wrong.");
    }

    currentThreadId = data.thread_id;
    localStorage.setItem("travel_thread_id", currentThreadId);

    showWorkflow(data);

    if (data.requires_approval) {
      showResult(data.itinerary || data.answer, data.thread_id, true);
      showApproval(data);
    } else {
      hideApproval();
      showResult(data.answer, data.thread_id, false);
    }
  } catch (error) {
    showError(error.message);
  } finally {
    setLoading(false, "draft");
  }
}

async function submitApproval(approved) {
  hideError();

  if (!currentThreadId || !waitingForApproval) {
    showError("There is no draft waiting for approval.");
    return;
  }

  const feedbackInput = document.getElementById("approvalFeedback");
  const feedback = feedbackInput.value.trim();

  if (!approved && !feedback) {
    showError("Please enter revision feedback before requesting changes.");
    feedbackInput.focus();
    return;
  }

  setLoading(true, "approval");

  try {
    const response = await fetch("/api/travel/approve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        thread_id: currentThreadId,
        approved: approved,
        feedback: feedback
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Could not resume the travel workflow.");
    }

    showWorkflow(data);
    hideApproval();
    showResult(data.answer, data.thread_id, false);
  } catch (error) {
    showError(error.message);
  } finally {
    setLoading(false, "approval");
  }
}

function copyResult() {
  const resultBox = document.getElementById("resultBox");
  const text = resultBox.innerText;

  if (!text) {
    return;
  }

  navigator.clipboard.writeText(text)
    .then(() => {
      const copyBtn = document.querySelector(".copy-btn");
      const oldText = copyBtn.textContent;
      copyBtn.textContent = "Copied!";

      setTimeout(() => {
        copyBtn.textContent = oldText;
      }, 1400);
    })
    .catch(() => {
      showError("Could not copy result.");
    });
}

function downloadPDF() {
  const pdfContent = document.getElementById("pdfContent");

  if (!latestAnswerMarkdown || !pdfContent) {
    showError("No travel plan available to download.");
    return;
  }

  const downloadBtn = document.querySelector(".download-btn");
  const oldText = downloadBtn.textContent;
  downloadBtn.textContent = "Preparing PDF...";
  downloadBtn.disabled = true;

  const options = {
    margin: 0.5,
    filename: "ai-travel-plan.pdf",
    image: {
      type: "jpeg",
      quality: 0.98
    },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff"
    },
    jsPDF: {
      unit: "in",
      format: "a4",
      orientation: "portrait"
    },
    pagebreak: {
      mode: ["avoid-all", "css", "legacy"]
    }
  };

  html2pdf()
    .set(options)
    .from(pdfContent)
    .save()
    .then(() => {
      downloadBtn.textContent = oldText;
      downloadBtn.disabled = false;
    })
    .catch(() => {
      downloadBtn.textContent = oldText;
      downloadBtn.disabled = false;
      showError("Could not download PDF.");
    });
}

document.addEventListener("keydown", function(event) {
  if (event.ctrlKey && event.key === "Enter") {
    sendMessage();
  }
});

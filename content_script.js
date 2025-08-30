let showdownConverter;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "show-counter-view") {
    updateSidebar(request.text);
  }
});

function showSidebar(text) {
  const sidebar = document.createElement("div");
  sidebar.id = "counter-view-sidebar";
  sidebar.classList.add("counter-view-sidebar");

  const header = document.createElement("div");
  header.classList.add("counter-view-sidebar-header");
  header.innerHTML = `
    <span>Counter View</span>
    <span class=\"counter-view-sidebar-toggle\">-</span>
  `;

  const content = document.createElement("div");
  content.id = "counter-view-content";
  content.classList.add("counter-view-sidebar-content");
  content.innerHTML = text;

  sidebar.appendChild(header);
  sidebar.appendChild(content);

  document.body.appendChild(sidebar);

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.type = "text/css";
  link.href = chrome.runtime.getURL("sidebar.css");
  document.head.appendChild(link);

  const showdownScript = document.createElement("script");
  showdownScript.src = chrome.runtime.getURL("showdown.min.js");
  showdownScript.onload = () => {
    showdownConverter = new showdown.Converter();
    updateSidebar(text); // Rerender with markdown
  };
  document.head.appendChild(showdownScript);

  const toggle = sidebar.querySelector(".counter-view-sidebar-toggle");
  toggle.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    toggle.textContent = sidebar.classList.contains("collapsed") ? "+" : "-";
  });
}

function updateSidebar(text) {
  let sidebar = document.getElementById("counter-view-sidebar");
  if (!sidebar) {
    showSidebar("Loading...");
    sidebar = document.getElementById("counter-view-sidebar");
  }
  const content = document.getElementById("counter-view-content");
  if (showdownConverter) {
    content.innerHTML = showdownConverter.makeHtml(text);
  } else {
    content.textContent = text;
  }
}

// Show the sidebar with a loading message as soon as the script is injected.
updateSidebar("Loading...");



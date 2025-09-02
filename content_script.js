let showdownConverter;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "show-counter-view") {
    updateSidebar(request.text);
  }
});

function getBackgroundColor(element) {
  const styles = window.getComputedStyle(element);
  const bgColor = styles.backgroundColor;
  
  // Parse rgba values
  const match = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    // Calculate brightness (https://www.w3.org/TR/AERT/#color-contrast)
    return (r * 299 + g * 587 + b * 114) / 1000;
  }
  
  // Default to white if we can't parse
  return 255;
}

function isBackgroundDark() {
  // Check the background color at the bottom of the page where the sidebar will appear
  const testElement = document.createElement('div');
  testElement.style.position = 'fixed';
  testElement.style.bottom = '0';
  testElement.style.left = '0';
  testElement.style.width = '100%';
  testElement.style.height = '1px';
  testElement.style.zIndex = '-1';
  testElement.style.pointerEvents = 'none';
  document.body.appendChild(testElement);
  
  const brightness = getBackgroundColor(testElement);
  document.body.removeChild(testElement);
  
  // Consider background dark if brightness is less than 128 (50% of 255)
  return brightness < 128;
}

function showSidebar(text) {
  const sidebar = document.createElement("div");
  sidebar.id = "counter-view-sidebar";
  sidebar.classList.add("counter-view-sidebar");
  
  // Detect background and apply appropriate theme
  if (isBackgroundDark()) {
    sidebar.classList.add("dark-theme");
  }

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



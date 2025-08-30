# Chrome Extension Development Plan: "Counter View"

This document outlines a step-by-step plan for building a Chrome Extension that provides a "counter view" of an article using a remote LLM. The plan focuses on the architecture and key components, breaking down the project into manageable tasks.

## 1. Project Setup: The Manifest File (`manifest.json`)

The `manifest.json` file is the blueprint for your extension. It tells Chrome what your extension is, what it does, and what permissions it needs.

**Key Properties:**

- `manifest_version`: Set to `3`. This is the required version for modern Chrome extensions.
    
- `name`, `version`, `description`: Basic metadata for your extension.
    
- `permissions`: This is crucial for functionality.
    
    - `contextMenus`: Required to add the "Get counter view" option to the right-click menu.
        
    - `activeTab`: Grants temporary access to the currently active tab when the user interacts with the extension (e.g., right-clicks).
        
    - `scripting`: Allows your background script to inject and execute a script on the active page to read its content.
        
- `background`: This property defines a `service_worker` that will run in the background and listen for events.
    
    - `service_worker`: The path to your background script, for example, `"background.js"`.
        
- `host_permissions`: Required for your background script to make a `fetch` request to the remote LLM API. You should include the URL of the API endpoint you plan to use (e.g., `https://api.openai.com/`).
    

**Example `manifest.json` Structure:**

```
{
  "manifest_version": 3,
  "name": "Counter View",
  "version": "1.0",
  "description": "Get a counter view of an article using an LLM.",
  "permissions": [
    "contextMenus",
    "activeTab",
    "scripting"
  ],
  "host_permissions": [
    "[https://api.openai.com/](https://api.openai.com/)"
  ],
  "background": {
    "service_worker": "background.js"
  }
}
```

## 2. Background Script (`background.js`)

The background script is the central hub of your extension. It listens for the user's right-click and initiates the LLM process. It's the ideal place for the network request because it bypasses cross-origin (CORS) security restrictions of the page.

**Implementation Steps:**

1. **Create a Context Menu Item**: Use `chrome.contextMenus.create()` to add the "Get counter view" option. This should be done on the initial installation of the extension.
    
2. **Listen for Clicks**: Add a listener for `chrome.contextMenus.onClicked`. This event will fire when the user selects your menu item.
    
3. **Get Article Content**: Inside the listener, you need to get the text of the article. Since the background script cannot directly access the webpage's DOM, you must use the `chrome.scripting.executeScript()` API to inject a function into the active tab's content.
    
4. **Call the LLM API**: Once you have the article's text, make a `fetch` request to your LLM API endpoint. Your API key should be handled securely and not hardcoded.
    
5. **Send Response to Content Script**: After the LLM response comes back, send it back to the content script using `chrome.tabs.sendMessage()`. This message will contain the LLM's generated text, which is needed to display the UI.
    

## 3. Content Script (`content_script.js`)

The content script is the only part of your extension that can directly access the webpage's DOM. Its purpose is to get the article content and, later, to create and display the UI.

**Implementation Steps:**

1. **Get Text Function**: Create a function that extracts the main body text of the article from the current page's DOM. This is a critical step and might require careful selection of common article element selectors (e.g., `<article>`, `<p>`).
    
2. **Listen for Messages**: Add a `chrome.runtime.onMessage` listener. This listener will receive the LLM response from the background script.
    
3. **Create and Inject the UI**: Inside the message listener, create the HTML elements for your modal or sidebar. You will need to style them using CSS to position them correctly (e.g., `position: fixed;`) and make them visually appealing. Append these elements to the `<body>` of the page.
    
4. **Display the Response**: Populate the newly created UI elements with the text received from the background script.
    

## 4. User Interface (UI)

The UI is what the user will see. It can be a simple `div` that pops up (a modal) or a persistent element on the side of the screen (a sidebar).

**Design Considerations:**

- **HTML Structure**: A simple container `div` with a header, a content area for the LLM response, and a close button.
    
- **CSS Styling**: Define CSS classes to style the modal/sidebar. Use `position: fixed` to place it on top of the page content. Add a background overlay for modals to darken the rest of the page. Ensure the design is responsive and usable on different screen sizes.
    
- **User Experience**: Provide a clear loading state while the LLM call is being made. A simple spinner or "Generating counter view..." message will improve the user experience.
    

## 5. Summary of the Workflow

1. **User Action**: The user right-clicks on the webpage and selects "Get counter view".
    
2. **Background Script**: The `onClicked` listener in `background.js` is triggered.
    
3. **Content Retrieval**: The background script uses `chrome.scripting.executeScript()` to tell the `content_script.js` to get the article text.
    
4. **LLM Call**: The background script receives the text, makes the `fetch` request to the LLM API, and waits for a response.
    
5. **Response Handling**: The background script receives the LLM response and sends it back to the content script via `chrome.tabs.sendMessage()`.
    
6. **UI Display**: The `content_script.js` receives the message, creates the UI (modal/sidebar), and displays the LLM's generated text to the user.
    

This plan provides a solid foundation for your project. Let me know if you would like to dive deeper into any of these steps, such as the specific code for the `fetch` request or creating the modal UI.
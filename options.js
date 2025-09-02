document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const saveButton = document.getElementById('saveButton');
  const statusDiv = document.getElementById('status');

  // Load saved API key
  chrome.storage.sync.get(['openaiApiKey'], (result) => {
    if (result.openaiApiKey) {
      apiKeyInput.value = result.openaiApiKey;
    }
  });

  // Save API key
  saveButton.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      chrome.storage.sync.set({ openaiApiKey: apiKey }, () => {
        statusDiv.textContent = 'API Key saved!';
        setTimeout(() => { statusDiv.textContent = ''; }, 2000);
      });
    } else {
      statusDiv.textContent = 'API Key cannot be empty.';
      statusDiv.style.color = 'red';
      setTimeout(() => { statusDiv.textContent = ''; statusDiv.style.color = ''; }, 2000);
    }
  });
});

// background-simple.js - Simplified version for testing

// Store capture data in memory (could be enhanced with chrome.storage for persistence)
let captureDataStore = [];

// Store API key when received from sidebar
let storedApiKey = null;

chrome.runtime.onInstalled.addListener(() => {
  console.log("AI Study Copilot extension installed");
});

// Open side panel when the user clicks the extension icon
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId }, (result) => {
    if (chrome.runtime.lastError) {
      console.error("Failed to open side panel:", chrome.runtime.lastError);
    } else {
      console.log("Side panel opened successfully");
    }
  });
});

// Handle API calls from sidebar and typing data
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'anthropic-api-call') {
    handleAnthropicAPI(msg.data)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  } else if (msg.type === 'SET_API_KEY') {
    storedApiKey = msg.data.apiKey;
    sendResponse({ success: true });
    return true;
  } else if (msg.type === 'CAPTURE_DATA') {
    // Store capture data
    const captureEntry = {
      ...msg.data,
      recordedAt: new Date().toISOString(),
      tabId: sender.tab?.id,
      tabUrl: sender.tab?.url
    };
    captureDataStore.push(captureEntry);
    
    // Keep only last 1000 entries to prevent memory overflow
    if (captureDataStore.length > 1000) {
      captureDataStore = captureDataStore.slice(-1000);
    }
    
    // Log for debugging
    console.log(`[Athena Background] Capture ${captureEntry.timestamp}: ${captureEntry.diff ? captureEntry.diff.substring(0, 100) + '...' : 'No diff'}`);
    console.log(`[Athena Background] Total captures stored: ${captureDataStore.length}`);
    
    // TODO: Add AI analysis here once basic functionality is working
    
    sendResponse({ success: true });
  } else if (msg.type === 'GET_CAPTURE_HISTORY') {
    sendResponse({ success: true, data: captureDataStore });
  } else if (msg.type === 'CLEAR_CAPTURE_HISTORY') {
    captureDataStore = [];
    sendResponse({ success: true });
  }
});

async function handleAnthropicAPI(requestData) {
  const { apiKey, prompt } = requestData;
  
  if (!apiKey || apiKey === "YOUR_ANTHROPIC_API_KEY_HERE") {
    throw new Error("Anthropic API key is not set");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
  }

  const result = await response.json();
  return result.content[0].text;
}

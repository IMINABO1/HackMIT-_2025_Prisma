// sidebar.js
// Import API keys from config
import { ANTHROPIC_API_KEY, TANDEM_DeepSeek_API_KEY } from './config.js';

// Import memory manager for stateful AI
let memoryManager = null;

// Initialize memory manager
async function initializeMemoryManager() {
  try {
    // Dynamically import the memory manager
    const { default: MemoryManager } = await import('./memory-manager.js');
    memoryManager = new MemoryManager();
    console.log('[Memory] Memory manager initialized successfully');
    
    // Update UI to show memory status
    updateMemoryStatus(true);
  } catch (error) {
    console.error('[Memory] Failed to initialize memory manager:', error);
    updateMemoryStatus(false);
  }
}

// Update memory status indicator in UI
function updateMemoryStatus(isActive) {
  const statusElement = document.getElementById('memory-status');
  if (statusElement) {
    if (isActive) {
      statusElement.textContent = '🧠 Memory Active';
      statusElement.className = 'text-xs text-green-600 font-medium';
    } else {
      statusElement.textContent = '🧠 Memory Offline';
      statusElement.className = 'text-xs text-red-600 font-medium';
    }
  }
}

// Tab switching logic
const tabs = ["ask", "notes", "typing"];

tabs.forEach((name) => {
  document.getElementById(`tab-${name}`).addEventListener("click", () => {
    showTab(name);
  });
});

function showTab(active) {
  tabs.forEach((name) => {
    document
      .querySelector(`section[data-tab="${name}"]`)
      .classList.toggle("hidden", name !== active);
    const tabButton = document.getElementById(`tab-${name}`);
    if (name === active) {
      tabButton.classList.add("border-indigo-600", "text-indigo-600", "bg-indigo-50");
      tabButton.classList.remove("text-gray-700");
    } else {
      tabButton.classList.remove("border-indigo-600", "text-indigo-600", "bg-indigo-50");
      tabButton.classList.add("text-gray-700");
    }
  });
}

// Show default tab
showTab("ask");

// Initialize memory manager
initializeMemoryManager();

// Send Anthropic API key to background script for interventions
if (typeof ANTHROPIC_API_KEY !== 'undefined' && ANTHROPIC_API_KEY !== "YOUR_ANTHROPIC_API_KEY_HERE") {
  console.log('[Sidebar] Sending Anthropic API key to background script');
  chrome.runtime.sendMessage({
    type: 'SET_API_KEY',
    data: { apiKey: ANTHROPIC_API_KEY }
  });
} else {
  console.error('[Sidebar] Anthropic API key not configured or invalid');
}

// Ask AI handlers
const askInput = document.getElementById("ask-input");
const askResponse = document.getElementById("ask-response");

document.getElementById("ask-submit").addEventListener("click", async () => {
  const q = askInput.value.trim();
  if (!q) return;
  askResponse.textContent = "🤔 Thinking...";

  if (typeof ANTHROPIC_API_KEY === 'undefined' || ANTHROPIC_API_KEY === "YOUR_ANTHROPIC_API_KEY_HERE") {
    askResponse.textContent = "⚠️ Anthropic API key is not set. Please add your key to the config.js file.";
    return;
  }

  try {
    // Get current context for memory retrieval
    const context = await getCurrentContext();
    
    // Search for relevant memories if memory manager is available
    let relevantMemories = [];
    let memoryContext = '';
    
    if (memoryManager) {
      try {
        askResponse.textContent = "🧠 Retrieving memories...";
        relevantMemories = await memoryManager.searchMemories(q, 5);
        
        if (relevantMemories.length > 0) {
          memoryContext = memoryManager.formatMemoriesForAI(relevantMemories);
          console.log(`[Memory] Found ${relevantMemories.length} relevant memories for query`);
        }
      } catch (memoryError) {
        console.warn('[Memory] Error retrieving memories:', memoryError);
        // Continue without memories if there's an error
      }
    }
    
    // Build enhanced prompt with memory context
    let enhancedPrompt = q;
    if (memoryContext) {
      enhancedPrompt = `Context: You are an AI study copilot with access to the user's learning history and preferences.

${memoryContext}

Current question: ${q}

Please provide a personalized response that takes into account the user's learning history, preferences, and any relevant memories. Reference specific memories when they're relevant using [Memory X] notation.`;
    }

    askResponse.textContent = "🤔 Thinking with memory...";

    // Send request to background script with enhanced prompt
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'anthropic-api-call',
        data: { 
          apiKey: ANTHROPIC_API_KEY, 
          prompt: enhancedPrompt,
          hasMemoryContext: relevantMemories.length > 0
        }
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.error));
        }
      });
    });

    // Display response with memory indicators
    let displayResponse = `💡 ${response}`;
    if (relevantMemories.length > 0) {
      displayResponse += `\n\n🧠 Used ${relevantMemories.length} memories from your learning history`;
    }
    
    askResponse.textContent = displayResponse;

  } catch (error) {
    console.error("Anthropic API call failed:", error);
    askResponse.textContent = `❌ An error occurred: ${error.message}`;
  }
});

// ===== Screen Reader & Highlighter =====

function sendMessageToContentScript(tabId, message, callback) {
  chrome.tabs.sendMessage(tabId, message, (response) => {
    if (chrome.runtime.lastError) {
      console.log("Content script not ready, injecting now.");
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["content.js"]
      }, () => {
        if (chrome.runtime.lastError) {
          console.error(`Script injection failed: ${chrome.runtime.lastError.message}`);
          callback({ error: "❌ Failed to connect to the page. Please reload the page and try again." });
          return;
        }
        chrome.tabs.sendMessage(tabId, message, (retryResponse) => {
          if (chrome.runtime.lastError) {
            console.error(`Sending message after injection failed: ${chrome.runtime.lastError.message}`);
            callback({ error: "❌ Failed to get text. Please reload the page and try again." });
            return;
          }
          callback(retryResponse);
        });
      });
    } else {
      callback(response);
    }
  });
}

function createExtraButtons() {
  const container = document.createElement("div");
  container.className = "space-y-2 mt-2";

  container.innerHTML = `
    <button id="capture-highlighted-text" class="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 text-sm">
      Capture Highlighted Text
    </button>
    <button id="capture-visible-text" class="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 text-sm">
      Capture Visible Text
    </button>
  `;

  askInput.parentElement.insertAdjacentElement("afterend", container);

  const captureTextHandler = (messageType) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab || !tab.id) {
        askResponse.textContent = "⚠️ No active tab found.";
        return;
      }

      if (tab.url && (tab.url.startsWith("chrome://") || tab.url.startsWith("https://chrome.google.com"))) {
        askResponse.textContent = "⚠️ Cannot capture text from this type of page.";
        return;
      }

      // Handle PDFs
      if (tab.url && tab.url.toLowerCase().endsWith('.pdf')) {
        if (messageType === 'GET_HIGHLIGHTED_TEXT') {
          askResponse.textContent = "⚠️ Highlighting text is not supported in PDFs.";
        } else if (messageType === 'GET_VISIBLE_TEXT') {
          handlePdf(tab.url);
        }
        return;
      }

      // Handle regular web pages
      sendMessageToContentScript(tab.id, { type: messageType }, (res) => {
        if (res.error) {
          askResponse.textContent = res.error;
        } else if (res.text) {
          askInput.value = res.text.substring(0, 12000); // limit length
          showTab("ask");
        } else {
          if (messageType === "GET_HIGHLIGHTED_TEXT") {
            askResponse.textContent = "⚠️ No text highlighted on the page.";
          } else {
            askResponse.textContent = "⚠️ Could not retrieve text from page.";
          }
        }
      });
    });
  };

  document.getElementById("capture-highlighted-text").addEventListener("click", () => {
    captureTextHandler("GET_HIGHLIGHTED_TEXT");
  });

  document.getElementById("capture-visible-text").addEventListener("click", () => {
    captureTextHandler("GET_VISIBLE_TEXT");
  });
}

function handlePdf(pdfUrl) {
  askResponse.textContent = "⏳ Extracting text from PDF...";

  (async () => {
    let pageNo = 1;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const el = document.getElementById('pageNumber');
          return el ? parseInt(el.value, 10) : 1;
        }
      });
      pageNo = result?.[0]?.result || 1;
    } catch (err) {
      console.warn('Could not determine current PDF page, defaulting to 1', err);
    }

    // Send a message to the background script to start PDF processing
    chrome.runtime.sendMessage({
      type: 'process-pdf',
      data: { pdfUrl, pageNo }
    });
  })();
}

// Listen for the processed PDF text from the background script
// (This listener is now merged with the AI intervention listener below)

createExtraButtons();

// Handle "Explain Selected Text" button
document.getElementById("explain-selection").addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const selection = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => window.getSelection().toString()
    });
    
    const selectedText = selection[0]?.result?.trim();
    if (selectedText) {
      askInput.value = `Please explain this: "${selectedText}"`;
      showTab("ask");
    } else {
      askResponse.textContent = "⚠️ No text selected. Please select some text on the page first.";
    }
  } catch (error) {
    askResponse.textContent = "❌ Could not access selected text. Make sure you're on a web page.";
  }
});

// Handle "Get AI Help Now" button
document.getElementById("trigger-ai-now").addEventListener("click", () => {
  console.log('[Manual Trigger] Button clicked');
  askResponse.textContent = "🤖 Requesting immediate AI analysis...";
  
  // Send message to background script to trigger immediate AI analysis
  chrome.runtime.sendMessage({
    type: 'TRIGGER_AI_NOW'
  }, (response) => {
    console.log('[Manual Trigger] Response received:', response);
    
    if (chrome.runtime.lastError) {
      console.error('[Manual Trigger] Runtime error:', chrome.runtime.lastError);
      askResponse.textContent = `⚠️ Runtime error: ${chrome.runtime.lastError.message}`;
      return;
    }
    
    if (response && response.success) {
      if (response.nudgeGenerated) {
        askResponse.textContent = `✅ AI analysis complete! Generated nudge: "${response.message}"`;
      } else {
        askResponse.textContent = "✅ AI analysis complete. No nudge needed based on current activity.";
      }
    } else {
      const errorMsg = response?.error || 'Unknown error';
      askResponse.textContent = `⚠️ Could not trigger AI analysis: ${errorMsg}`;
      console.error('[Manual Trigger] Error:', errorMsg);
    }
  });
});

// Get current context for memory operations
async function getCurrentContext() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Get selected text if any
    let selectedText = '';
    try {
      const selection = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => window.getSelection().toString()
      });
      selectedText = selection[0]?.result?.trim() || '';
    } catch (error) {
      console.warn('[Context] Could not get selected text:', error);
    }

    return {
      url: tab.url,
      pageTitle: tab.title,
      selectedText: selectedText,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('[Context] Error getting current context:', error);
    return {
      url: '',
      pageTitle: '',
      selectedText: '',
      timestamp: new Date().toISOString()
    };
  }
}

// Handle "Remember This" button
document.getElementById("remember-this").addEventListener("click", async () => {
  const currentResponse = askResponse.textContent;
  
  if (!memoryManager) {
    askResponse.textContent = "⚠️ Memory system not available. Please check your connection.";
    return;
  }
  
  if (currentResponse && !currentResponse.includes("Thinking") && !currentResponse.includes("⚠️") && !currentResponse.includes("Ask a question")) {
    try {
      // Get current context
      const context = await getCurrentContext();
      
      // Extract the actual AI response (remove the 💡 prefix and memory indicators)
      let responseToRemember = currentResponse.replace(/^💡\s*/, '');
      responseToRemember = responseToRemember.split('\n\n🧠')[0]; // Remove memory indicators
      
      // Get the original question from the input
      const originalQuestion = askInput.value.trim();
      
      // Create memory content
      const memoryContent = `Q: ${originalQuestion}\nA: ${responseToRemember}`;
      
      // Add metadata about the context
      const metadata = {
        type: 'qa_pair',
        question: originalQuestion,
        answer: responseToRemember,
        url: context.url,
        pageTitle: context.pageTitle,
        selectedText: context.selectedText,
        source: 'remember_button'
      };
      
      askResponse.textContent = "💾 Saving to memory...";
      
      // Save to memory
      const savedMemory = await memoryManager.addMemory(memoryContent, metadata);
      
      if (savedMemory) {
        askResponse.textContent = currentResponse + "\n\n✅ Added to memory for future reference!";
        console.log('[Memory] Successfully saved memory:', savedMemory.id);
      } else {
        askResponse.textContent = currentResponse + "\n\n⚠️ Failed to save to memory.";
      }
      
    } catch (error) {
      console.error('[Memory] Error saving memory:', error);
      askResponse.textContent = currentResponse + "\n\n⚠️ Error saving to memory.";
    }
  } else {
    askResponse.textContent = "💭 Ask a question first, then I can remember the answer for you!";
  }
});

// Notes handling (localStorage for now)
const notesKey = "copilot_notes";
const notes = JSON.parse(localStorage.getItem(notesKey) || "[]");
const notesList = document.getElementById("notes-list");

function renderNotes() {
  notesList.innerHTML = "";
  if (notes.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "text-sm text-gray-500 text-center py-4";
    emptyState.textContent = "No notes yet. Add your first learning note above!";
    notesList.appendChild(emptyState);
    return;
  }
  
  notes.forEach((note, index) => {
    const noteItem = document.createElement("div");
    noteItem.className = "p-3 bg-gray-50 rounded-lg border border-gray-200";
    
    const noteText = document.createElement("p");
    noteText.className = "text-sm text-gray-700";
    noteText.textContent = note;
    
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "mt-2 text-xs text-red-600 hover:text-red-800";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => {
      notes.splice(index, 1);
      localStorage.setItem(notesKey, JSON.stringify(notes));
      renderNotes();
    });
    
    noteItem.appendChild(noteText);
    noteItem.appendChild(deleteBtn);
    notesList.appendChild(noteItem);
  });
}
renderNotes();

document.getElementById("note-save").addEventListener("click", () => {
  const val = document.getElementById("note-input").value.trim();
  if (!val) return;
  notes.unshift(val); // Add to beginning for reverse chronological order
  localStorage.setItem(notesKey, JSON.stringify(notes));
  document.getElementById("note-input").value = "";
  renderNotes();
});

// Capture History functionality
function formatCaptureEntry(entry) {
  const diff = entry.diff || 'No change detected';
  const preview = diff.length > 150 ? diff.substring(0, 150) + '...' : diff;
  return `${entry.timestamp}: ${preview}`;
}

function renderCaptureHistory(captureData) {
  const captureHistoryContainer = document.getElementById("typing-history");
  
  if (!captureData || captureData.length === 0) {
    captureHistoryContainer.innerHTML = `
      <div class="text-sm text-gray-500 text-center py-4">
        No capture data yet. Extension captures visible text changes every 2 seconds.
      </div>
    `;
    return;
  }
  
  captureHistoryContainer.innerHTML = "";
  
  // Group by URL for better organization
  const groupedByUrl = {};
  captureData.forEach(entry => {
    const url = entry.url || entry.tabUrl || 'Unknown';
    if (!groupedByUrl[url]) {
      groupedByUrl[url] = [];
    }
    groupedByUrl[url].push(entry);
  });
  
  Object.entries(groupedByUrl).forEach(([url, entries]) => {
    // URL header
    const urlHeader = document.createElement("div");
    urlHeader.className = "text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded mt-2 mb-1";
    const shortUrl = url.length > 40 ? url.substring(0, 40) + "..." : url;
    urlHeader.textContent = shortUrl;
    captureHistoryContainer.appendChild(urlHeader);
    
    // Entries for this URL
    entries.forEach(entry => {
      const entryDiv = document.createElement("div");
      entryDiv.className = "text-xs bg-white border border-gray-200 rounded p-2 font-mono";
      
      const formattedEntry = formatCaptureEntry(entry);
      entryDiv.textContent = formattedEntry;
      
      // Add timestamp info
      if (entry.recordedAt) {
        const timeDiv = document.createElement("div");
        timeDiv.className = "text-xs text-gray-400 mt-1";
        timeDiv.textContent = new Date(entry.recordedAt).toLocaleTimeString();
        entryDiv.appendChild(timeDiv);
      }
      
      captureHistoryContainer.appendChild(entryDiv);
    });
  });
}

function loadCaptureHistory() {
  chrome.runtime.sendMessage({ type: 'GET_CAPTURE_HISTORY' }, (response) => {
    if (response && response.success) {
      renderCaptureHistory(response.data);
    } else {
      console.error("Failed to load capture history:", response?.error);
    }
  });
}

function clearCaptureHistory() {
  chrome.runtime.sendMessage({ type: 'CLEAR_CAPTURE_HISTORY' }, (response) => {
    if (response && response.success) {
      renderCaptureHistory([]);
    } else {
      console.error("Failed to clear capture history:", response?.error);
    }
  });
}

// Event listeners for typing tab
document.getElementById("refresh-typing").addEventListener("click", () => {
  loadCaptureHistory();
});

document.getElementById("clear-typing").addEventListener("click", () => {
  if (confirm("Are you sure you want to clear all capture history?")) {
    clearCaptureHistory();
  }
});

// Load capture history when typing tab is shown
const originalShowTab = showTab;
showTab = function(active) {
  originalShowTab(active);
  if (active === "typing") {
    loadCaptureHistory();
  }
};

// ===== AI Intervention Handling =====

let currentInterventionData = null;
let nudgeTimeoutId = null; // Track the current nudge timeout

// Listen for Tandem nudges and other messages from background script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'TANDEM_NUDGE') {
    showTandemNudge(msg.data);
    sendResponse({ success: true });
  } else if (msg.type === 'pdf-processed') {
    askInput.value = msg.data.text;
    showTab("ask");
    askResponse.textContent = ""; // Clear status message
  } else if (msg.type === 'pdf-error') {
    console.error('Error processing PDF:', msg.data.message);
    askResponse.textContent = `❌ Failed to process PDF: ${msg.data.message}`;
  }
});

function showTandemNudge(nudgeData) {
  currentInterventionData = nudgeData;
  
  // Clear any existing timeout to prevent old nudges from auto-dismissing
  if (nudgeTimeoutId) {
    clearTimeout(nudgeTimeoutId);
    nudgeTimeoutId = null;
  }
  
  const banner = document.getElementById('ai-intervention-banner');
  const messageElement = document.getElementById('intervention-message');
  
  // Display the Prisma nudge message with manual trigger indicator
  let displayMessage = nudgeData.message;
  if (nudgeData.manualTrigger) {
    displayMessage = `⚡ ${displayMessage}`;
  }
  messageElement.textContent = displayMessage;
  
  // Show the banner with animation - different styles based on nudge level
  banner.classList.remove('hidden');
  banner.style.animation = 'slideIn 0.3s ease-out';
  
  // Style based on nudge level (with special styling for manual triggers)
  banner.className = 'bg-orange-100 border-b border-orange-200 px-4 py-3'; // Reset classes
  
  if (nudgeData.manualTrigger) {
    // Special styling for manual triggers
    banner.classList.add('bg-purple-50', 'border-purple-200');
  } else {
    switch (nudgeData.level) {
      case 1: // Gentle nudge
        banner.classList.add('bg-blue-50', 'border-blue-200');
        break;
      case 2: // Stronger hint
        banner.classList.add('bg-yellow-50', 'border-yellow-200');
        break;
      case 3: // Full interference
        banner.classList.add('bg-red-50', 'border-red-200');
        break;
      default:
        banner.classList.add('bg-orange-100', 'border-orange-200');
    }
  }
  
  // Set up auto-dismiss timer (but only if no new nudge appears)
  // Nudges will persist until a new one appears or user manually dismisses
  let dismissTime = 300000; // 5 minutes - much longer so nudges persist
  if (nudgeData.manualTrigger) {
    dismissTime = 600000; // Manual triggers stay for 10 minutes
  }
  
  nudgeTimeoutId = setTimeout(() => {
    // Only dismiss if this is still the current nudge and banner is visible
    if (!banner.classList.contains('hidden') && currentInterventionData === nudgeData) {
      dismissIntervention();
    }
  }, dismissTime);
  
  const triggerType = nudgeData.manualTrigger ? 'manual' : 'automatic';
  console.log(`[Tandem Nudge] Displayed ${triggerType} level ${nudgeData.level}: "${nudgeData.message}" (will persist until new nudge)`);
}

function dismissIntervention() {
  // Clear any pending timeout since we're manually dismissing
  if (nudgeTimeoutId) {
    clearTimeout(nudgeTimeoutId);
    nudgeTimeoutId = null;
  }
  
  const banner = document.getElementById('ai-intervention-banner');
  banner.style.animation = 'slideOut 0.3s ease-out';
  
  setTimeout(() => {
    banner.classList.add('hidden');
    currentInterventionData = null;
  }, 300);
}

function askMoreAboutIntervention() {
  if (!currentInterventionData) return;
  
  // Switch to Ask tab and pre-fill question
  showTab('ask');
  
  // Create follow-up question based on nudge level and analysis
  let followUpQuestion = '';
  if (currentInterventionData.level >= 3) {
    followUpQuestion = `You suggested I might be quite stuck. Can you help me break down my current problem step by step and suggest a clear path forward?`;
  } else if (currentInterventionData.level >= 2) {
    followUpQuestion = `You gave me a hint about my learning approach. Can you elaborate on what specifically I should change or focus on?`;
  } else {
    followUpQuestion = `You nudged me about my learning process. Can you help me understand what patterns you're seeing and how I can improve?`;
  }
  
  askInput.value = followUpQuestion;
  
  // Dismiss the intervention banner
  dismissIntervention();
}

// Event listeners for intervention buttons
document.getElementById('intervention-dismiss').addEventListener('click', dismissIntervention);
document.getElementById('intervention-close').addEventListener('click', dismissIntervention);
document.getElementById('intervention-ask-more').addEventListener('click', askMoreAboutIntervention);

// Add CSS animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateY(-100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateY(0);
      opacity: 1;
    }
    to {
      transform: translateY(-100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);


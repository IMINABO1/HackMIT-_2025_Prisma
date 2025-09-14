// content.js - Simple continuous visible text capture

console.log('[Prisma] Content script loading...');

// Check if the extension context is still valid
function isExtensionValid() {
  return !!(chrome.runtime && chrome.runtime.id);
}

// Capture data storage
let captureData = [];
let virtualTimestamp = 0;
let captureInterval = null;
let lastCapturedText = "";

// Function to calculate diff between two strings
function calculateDiff(oldText, newText) {
  if (oldText === newText) return "";
  
  // Handle simple cases first
  if (!oldText) return newText;
  if (!newText) return `[DELETED: ${oldText}]`;
  
  // Use a simple longest common subsequence approach
  // Find the longest common prefix
  let prefixEnd = 0;
  while (prefixEnd < Math.min(oldText.length, newText.length) && 
         oldText[prefixEnd] === newText[prefixEnd]) {
    prefixEnd++;
  }
  
  // Find the longest common suffix
  let suffixStart1 = oldText.length;
  let suffixStart2 = newText.length;
  while (suffixStart1 > prefixEnd && suffixStart2 > prefixEnd && 
         oldText[suffixStart1 - 1] === newText[suffixStart2 - 1]) {
    suffixStart1--;
    suffixStart2--;
  }
  
  // Extract the parts that differ
  const removedPart = oldText.substring(prefixEnd, suffixStart1);
  const addedPart = newText.substring(prefixEnd, suffixStart2);
  
  // Determine what kind of change happened
  if (removedPart && addedPart) {
    // Text was replaced
    return `[CHANGED: "${removedPart}" → "${addedPart}"]`;
  } else if (addedPart) {
    // Text was inserted
    return addedPart;
  } else if (removedPart) {
    // Text was deleted
    return `[DELETED: ${removedPart}]`;
  }
  
  return ""; // No meaningful change
}

// --- Get visible text function ---
function getVisibleText() {
  const selectorsToIgnore = [
    'nav', 'header', 'footer', 'aside', 'script', 'style', 'iframe', 'form', 'noscript',
    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
    '[role="search"]', '[role="form"]', '[aria-hidden="true"]'
  ].join(', ');

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.parentElement && node.parentElement.closest(selectorsToIgnore)) {
        return NodeFilter.FILTER_REJECT;
      }
      if (!node.parentElement) return NodeFilter.FILTER_REJECT;
      const style = window.getComputedStyle(node.parentElement);
      if (!style || style.visibility === "hidden" || style.display === "none" || style.opacity === '0' || parseInt(style.height, 10) === 0) {
        return NodeFilter.FILTER_REJECT;
      }
      const rect = node.parentElement.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0 || rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
        return NodeFilter.FILTER_REJECT;
      }
      if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const texts = [];
  while (walker.nextNode()) {
    const text = walker.currentNode.textContent.trim();
    if (text) {
      texts.push(text);
    }
  }
  const uniqueTexts = [...new Set(texts)];
  return uniqueTexts.join(" ");
}

function getHighlightedText() {
  let selectedText = "";
  if (window.getSelection) {
    selectedText = window.getSelection().toString();
  } else if (document.selection && document.selection.type !== "Control") {
    selectedText = document.selection.createRange().text;
  }
  return selectedText.trim();
}

// Function to capture visible text every 2 seconds
function captureVisibleTextPeriodically() {
  try {
    const currentText = getVisibleText();
    
    // Calculate diff from last capture
    const diff = calculateDiff(lastCapturedText, currentText);
    
    // Only record if there's a meaningful change
    if (diff.trim()) {
      virtualTimestamp++;
      
      const captureEntry = {
        timestamp: virtualTimestamp.toString().padStart(2, '0'),
        diff: diff,
        fullText: currentText,
        url: window.location.href,
        capturedAt: new Date().toISOString()
      };
      
      captureData.push(captureEntry);
      console.log(`[Prisma Capture] ${captureEntry.timestamp}: ${diff.substring(0, 100)}...`);
      
      // Send data to background script
      if (isExtensionValid()) {
        chrome.runtime.sendMessage({
          type: 'CAPTURE_DATA',
          data: captureEntry
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error(`[Prisma] Error sending capture:`, chrome.runtime.lastError);
          }
        });
      }
      
      // Update last captured text
      lastCapturedText = currentText;
    }
  } catch (error) {
    console.error('[Prisma] Error in capture:', error);
  }
}

// Function to start periodic capture
function startPeriodicCapture() {
  if (captureInterval) {
    clearInterval(captureInterval);
  }
  
  console.log(`[Prisma] Starting periodic capture every 2 seconds on ${window.location.href}`);
  
  // Set initial text baseline
  lastCapturedText = getVisibleText();
  console.log(`[Prisma] Initial baseline set: ${lastCapturedText.substring(0, 100)}...`);
  
  // Set up interval (start capturing after first interval)
  captureInterval = setInterval(captureVisibleTextPeriodically, 2000);
}

// Function to stop periodic capture
function stopPeriodicCapture() {
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
    console.log(`[Prisma] Stopped periodic capture`);
  }
}

// Function to get capture history
function getCaptureHistory() {
  return captureData;
}

// Function to clear capture history
function clearCaptureHistory() {
  captureData = [];
  virtualTimestamp = 0;
  lastCapturedText = "";
}

// Debug function
function testCapture() {
  console.log(`[Prisma Debug] Current page: ${window.location.href}`);
  console.log(`[Prisma Debug] Extension valid: ${isExtensionValid()}`);
  console.log(`[Prisma Debug] Virtual timestamp: ${virtualTimestamp}`);
  console.log(`[Prisma Debug] Capture data entries: ${captureData.length}`);
  console.log(`[Prisma Debug] Interval running: ${!!captureInterval}`);
  
  const visibleText = getVisibleText();
  console.log(`[Prisma Debug] Current visible text length: ${visibleText.length}`);
  console.log(`[Prisma Debug] Current visible text preview: ${visibleText.substring(0, 200)}...`);
  
  return {
    url: window.location.href,
    extensionValid: isExtensionValid(),
    virtualTimestamp,
    captureDataLength: captureData.length,
    intervalRunning: !!captureInterval,
    visibleTextLength: visibleText.length
  };
}

// Test diff function
function testDiff(oldText, newText) {
  const diff = calculateDiff(oldText, newText);
  console.log(`[Prisma Diff Test]`);
  console.log(`Old: "${oldText}"`);
  console.log(`New: "${newText}"`);
  console.log(`Diff: "${diff}"`);
  return diff;
}

// Make test functions globally available
window.athenaTest = testCapture;
window.athenaDiffTest = testDiff;

// Main initialization logic
function init() {
  console.log('[Prisma] Initializing content script...');
  
  // Check if we're already initialized
  if (window.__athenaContentScriptInitialized) {
    console.log("Content script already initialized, skipping...");
    return;
  }
  window.__athenaContentScriptInitialized = true;

  // Check if extension is valid
  if (!isExtensionValid()) {
    console.log("Extension context invalid at init, not starting");
    return;
  }

  // Message listener with error handling
  const messageListener = (msg, sender, sendResponse) => {
    console.log('[Prisma] Received message:', msg.type);
    
    // Check if extension is still valid
    if (!isExtensionValid()) {
      sendResponse({ error: "Extension context invalidated" });
      return true;
    }

    try {
      if (msg.type === "GET_HIGHLIGHTED_TEXT") {
        sendResponse({ text: getHighlightedText() });
      } else if (msg.type === "GET_VISIBLE_TEXT") {
        sendResponse({ text: getVisibleText() });
      } else if (msg.type === "GET_CAPTURE_HISTORY") {
        sendResponse({ data: getCaptureHistory() });
      } else if (msg.type === "CLEAR_CAPTURE_HISTORY") {
        clearCaptureHistory();
        sendResponse({ success: true });
      } else if (msg.type === "START_CAPTURE") {
        startPeriodicCapture();
        sendResponse({ success: true });
      } else if (msg.type === "STOP_CAPTURE") {
        stopPeriodicCapture();
        sendResponse({ success: true });
      }
    } catch (error) {
      console.error("Error handling message:", error);
      sendResponse({ error: error.message });
    }
    return true; // Keep channel open for async response
  };

  // Only add listener if extension is valid
  if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(messageListener);
    console.log('[Prisma] Message listener added');
  }

  // Start periodic capture automatically after a delay
  setTimeout(() => {
    console.log('[Prisma] Starting automatic capture...');
    startPeriodicCapture();
  }, 2000); // Wait 2 seconds for page to fully load
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  stopPeriodicCapture();
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

console.log('[Prisma] Content script loaded successfully');
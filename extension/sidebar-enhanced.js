// sidebar-enhanced.js - Enhanced sidebar with conversation memory and proper response handling
// Import API keys from config
import { ANTHROPIC_API_KEY, TANDEM_DeepSeek_API_KEY } from './config.js';

// Import new memory client for stateful AI
let memoryClient = null;

// Conversation history management
let conversationHistory = [];
let currentInterventionData = null;
let nudgeTimeoutId = null;

// Initialize memory client
async function initializeMemoryManager() {
  try {
    // Dynamically import the new memory client
    const { default: MemoryClient } = await import('./memory-client.js');
    memoryClient = MemoryClient;
    
    // Test connection
    const isAvailable = await memoryClient.isAvailable();
    console.log('[Memory] Memory client initialized, available:', isAvailable);
    
    // Update UI to show memory status
    updateMemoryStatus(isAvailable);
    return isAvailable;
  } catch (error) {
    console.error('[Memory] Failed to initialize memory client:', error);
    updateMemoryStatus(false);
    return false;
  }
}

// Update memory status indicator in UI
function updateMemoryStatus(isActive) {
  const statusElement = document.getElementById('memory-status');
  if (statusElement) {
    if (isActive) {
      statusElement.textContent = '🧠 Memory Active';
      statusElement.className = 'text-xs text-green-600 font-medium';
      console.log('[Memory] ✅ Memory system is ACTIVE and ready');
    } else {
      statusElement.textContent = '🧠 Memory Offline';
      statusElement.className = 'text-xs text-red-600 font-medium';
      console.log('[Memory] ❌ Memory system is OFFLINE');
    }
  }
}

// Conversation history management
async function loadConversationHistory() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['conversationHistory'], (result) => {
      conversationHistory = result.conversationHistory || [];
      console.log(`[Conversation] Loaded ${conversationHistory.length} previous exchanges`);
      resolve(conversationHistory);
    });
  });
}

async function saveConversationHistory() {
  // Keep only last 10 exchanges to prevent storage bloat
  if (conversationHistory.length > 10) {
    conversationHistory = conversationHistory.slice(-10);
  }
  
  chrome.storage.local.set({ conversationHistory }, () => {
    console.log(`[Conversation] Saved ${conversationHistory.length} exchanges`);
  });
}

async function clearConversationHistory() {
  conversationHistory = [];
  chrome.storage.local.remove(['conversationHistory'], () => {
    console.log('[Conversation] History cleared');
  });
}

// Check if this is a follow-up to an intervention
function isFollowUpToIntervention(question) {
  if (!currentInterventionData) return false;
  
  // Check if there's an active intervention banner visible
  const banner = document.getElementById('ai-intervention-banner');
  const isInterventionVisible = banner && !banner.classList.contains('hidden');
  
  // If intervention is visible and user asks any question, treat as followup
  return isInterventionVisible && question.trim().length > 0;
}

// Format memories for AI context
function formatMemoriesForAI(memories) {
  if (!memories || memories.length === 0) {
    console.log('[Memory] ❌ No memories to format for AI');
    return '';
  }
  
  let formatted = "Student's Learning Profile:\n";
  console.log('[Memory] 🧠 Formatting memories for AI prompt:');
  memories.forEach((memory, index) => {
    const category = memory.metadata?.category || 'general';
    const formattedEntry = `• [${category.toUpperCase()}] ${memory.content}`;
    formatted += formattedEntry + '\n';
    console.log(`[Memory]   ${index + 1}. ${formattedEntry}`);
  });
  
  console.log('[Memory] ✅ Memory profile formatted for AI context');
  return formatted;
}

// Build educational prompt with conversation history and page context
function buildEducationalPrompt(question, conversationHistory, memories, pageContext = '') {
  console.log('[Prompt Debug] Building educational prompt...');
  console.log('[Prompt Debug] Question:', question);
  console.log('[Prompt Debug] Conversation history length:', conversationHistory.length);
  console.log('[Prompt Debug] Memories length:', memories.length);
  console.log('[Prompt Debug] Page context available:', !!pageContext);
  
  // Check if this is a follow-up question
  const isFollowUp = isFollowUpToIntervention(question);
  console.log('[Prompt Debug] Is follow-up to intervention:', isFollowUp);
  
  let prompt;
  
  if (isFollowUp && currentInterventionData) {
    // This is a follow-up to an AI intervention - be very specific
    prompt = `You are helping a student who just asked for more help after you gave them a hint.

CONTEXT: You previously told them: "${currentInterventionData.message}"

STUDENT'S FOLLOW-UP: "${question}"
${pageContext}

RECENT CONVERSATION:
${conversationHistory.slice(-2).map((exchange, i) => 
  `${i+1}. Student: "${exchange.question}"\n   You: "${exchange.response.substring(0, 150)}..."`
).join('\n')}

STUDENT PROFILE:
${memories.length > 0 ? formatMemoriesForAI(memories) : 'No specific learning profile yet.'}

INSTRUCTIONS:
- This is a follow-up to your hint
- Give ONE specific next step (maximum 2 short sentences)  
- For math: show one calculation step, not full solution
- Be direct and actionable, not explanatory
- CRITICAL: Keep response under 100 words
- IMPORTANT: Use the current page context to understand what problem they're working on

Specific help:`;
  } else {
    // Regular question - educational but comprehensive
    prompt = `You are a personalized AI tutor. Be educational and specific.

STUDENT PROFILE:
${memories.length > 0 ? formatMemoriesForAI(memories) : 'No specific learning profile yet.'}

RECENT CONVERSATION:
${conversationHistory.slice(-3).map((exchange, i) => 
  `${i+1}. Student: "${exchange.question}"\n   You: "${exchange.response.substring(0, 150)}..."`
).join('\n')}

CURRENT QUESTION: "${question}"
${pageContext}

INSTRUCTIONS:
- Keep responses brief (maximum 2-3 short sentences)
- For homework: give hints, not answers
- For concepts: one clear example only
- Be specific and concise
- CRITICAL: Keep response under 150 words
- IMPORTANT: Use the current page context to understand what problem they're working on
- For math problems, provide confident answers based on the specific problem context

Response:`;
  }
  
  console.log('[Prompt Debug] Final prompt length:', prompt.length);
  console.log('[Prompt Debug] Final prompt preview:', prompt.substring(0, 300) + '...');
  
  return prompt;
}

// Update orange banner with AI response
function updateInterventionResponse(response, memories = []) {
  const banner = document.getElementById('ai-intervention-banner');
  const messageElement = document.getElementById('intervention-message');
  
  if (!banner || !messageElement) return;
  
  // Use the AI response as-is (trust the prompt instructions for brevity)
  let processedResponse = response.trim();
  
  // Only fix formatting issues - ensure proper sentence endings
  if (processedResponse && !processedResponse.endsWith('.') && !processedResponse.endsWith('!') && !processedResponse.endsWith('?')) {
    // Only add period if it doesn't end with punctuation
    processedResponse += '.';
  }
  
  // Add memory indicator if memories were used
  let memoryIndicator = '';
  if (memories && memories.length > 0) {
    memoryIndicator = `<div class="text-xs text-orange-600 mt-1">🧠 Used ${memories.length} items from your profile</div>`;
  }
  
  messageElement.innerHTML = `
    <div class="font-medium text-orange-800 mb-2">💡 AI Tutor:</div>
    <div class="text-orange-700 whitespace-pre-line">${processedResponse}</div>
    ${memoryIndicator}
  `;
  
  // Update buttons to show "Continue" instead of "Tell me more"
  const buttonsContainer = banner.querySelector('.flex.space-x-2');
  if (buttonsContainer) {
    buttonsContainer.innerHTML = `
      <button id="intervention-continue" class="text-xs bg-orange-600 hover:bg-orange-700 text-white px-2 py-1 rounded">
        Continue
      </button>
      <button id="intervention-dismiss" class="text-xs bg-orange-200 hover:bg-orange-300 text-orange-800 px-2 py-1 rounded">
        Got it
      </button>
    `;
    
    // Re-attach event listeners with error handling
    const continueBtn = document.getElementById('intervention-continue');
    const dismissBtn = document.getElementById('intervention-dismiss');
    
    if (continueBtn) {
      continueBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('[Button] Continue clicked');
        showTab('ask');
        const askInput = document.getElementById('ask-input');
        if (askInput) askInput.focus();
      });
    }
    
    if (dismissBtn) {
      dismissBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('[Button] Dismiss clicked');
        dismissIntervention();
      });
    }
  }
  
  // Show banner if hidden
  banner.classList.remove('hidden');
}

// Call Anthropic API
async function callAnthropicAPI(prompt) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      type: 'anthropic-api-call',
      data: { 
        apiKey: ANTHROPIC_API_KEY, 
        prompt: prompt,
        hasMemoryContext: true
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
}

// Tab switching logic
const tabs = ["ask", "notes", "typing"];

tabs.forEach((name) => {
  document.getElementById(`tab-${name}`).addEventListener("click", () => {
    showTab(name);
  });
});

function showTab(active) {
  console.log('[ShowTab] Switching to tab:', active);
  
  tabs.forEach((name) => {
    const section = document.querySelector(`section[data-tab="${name}"]`);
    const tabButton = document.getElementById(`tab-${name}`);
    
    if (section) {
      section.classList.toggle("hidden", name !== active);
    } else {
      console.warn(`[ShowTab] Section for tab '${name}' not found`);
    }
    
    if (tabButton) {
      tabButton.classList.toggle("bg-blue-600", name === active);
      tabButton.classList.toggle("text-white", name === active);
      tabButton.classList.toggle("bg-gray-200", name !== active);
      tabButton.classList.toggle("text-gray-700", name !== active);
    } else {
      console.warn(`[ShowTab] Button for tab '${name}' not found`);
    }
  });
  
  console.log(`[ShowTab] Successfully switched to '${active}' tab`);
}

// Initialize with Ask AI tab
showTab("ask");

// Ask AI handlers
const askInput = document.getElementById("ask-input");
const askResponse = document.getElementById("ask-response");

document.getElementById("ask-submit").addEventListener("click", async () => {
  const q = askInput.value.trim();
  if (!q) return;

  if (typeof ANTHROPIC_API_KEY === 'undefined' || ANTHROPIC_API_KEY === "YOUR_ANTHROPIC_API_KEY_HERE") {
    askResponse.textContent = "⚠️ Anthropic API key is not set. Please add your key to the config.js file.";
    return;
  }

  // Load conversation history
  await loadConversationHistory();
  
  // Check if this is a follow-up to intervention
  const isFollowUp = isFollowUpToIntervention(q);
  
  // Show thinking message in appropriate location
  if (isFollowUp) {
    const banner = document.getElementById('ai-intervention-banner');
    const messageElement = document.getElementById('intervention-message');
    if (messageElement) {
      messageElement.innerHTML = `
        <div class="font-medium text-orange-800 mb-2">💡 AI Tutor:</div>
        <div class="text-orange-700">🤔 Thinking about your question...</div>
      `;
    }
  } else {
    askResponse.textContent = "🤔 Thinking...";
  }

  try {
     // Get current page context
     let pageContext = '';
     try {
       const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
       
       // Get page content using content script
       const result = await chrome.scripting.executeScript({
         target: { tabId: tab.id },
         function: () => {
           // Get the current problem/question text from the page
           const problemElements = document.querySelectorAll('h1, h2, h3, .problem, .question, [class*="problem"], [class*="question"]');
           let problemText = '';
           
           // Try to find the main problem text
           problemElements.forEach(el => {
             const text = el.textContent.trim();
             if (text.length > problemText.length && text.length < 500) {
               problemText = text;
             }
           });
           
           // If no specific problem found, get visible text
           if (!problemText) {
             const visibleText = document.body.innerText || document.body.textContent || '';
             problemText = visibleText.substring(0, 1000); // First 1000 chars
           }
           
           return {
             url: window.location.href,
             title: document.title,
             problemText: problemText,
             selectedText: window.getSelection().toString()
           };
         }
       });
       
       const context = result[0]?.result;
       if (context && context.problemText) {
         pageContext = `\n\nCURRENT PAGE CONTEXT:
Page: ${context.title}
URL: ${context.url}
Problem/Content: ${context.problemText}
${context.selectedText ? `Selected Text: ${context.selectedText}` : ''}`;
         console.log('[Context] ✅ Retrieved page context:', context);
       }
     } catch (contextError) {
       console.warn('[Context] ❌ Could not get page context:', contextError);
     }
     
     // Get memories for context
     let memories = [];
     if (memoryClient) {
       try {
         console.log('[Memory] 🔍 Searching for memories related to:', q);
         memories = await memoryClient.searchMemories(q, 3);
         console.log(`[Memory] ✅ Retrieved ${memories.length} relevant memories for AI context`);
         if (memories.length > 0) {
           console.log('[Memory] 🧠 Using these memories in AI prompt:');
           memories.forEach((memory, index) => {
             console.log(`[Memory]   ${index + 1}. "${memory.content}" (relevance: ${memory.relevance || 'N/A'})`);
           });
         } else {
           console.log('[Memory] ❌ No relevant memories found for this query');
         }
       } catch (memoryError) {
         console.warn('[Memory] ❌ Error retrieving memories:', memoryError);
       }
     } else {
       console.warn('[Memory] ❌ Memory client not available');
     }
    
    // Debug conversation history
    console.log('[Conversation] Current history:', conversationHistory);
    console.log('[Conversation] History length:', conversationHistory.length);
    
    // Build educational prompt with conversation history and page context
    const enhancedPrompt = buildEducationalPrompt(q, conversationHistory, memories, pageContext);
    console.log('[AI] Sending educational prompt with conversation context and page context');
    console.log('[AI] Full prompt being sent:', enhancedPrompt);
    
    // Update status
    if (isFollowUp) {
      const messageElement = document.getElementById('intervention-message');
      if (messageElement) {
        messageElement.innerHTML = `
          <div class="font-medium text-orange-800 mb-2">💡 AI Tutor:</div>
          <div class="text-orange-700">🧠 Thinking with your learning context...</div>
        `;
      }
    } else {
      askResponse.textContent = "🧠 Thinking with your learning context...";
    }
    
    // Call AI
    const response = await callAnthropicAPI(enhancedPrompt);
    
    // Store in conversation history
    conversationHistory.push({ 
      question: q, 
      response, 
      timestamp: Date.now(),
      isFollowUp: isFollowUp
    });
    await saveConversationHistory();
    
    // Always display response in orange banner, never at bottom
    updateInterventionResponse(response, memories);
    // Always clear the bottom response area
    askResponse.textContent = '';
    
    // Clear input
    askInput.value = '';
    
    console.log(`[Conversation] Exchange saved. Total: ${conversationHistory.length}`);
    
  } catch (error) {
    console.error("AI call failed:", error);
    const errorMsg = `❌ Error: ${error.message}`;
    
    // Always show errors in orange banner too
    updateInterventionResponse(errorMsg, memories);
    askResponse.textContent = '';
  }
});

// Enter key support for ask input
askInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    document.getElementById("ask-submit").click();
  }
});

// Clear conversation history button
document.getElementById("clear-conversation")?.addEventListener("click", async () => {
  if (confirm("Clear conversation history? This will reset the AI's memory of your current session.")) {
    await clearConversationHistory();
    askResponse.textContent = "🔄 Conversation history cleared. Starting fresh!";
  }
});

// Remember This functionality
document.getElementById("remember-this")?.addEventListener("click", async () => {
  console.log('[Memory] 💾 Remember This button clicked');
  const selectedText = await getSelectedTextFromPage();
  
  if (selectedText && memoryClient) {
    try {
      console.log('[Memory] 💾 Storing selected text as memory:', selectedText);
      const savedMemory = await memoryClient.addMemory(`Important: ${selectedText}`, {
        source: 'selection',
        category: 'fact'
      });
      console.log('[Memory] ✅ Successfully saved memory with ID:', savedMemory.id);
      askResponse.textContent = `✅ Remembered: "${selectedText.substring(0, 100)}..."`;
    } catch (error) {
      console.error('[Memory] ❌ Failed to save memory:', error);
      askResponse.textContent = "❌ Failed to save memory";
    }
  } else {
    console.warn('[Memory] ⚠️ No selected text or memory client unavailable');
    askResponse.textContent = "Please select some text on the page first, then click Remember This.";
  }
});

// Get selected text from the current page
async function getSelectedTextFromPage() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "GET_HIGHLIGHTED_TEXT" }, (response) => {
          resolve(response?.text || '');
        });
      } else {
        resolve('');
      }
    });
  });
}

// Explain Selected Text functionality
document.getElementById("explain-selection")?.addEventListener("click", async () => {
  const selectedText = await getSelectedTextFromPage();
  if (selectedText) {
    askInput.value = `Please explain this: "${selectedText}"`;
    document.getElementById("ask-submit").click();
  } else {
    askResponse.textContent = "Please select some text on the page first, then click Explain Selected Text.";
  }
});

// Get AI Help Now - Manual intervention trigger
document.getElementById("trigger-ai-now")?.addEventListener("click", async () => {
  askResponse.textContent = "🤖 Requesting AI analysis of your current activity...";
  
  try {
    chrome.runtime.sendMessage({
      type: 'TRIGGER_AI_NOW'
    }, (response) => {
      if (chrome.runtime.lastError) {
        askResponse.textContent = `❌ Failed to trigger AI: ${chrome.runtime.lastError.message}`;
      } else if (response && response.success) {
        askResponse.textContent = "✅ AI analysis requested! Check for hints above.";
      } else {
        askResponse.textContent = `❌ AI analysis failed: ${response?.error || 'Unknown error'}`;
      }
    });
  } catch (error) {
    askResponse.textContent = `❌ Error: ${error.message}`;
  }
});

// AI Intervention handling
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'TANDEM_NUDGE') {
    showTandemNudge(msg.data);
    sendResponse({ success: true });
  }
});

function showTandemNudge(nudgeData) {
  currentInterventionData = nudgeData;
  
  // Clear any existing timeout
  if (nudgeTimeoutId) {
    clearTimeout(nudgeTimeoutId);
    nudgeTimeoutId = null;
  }
  
  const banner = document.getElementById('ai-intervention-banner');
  const messageElement = document.getElementById('intervention-message');
  
  if (!banner || !messageElement) return;
  
  // Display the nudge message
  let displayMessage = nudgeData.message;
  if (nudgeData.manualTrigger) {
    displayMessage = `⚡ ${displayMessage}`;
  }
  messageElement.textContent = displayMessage;
  
  // Show the banner
  banner.classList.remove('hidden');
  
  // Style based on nudge level
  banner.className = 'bg-orange-100 border-b border-orange-200 px-4 py-3';
  
  if (nudgeData.manualTrigger) {
    banner.classList.add('bg-purple-50', 'border-purple-200');
  } else {
    switch (nudgeData.level) {
      case 1:
        banner.classList.add('bg-blue-50', 'border-blue-200');
        break;
      case 2:
        banner.classList.add('bg-yellow-50', 'border-yellow-200');
        break;
      case 3:
        banner.classList.add('bg-red-50', 'border-red-200');
        break;
      default:
        banner.classList.add('bg-orange-100', 'border-orange-200');
    }
  }
  
  console.log(`[Intervention] Showing nudge level ${nudgeData.level}: "${nudgeData.message}"`);
}

function dismissIntervention() {
  console.log('[Intervention] Dismissing intervention banner');
  
  if (nudgeTimeoutId) {
    clearTimeout(nudgeTimeoutId);
    nudgeTimeoutId = null;
  }
  
  const banner = document.getElementById('ai-intervention-banner');
  if (banner) {
    banner.classList.add('hidden');
    currentInterventionData = null;
    console.log('[Intervention] Banner hidden successfully');
  } else {
    console.warn('[Intervention] Banner element not found');
  }
}

function askMoreAboutIntervention() {
  console.log('[Intervention] Ask more about intervention clicked');
  
  if (!currentInterventionData) {
    console.warn('[Intervention] No current intervention data available');
    return;
  }
  
  // Switch to Ask tab and pre-fill question
  showTab('ask');
  
  // Create follow-up question based on nudge level
  let followUpQuestion = '';
  if (currentInterventionData.level >= 3) {
    followUpQuestion = `You suggested I might be quite stuck. Can you help me break down my current problem step by step and suggest a clear path forward?`;
  } else if (currentInterventionData.level >= 2) {
    followUpQuestion = `You gave me a hint about my learning approach. Can you elaborate on what specifically I should change or focus on?`;
  } else {
    followUpQuestion = `You nudged me about my learning process. Can you help me understand what patterns you're seeing and how I can improve?`;
  }
  
  const askInput = document.getElementById('ask-input');
  if (askInput) {
    askInput.value = followUpQuestion;
    askInput.focus();
    console.log('[Intervention] Pre-filled follow-up question');
  }
  
  // Don't dismiss the intervention - let the response replace it
}

// Event listeners for intervention buttons - handled by event delegation now
// (removed to avoid conflicts with dynamic button creation)

// Notes functionality (simplified for now)
const notesContainer = document.getElementById("notes-container");
const addNoteBtn = document.getElementById("add-note");
const noteInput = document.getElementById("note-input");

// Add note functionality
addNoteBtn?.addEventListener("click", async () => {
  const content = noteInput?.value.trim();
  if (!content || !memoryClient) return;
  
  try {
    console.log('[Memory] 📝 Adding manual note:', content);
    const savedNote = await memoryClient.addNote(content, {
      title: "Manual Note",
      source: "sidebar"
    });
    console.log('[Memory] ✅ Successfully saved note with ID:', savedNote.id);
    
    noteInput.value = '';
    askResponse.textContent = "✅ Note saved to your learning profile!";
  } catch (error) {
    console.error('[Memory] ❌ Failed to add note:', error);
    askResponse.textContent = "❌ Failed to save note";
  }
});

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Sidebar Enhanced] Initializing...');
  
  // Initialize memory system
  const memoryAvailable = await initializeMemoryManager();
  
  // Show current memory contents for debugging
  if (memoryAvailable && memoryClient) {
    try {
      console.log('[Memory] 🔍 Checking current memory contents...');
      const allMemories = await memoryClient.searchMemories('', 10); // Get up to 10 memories
      console.log(`[Memory] 📋 Current memory database contains ${allMemories.length} items:`);
      allMemories.forEach((memory, index) => {
        const category = memory.metadata?.category || 'general';
        console.log(`[Memory]   ${index + 1}. [${category.toUpperCase()}] "${memory.content}"`);
      });
    } catch (error) {
      console.warn('[Memory] ⚠️ Could not retrieve memory contents:', error);
    }
  }
  
  // Load conversation history
  await loadConversationHistory();
  
  // Send API key to background script to enable AI interventions
  if (typeof ANTHROPIC_API_KEY !== 'undefined' && ANTHROPIC_API_KEY !== "YOUR_ANTHROPIC_API_KEY_HERE") {
    chrome.runtime.sendMessage({
      type: 'SET_API_KEY',
      data: { apiKey: ANTHROPIC_API_KEY }
    }, (response) => {
      if (response && response.success) {
        console.log('[AI Intervention] API key sent to background script - interventions enabled');
      } else {
        console.warn('[AI Intervention] Failed to send API key to background script');
      }
    });
  } else {
    console.warn('[AI Intervention] No valid API key - interventions disabled');
  }
  
  console.log('[Sidebar Enhanced] Initialization complete');
  console.log(`[Conversation] Loaded ${conversationHistory.length} previous exchanges`);
  
  // Set up event delegation for dynamically created intervention buttons
  document.addEventListener('click', (e) => {
    if (e.target.id === 'intervention-continue') {
      e.preventDefault();
      console.log('[Event Delegation] Continue clicked');
      try {
        // First dismiss the intervention
        console.log('[Event Delegation] Dismissing intervention...');
        dismissIntervention();
        
        // Then switch to ask tab
        console.log('[Event Delegation] Calling showTab...');
        showTab('ask');
        console.log('[Event Delegation] showTab completed');
        
        // Focus the input with a small delay to ensure tab is shown
        setTimeout(() => {
          const askInput = document.getElementById('ask-input');
          if (askInput) {
            console.log('[Event Delegation] Focusing ask input...');
            askInput.focus();
            console.log('[Event Delegation] Input focused');
          } else {
            console.error('[Event Delegation] Ask input not found!');
          }
        }, 100);
      } catch (error) {
        console.error('[Event Delegation] Error in continue handler:', error);
      }
    } else if (e.target.id === 'intervention-dismiss') {
      e.preventDefault();
      console.log('[Event Delegation] Dismiss clicked');
      dismissIntervention();
    } else if (e.target.id === 'intervention-close') {
      e.preventDefault();
      console.log('[Event Delegation] Close clicked');
      dismissIntervention();
    } else if (e.target.id === 'intervention-ask-more') {
      e.preventDefault();
      console.log('[Event Delegation] Ask more clicked');
      askMoreAboutIntervention();
    }
  });
});

// Export for debugging
window.memoryClient = memoryClient;
window.conversationHistory = conversationHistory;
window.clearConversationHistory = clearConversationHistory;

// Add helpful debugging functions to window
window.showMemories = async function() {
  if (!memoryClient) {
    console.warn('[Memory] ❌ Memory client not available');
    return;
  }
  
  try {
    console.log('[Memory] 🔍 Fetching all memories...');
    const memories = await memoryClient.searchMemories('', 20); // Get up to 20 memories
    console.log(`[Memory] 📋 Found ${memories.length} memories in database:`);
    console.table(memories.map((m, i) => ({
      '#': i + 1,
      'Category': m.metadata?.category || 'general',
      'Content': m.content.substring(0, 100) + (m.content.length > 100 ? '...' : ''),
      'Relevance': m.relevance || 'N/A'
    })));
    return memories;
  } catch (error) {
    console.error('[Memory] ❌ Error fetching memories:', error);
  }
};

window.searchMemories = async function(query) {
  if (!memoryClient) {
    console.warn('[Memory] ❌ Memory client not available');
    return;
  }
  
  try {
    console.log(`[Memory] 🔍 Searching memories for: "${query}"`);
    const memories = await memoryClient.searchMemories(query, 10);
    console.log(`[Memory] ✅ Found ${memories.length} relevant memories:`);
    memories.forEach((memory, index) => {
      console.log(`[Memory]   ${index + 1}. "${memory.content}" (relevance: ${memory.relevance || 'N/A'})`);
    });
    return memories;
  } catch (error) {
    console.error('[Memory] ❌ Error searching memories:', error);
  }
};

console.log('[Memory] 📝 Available debugging functions:');
console.log('[Memory]   - showMemories() - Display all memories in table format');
console.log('[Memory]   - searchMemories("query") - Search for specific memories');
console.log('[Memory]   - memoryClient - Direct access to memory client');
console.log('[Memory]   - conversationHistory - View conversation history');

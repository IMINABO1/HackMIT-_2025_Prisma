// background.js

console.log('[System] Background script starting...');

// Global error handler
self.addEventListener('error', (event) => {
  console.error('[System] Global error:', event.error);
  console.error('[System] Error details:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

// Unhandled promise rejection handler
self.addEventListener('unhandledrejection', (event) => {
  console.error('[System] Unhandled promise rejection:', event.reason);
  console.error('[System] Promise:', event.promise);
});

// Store capture data in memory (could be enhanced with chrome.storage for persistence)
let captureDataStore = [];

// Import modules using static imports (works in service workers)
import { TandemProcessor } from './tandem-processor.js';
import { PrismaNudgeSystem } from './claude-nudge-system.js';

// Initialize processors
let tandemProcessor = null;
let prismaNudgeSystem = null;

// Initialize the two-stage system
function initializeProcessors() {
  try {
    console.log('[System] Initializing processors...');
    
    tandemProcessor = new TandemProcessor();
    console.log('[Tandem] Processor initialized successfully');
    
    prismaNudgeSystem = new PrismaNudgeSystem();
    console.log('[Tandem Nudge] System initialized successfully');
    
    // Start monitoring for structured batches
    startBatchMonitoring();
    
  } catch (error) {
    console.error('[System] Error during initialization:', error);
    console.error('[System] Stack trace:', error.stack);
    // Retry after delay
    setTimeout(initializeProcessors, 1000);
  }
}

// Monitor for new structured batches and trigger Prisma analysis
function startBatchMonitoring() {
  setInterval(() => {
    if (tandemProcessor && prismaNudgeSystem && storedApiKey) {
      try {
        const latestBatch = tandemProcessor.getLatestStructuredBatch();
        if (latestBatch && shouldAnalyzeBatch(latestBatch)) {
          analyzeBatchWithPrisma(latestBatch);
        }
      } catch (error) {
        console.error('[Batch Monitor] Error:', error);
      }
    }
  }, 5000); // Check every 5 seconds
}

// Track which batches we've already analyzed
let analyzedBatches = new Set();

function shouldAnalyzeBatch(batch) {
  return batch && !analyzedBatches.has(batch.batchId);
}

async function analyzeBatchWithPrisma(batch) {
  try {
    analyzedBatches.add(batch.batchId);
    
    // Keep only recent batch IDs to prevent memory leak
    if (analyzedBatches.size > 50) {
      const batchIds = Array.from(analyzedBatches);
      analyzedBatches = new Set(batchIds.slice(-25));
    }
    
    console.group(`🚀 [Background] Tandem Inference Triggered - Batch ${batch.batchId}`);
    console.log('📊 Batch Details:', {
      batchId: batch.batchId,
      timestamp: new Date(batch.timestamp).toISOString(),
      entryCount: batch.rawEntryCount,
      timespan: batch.timespan,
      textLength: batch.structuredText.length
    });
    console.log('🔑 API Key Status:', storedApiKey ? '✅ Available' : '❌ Missing');
    console.log('📝 Structured Text Preview:', batch.structuredText.substring(0, 500) + '...');
    console.log('🎯 Full Structured Text:', batch.structuredText);
    
    console.log('🧠 Calling Prisma Nudge System...');
    const nudge = await prismaNudgeSystem.analyzeAndNudge(batch, storedApiKey);
    
    if (nudge) {
      console.log('✅ Nudge Generated Successfully!');
      console.log('💬 Nudge Details:', {
        text: nudge.text,
        level: nudge.level,
        timestamp: new Date(nudge.timestamp).toISOString(),
        analysisSignals: nudge.analysis.signalTypes,
        concerningSignals: nudge.analysis.concerningSignals
      });
      
      // Send nudge to sidebar
      console.log('📤 Sending nudge to sidebar...');
      chrome.runtime.sendMessage({
        type: 'TANDEM_NUDGE',
        data: {
          message: nudge.text,
          level: nudge.level,
          timestamp: nudge.timestamp,
          analysis: nudge.analysis
        }
      });
    } else {
      console.log('🤫 Prisma chose to stay silent - user is doing fine');
    }
    
    console.groupEnd();
    
  } catch (error) {
    console.error('❌ Tandem Analysis Error:', error);
    console.error('🔍 Error Stack:', error.stack);
    console.groupEnd();
  }
}

// Initialize on startup
setTimeout(initializeProcessors, 50);

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

// Store API key when received from sidebar
let storedApiKey = null;

// Handle API calls from sidebar and typing data
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'anthropic-api-call') {
    handleAnthropicAPI(msg.data)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  } else if (msg.type === 'SET_API_KEY') {
    storedApiKey = msg.data.apiKey;
    console.log('[Background] API key received and stored:', storedApiKey ? `${storedApiKey.substring(0, 10)}...` : 'INVALID');
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
    console.log(`[Prisma Background] Capture ${captureEntry.timestamp}: ${captureEntry.diff ? captureEntry.diff.substring(0, 100) + '...' : 'No diff'}`);
    console.log(`[Prisma Background] Total captures stored: ${captureDataStore.length}`);
    
    // Feed data to Tandem processor for structured analysis
    if (tandemProcessor && captureEntry.diff && captureEntry.diff.trim()) {
      try {
        console.log(`[Tandem] Adding capture: "${captureEntry.diff.substring(0, 100)}..."`);
        tandemProcessor.addCaptureData(captureEntry);
      } catch (error) {
        console.error('[Tandem] Error adding capture data:', error);
        // Re-initialize if needed
        if (!tandemProcessor) {
          initializeProcessors();
        }
      }
    } else if (captureEntry.diff && captureEntry.diff.trim()) {
      // Try to initialize processor if it's not ready
      console.log(`[Tandem] Processor not ready, trying to initialize...`);
      if (!tandemProcessor) {
        initializeProcessors();
      }
    } else {
      console.log(`[Tandem] Skipping - no meaningful diff or processor not ready`);
    }
    
    sendResponse({ success: true });
  } else if (msg.type === 'GET_CAPTURE_HISTORY') {
    sendResponse({ success: true, data: captureDataStore });
  } else if (msg.type === 'CLEAR_CAPTURE_HISTORY') {
    captureDataStore = [];
    sendResponse({ success: true });
  } else if (msg.type === 'TRIGGER_AI_NOW') {
    // Manual trigger for immediate AI analysis
    handleManualAITrigger()
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
});

// Handle manual AI trigger from sidebar button
async function handleManualAITrigger() {
  console.group('🎯 [Manual Trigger] User Requested Immediate Tandem Inference');
  
  try {
    console.log('👤 User Action: Manual AI analysis requested');
    console.log('⏰ Trigger Time:', new Date().toISOString());
    
    if (!tandemProcessor || !prismaNudgeSystem) {
      console.error('❌ System Check Failed:', {
        tandemProcessor: !!tandemProcessor,
        prismaNudgeSystem: !!prismaNudgeSystem
      });
      throw new Error('AI systems not initialized');
    }
    
    if (!storedApiKey) {
      console.error('❌ API Key Check Failed: No Anthropic Prisma API key available');
      console.groupEnd();
      throw new Error('Anthropic Prisma API key not configured. Please check that the sidebar loaded properly and config.js contains a valid ANTHROPIC_API_KEY.');
    }
    
    console.log('✅ System Check Passed - Forcing batch processing...');
    
    // Force process current batch regardless of timing
    const forcedBatch = tandemProcessor.forceProcessBatch();
    
    if (!forcedBatch) {
      console.error('❌ No Data Available: No capture data to analyze');
      console.groupEnd();
      throw new Error('No data to analyze - try using the extension on a webpage first');
    }
    
    console.log('📦 Forced Batch Created:', {
      batchId: forcedBatch.batchId,
      entryCount: forcedBatch.rawEntryCount,
      textLength: forcedBatch.structuredText.length
    });
    
    console.log('🚀 Forcing Prisma Analysis (bypassing cooldowns)...');
    
    // Force Prisma analysis regardless of cooldowns
    const nudge = await prismaNudgeSystem.forceAnalyzeAndNudge(forcedBatch, storedApiKey);
    
    if (nudge) {
      console.log('✅ Manual Nudge Generated Successfully!');
      console.log('💬 Manual Nudge Details:', {
        text: nudge.text,
        level: nudge.level,
        timestamp: new Date(nudge.timestamp).toISOString(),
        analysisSignals: nudge.analysis.signalTypes,
        concerningSignals: nudge.analysis.concerningSignals,
        manualTrigger: true
      });
      
      // Send nudge to sidebar
      console.log('📤 Sending manual nudge to sidebar...');
      chrome.runtime.sendMessage({
        type: 'TANDEM_NUDGE',
        data: {
          message: nudge.text,
          level: nudge.level,
          timestamp: nudge.timestamp,
          analysis: nudge.analysis,
          manualTrigger: true
        }
      });
      
      console.groupEnd();
      return { success: true, nudgeGenerated: true, message: nudge.text };
    } else {
      console.log('⏭️ No manual nudge generated - conditions not met');
      console.groupEnd();
      return { success: true, nudgeGenerated: false, message: 'No nudge needed based on current activity' };
    }
    
  } catch (error) {
    console.error('❌ Manual Trigger Error:', error);
    console.error('🔍 Error Stack:', error.stack);
    console.groupEnd();
    throw error;
  }
}

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

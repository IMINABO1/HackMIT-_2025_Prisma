// tandem-processor.js - Structured data processing for AI analysis

class TandemProcessor {
  constructor() {
    this.rawCaptureData = [];
    this.structuredBatches = [];
    this.lastProcessTime = 0;
    this.lastActivityTime = 0;
    this.isProcessing = false;
    
    // Dynamic timing configuration
    this.timingConfig = {
      minWaitTime: 15000,      // Minimum 15 seconds (as per requirements)
      maxWaitTime: 45000,      // Maximum 45 seconds delay (as per requirements)
      typingPauseThreshold: 5000,  // 5 seconds of no typing = potential pause
      thoughtCompleteThreshold: 10000, // 10 seconds = thought might be complete
    };
    
    // Start dynamic batch processing
    this.startDynamicBatchProcessing();
  }

  // Add raw capture data
  addCaptureData(captureEntry) {
    const now = Date.now();
    this.rawCaptureData.push({
      ...captureEntry,
      receivedAt: now
    });
    
    // Update last activity time
    this.lastActivityTime = now;
    
    // Keep only last 2 minutes of raw data
    const twoMinutesAgo = now - (2 * 60 * 1000);
    this.rawCaptureData = this.rawCaptureData.filter(entry => 
      entry.receivedAt > twoMinutesAgo
    );
  }

  // Start dynamic batch processing based on activity patterns
  startDynamicBatchProcessing() {
    setInterval(() => {
      if (!this.isProcessing && this.rawCaptureData.length > 0) {
        const shouldProcess = this.shouldProcessBatch();
        if (shouldProcess) {
          console.log(`[Tandem] Processing batch - Reason: ${shouldProcess.reason}`);
          this.processBatch();
        }
      }
    }, 5000); // Check every 5 seconds for processing decisions
  }

  // Determine if we should process the current batch
  shouldProcessBatch() {
    const now = Date.now();
    const timeSinceLastProcess = now - this.lastProcessTime;
    const timeSinceLastActivity = now - this.lastActivityTime;
    
    // Always process if we've hit the maximum wait time
    if (timeSinceLastActivity >= this.timingConfig.maxWaitTime) {
      return { should: true, reason: 'Max wait time (45 seconds) reached' };
    }
    
    // Don't process if we haven't met minimum wait time
    if (timeSinceLastProcess < this.timingConfig.minWaitTime) {
      return false;
    }
    
    // Process if there's been a significant pause in typing (thought complete)
    if (timeSinceLastActivity >= this.timingConfig.thoughtCompleteThreshold) {
      return { should: true, reason: 'Thought appears complete (10s pause)' };
    }
    
    // Process if we detect a natural break in activity
    if (this.detectNaturalBreak()) {
      return { should: true, reason: 'Natural break detected' };
    }
    
    // Process if we have concerning signals that need immediate attention
    if (this.hasUrgentSignals()) {
      return { should: true, reason: 'Urgent signals detected' };
    }
    
    return false;
  }

  // Detect natural breaks in user activity
  detectNaturalBreak() {
    if (this.rawCaptureData.length < 3) return false;
    
    const recentEntries = this.rawCaptureData.slice(-5);
    const now = Date.now();
    
    // Look for patterns that suggest a natural stopping point
    const lastEntry = recentEntries[recentEntries.length - 1];
    
    // Check if last activity suggests completion
    if (lastEntry && lastEntry.diff) {
      const completionIndicators = [
        'done', 'finished', 'complete', 'solved', 'got it', 'understand now',
        'that works', 'perfect', 'success', 'correct'
      ];
      
      if (completionIndicators.some(indicator => 
        lastEntry.diff.toLowerCase().includes(indicator)
      )) {
        return true;
      }
    }
    
    // Check for context switches (URL changes)
    const urls = recentEntries.map(e => e.url).filter(Boolean);
    const uniqueUrls = new Set(urls);
    if (uniqueUrls.size > 1) {
      return true; // Context switch suggests natural break
    }
    
    return false;
  }

  // Check for urgent signals that need immediate processing
  hasUrgentSignals() {
    const recentEntries = this.rawCaptureData.slice(-3);
    let urgentCount = 0;
    
    recentEntries.forEach(entry => {
      if (entry.diff) {
        const text = entry.diff.toLowerCase();
        
        // High-priority urgent signals
        const urgentKeywords = [
          'error', 'stuck', 'help', 'confused', 'problem', 'issue',
          'broken', 'not working', 'failed', 'wrong'
        ];
        
        if (urgentKeywords.some(keyword => text.includes(keyword))) {
          urgentCount++;
        }
      }
    });
    
    return urgentCount >= 2; // Multiple urgent signals in recent activity
  }

  // Process current batch of data into structured format
  processBatch() {
    this.isProcessing = true;
    
    try {
      const now = Date.now();
      const batchData = this.rawCaptureData.filter(entry => 
        entry.receivedAt > this.lastProcessTime
      );
      
      if (batchData.length === 0) {
        this.isProcessing = false;
        return null;
      }

      const structuredBatch = this.createStructuredBatch(batchData);
      
      this.structuredBatches.push({
        batchId: `batch_${now}`,
        timestamp: now,
        structuredText: structuredBatch,
        rawEntryCount: batchData.length,
        timespan: this.calculateTimespan(batchData)
      });
      
      // Keep only last 10 batches
      if (this.structuredBatches.length > 10) {
        this.structuredBatches = this.structuredBatches.slice(-10);
      }
      
      this.lastProcessTime = now;
      
      console.log(`[Tandem] Processed batch with ${batchData.length} entries`);
      console.log(`[Tandem] Structured text length: ${structuredBatch.length} chars`);
      
      this.isProcessing = false;
      return this.structuredBatches[this.structuredBatches.length - 1];
      
    } catch (error) {
      console.error('[Tandem] Error processing batch:', error);
      this.isProcessing = false;
      return null;
    }
  }

  // Create structured text with special tags
  createStructuredBatch(batchData) {
    let structuredText = `<batch timestamp="${Date.now()}" entries="${batchData.length}">\n`;
    
    // Sort by timestamp
    const sortedData = batchData.sort((a, b) => 
      new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
    );
    
    let lastTimestamp = null;
    let cumulativeText = '';
    
    for (let i = 0; i < sortedData.length; i++) {
      const entry = sortedData[i];
      const currentTime = new Date(entry.capturedAt).getTime();
      
      // Calculate delay from previous entry
      if (lastTimestamp) {
        const delay = currentTime - lastTimestamp;
        if (delay > 5000) { // More than 5 seconds gap
          structuredText += `<delay time="${Math.round(delay/1000)}s" />\n`;
        }
      }
      
      // Process the diff to identify patterns
      const processedDiff = this.processDiff(entry.diff, entry.fullText);
      
      if (processedDiff.trim()) {
        structuredText += `<change timestamp="${entry.timestamp}">\n${processedDiff}\n</change>\n`;
      }
      
      lastTimestamp = currentTime;
      cumulativeText = entry.fullText || cumulativeText;
    }
    
    // Add context about current page
    const lastEntry = sortedData[sortedData.length - 1];
    if (lastEntry && lastEntry.url) {
      structuredText += `<context url="${this.sanitizeUrl(lastEntry.url)}" />\n`;
    }
    
    // Add behavioral analysis tags
    const behaviorTags = this.analyzeBehaviorPatterns(sortedData);
    structuredText += behaviorTags;
    
    structuredText += `</batch>`;
    
    return structuredText;
  }

  // Process individual diff with special tags
  processDiff(diff, fullText) {
    if (!diff) return '';
    
    let processed = diff;
    
    // Handle deletion patterns
    const deletePattern = /\[DELETED:\s*([^\]]+)\]/g;
    processed = processed.replace(deletePattern, '<deleted>$1</deleted>');
    
    // Handle change patterns
    const changePattern = /\[CHANGED:\s*"([^"]+)"\s*→\s*"([^"]+)"\]/g;
    processed = processed.replace(changePattern, '<changed from="$1" to="$2" />');
    
    // Detect repetitive patterns
    if (this.isRepetitiveContent(processed)) {
      processed = `<repetitive>${processed}</repetitive>`;
    }
    
    // Detect error keywords
    if (this.containsErrorKeywords(processed)) {
      processed = `<error_signal>${processed}</error_signal>`;
    }
    
    // Detect confusion keywords
    if (this.containsConfusionKeywords(processed)) {
      processed = `<confusion_signal>${processed}</confusion_signal>`;
    }
    
    // Detect search patterns
    if (this.isSearchActivity(processed)) {
      processed = `<search_activity>${processed}</search_activity>`;
    }
    
    // Detect mathematical content
    if (this.isMathematicalContent(processed)) {
      processed = `<mathematical_content>${processed}</mathematical_content>`;
    }
    
    // Detect potential incorrect answers
    if (this.hasIncorrectMathAnswer(processed)) {
      processed = `<incorrect_answer_signal>${processed}</incorrect_answer_signal>`;
    }
    
    return processed;
  }

  // Analyze behavioral patterns across the batch
  analyzeBehaviorPatterns(batchData) {
    let behaviorTags = '';
    
    // Context switching detection
    const urls = new Set(batchData.map(entry => entry.url).filter(Boolean));
    if (urls.size > 3) {
      behaviorTags += `<behavior type="context_switching" count="${urls.size}" />\n`;
    }
    
    // Rapid fire changes detection
    const rapidChanges = batchData.filter(entry => entry.diff && entry.diff.length < 50);
    if (rapidChanges.length > 5) {
      behaviorTags += `<behavior type="rapid_changes" count="${rapidChanges.length}" />\n`;
    }
    
    // Time spent analysis
    const timespan = this.calculateTimespan(batchData);
    if (timespan > 60000) { // More than 1 minute on same general content
      behaviorTags += `<behavior type="prolonged_focus" duration="${Math.round(timespan/1000)}s" />\n`;
    }
    
    // Error frequency
    const errorCount = batchData.filter(entry => 
      this.containsErrorKeywords(entry.diff)
    ).length;
    if (errorCount > 2) {
      behaviorTags += `<behavior type="frequent_errors" count="${errorCount}" />\n`;
    }
    
    return behaviorTags;
  }

  // Helper functions
  isRepetitiveContent(text) {
    if (!text || text.length < 20) return false;
    
    // Simple repetition detection
    const words = text.toLowerCase().split(/\s+/);
    const wordCounts = {};
    let maxCount = 0;
    
    words.forEach(word => {
      if (word.length > 3) {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
        maxCount = Math.max(maxCount, wordCounts[word]);
      }
    });
    
    return maxCount > words.length * 0.3; // More than 30% repetition
  }

  containsErrorKeywords(text) {
    if (!text) return false;
    const errorKeywords = ['error', 'problem', 'issue', 'stuck', 'failed', 'wrong', 'broken'];
    return errorKeywords.some(keyword => 
      text.toLowerCase().includes(keyword)
    );
  }

  containsConfusionKeywords(text) {
    if (!text) return false;
    const confusionKeywords = ['confused', 'dont understand', "don't get", 'lost', 'help', 'unclear'];
    return confusionKeywords.some(keyword => 
      text.toLowerCase().includes(keyword)
    );
  }

  isSearchActivity(text) {
    if (!text) return false;
    const searchKeywords = ['search', 'find', 'looking for', 'query', 'google', 'stack overflow'];
    return searchKeywords.some(keyword => 
      text.toLowerCase().includes(keyword)
    );
  }

  isMathematicalContent(text) {
    if (!text) return false;
    const mathKeywords = [
      'probability', 'calculate', 'dice', 'roll', 'fraction', 'answer is',
      'equation', 'formula', 'solve', 'result', 'solution', 'theorem'
    ];
    const fractionPattern = /\b\d+\/\d+\b/;
    const mathSymbols = /[=+\-*/()^√∫∑∏]/;
    
    return mathKeywords.some(keyword => text.toLowerCase().includes(keyword)) ||
           fractionPattern.test(text) ||
           mathSymbols.test(text);
  }

  hasIncorrectMathAnswer(text) {
    if (!text) return false;
    
    // Specific incorrect patterns for dice problems
    const incorrectDiceAnswers = ['1/89', '1/90', '1/88', '2/89'];
    
    // General suspicious patterns
    const suspiciousPatterns = [
      /answer is 0\b/i,
      /answer is 1\b/i,
      /\b1\/89\b/,  // The specific wrong answer from screenshot
      /divide by 0/i
    ];
    
    return incorrectDiceAnswers.some(answer => text.includes(answer)) ||
           suspiciousPatterns.some(pattern => pattern.test(text));
  }

  sanitizeUrl(url) {
    try {
      const urlObj = new URL(url);
      return `${urlObj.hostname}${urlObj.pathname}`;
    } catch {
      return url.substring(0, 50);
    }
  }

  calculateTimespan(batchData) {
    if (batchData.length < 2) return 0;
    
    const times = batchData.map(entry => new Date(entry.capturedAt).getTime());
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    return maxTime - minTime;
  }

  // Get the latest structured batch for Claude
  getLatestStructuredBatch() {
    return this.structuredBatches[this.structuredBatches.length - 1];
  }

  // Get recent structured batches for context
  getRecentBatches(count = 3) {
    return this.structuredBatches.slice(-count);
  }

  // Get statistics for debugging
  getStats() {
    return {
      rawDataCount: this.rawCaptureData.length,
      structuredBatchCount: this.structuredBatches.length,
      lastProcessTime: new Date(this.lastProcessTime).toISOString(),
      isProcessing: this.isProcessing
    };
  }

  // Force process current batch (for manual triggers)
  forceProcessBatch() {
    if (this.rawCaptureData.length === 0) {
      console.log('[Tandem] No data to force process');
      return null;
    }
    
    console.log('[Tandem] Force processing batch with', this.rawCaptureData.length, 'entries');
    
    // Temporarily bypass timing checks
    const originalLastProcessTime = this.lastProcessTime;
    this.lastProcessTime = 0; // Reset to allow processing
    
    const batch = this.processBatch();
    
    // Restore original timing
    this.lastProcessTime = originalLastProcessTime;
    
    return batch;
  }

  // Reset processor
  reset() {
    this.rawCaptureData = [];
    this.structuredBatches = [];
    this.lastProcessTime = 0;
    this.isProcessing = false;
  }
}

// Export as ES module
export { TandemProcessor };

// ai-analyzer.js - AI system for detecting rabbit holes and triggering interventions

class AIAnalyzer {
  constructor() {
    this.captureHistory = [];
    this.analysisConfig = {
      rabbitHoleThresholds: {
        maxTimeWithoutProgress: 30000, // 30 seconds for testing (was 5 minutes)
        repetitivePatternCount: 3, // Number of similar actions that indicate repetition (was 5)
        contextSwitchThreshold: 5, // Too many context switches (was 10)
        errorKeywords: ['error', 'problem', 'issue', 'stuck', 'confused', 'help'],
        progressKeywords: ['solution', 'answer', 'correct', 'success', 'done', 'complete']
      },
      interventionCooldown: 30000, // 30 seconds between interventions for testing (was 3 minutes)
      lastInterventionTime: 0
    };
    this.behaviorPatterns = {
      repetitiveSearch: [],
      contextSwitches: [],
      errorIndicators: [],
      timeSpentOnTopic: new Map()
    };
  }

  // Main analysis function called when new capture data arrives
  analyzeBehaviorPattern(newCaptureEntry) {
    try {
      this.captureHistory.push(newCaptureEntry);
      
      // Keep only recent history (last 30 minutes)
      const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
      this.captureHistory = this.captureHistory.filter(entry => 
        new Date(entry.capturedAt).getTime() > thirtyMinutesAgo
      );

      // Analyze different patterns
      const analysisResult = {
        rabbitHoleIndicators: this.detectRabbitHolePatterns(),
        interventionRecommended: false,
        interventionType: null,
        confidence: 0,
        reason: ''
      };

      // Determine if intervention is needed
      const shouldIntervene = this.shouldTriggerIntervention(analysisResult.rabbitHoleIndicators);
      
      if (shouldIntervene) {
        analysisResult.interventionRecommended = true;
        analysisResult.interventionType = this.selectInterventionType(analysisResult.rabbitHoleIndicators);
        analysisResult.confidence = this.calculateConfidence(analysisResult.rabbitHoleIndicators);
        analysisResult.reason = this.generateInterventionReason(analysisResult.rabbitHoleIndicators);
      }

      return analysisResult;
    } catch (error) {
      console.error('[AI Analyzer] Error analyzing behavior:', error);
      return { error: error.message };
    }
  }

  // Detect various rabbit hole patterns
  detectRabbitHolePatterns() {
    const indicators = {
      repetitiveSearching: this.detectRepetitiveSearching(),
      excessiveContextSwitching: this.detectExcessiveContextSwitching(),
      timeWithoutProgress: this.detectTimeWithoutProgress(),
      errorPatterns: this.detectErrorPatterns(),
      confusionKeywords: this.detectConfusionKeywords(),
      circularBehavior: this.detectCircularBehavior()
    };

    return indicators;
  }

  // Detect if user is repeatedly searching similar terms
  detectRepetitiveSearching() {
    const recentEntries = this.captureHistory.slice(-10);
    const searchPatterns = [];
    
    recentEntries.forEach(entry => {
      if (entry.diff && this.containsSearchTerms(entry.diff)) {
        searchPatterns.push(this.extractSearchTerms(entry.diff));
      }
    });

    // Check for similar search patterns
    const similarityCount = this.countSimilarPatterns(searchPatterns);
    return {
      detected: similarityCount >= this.analysisConfig.rabbitHoleThresholds.repetitivePatternCount,
      count: similarityCount,
      patterns: searchPatterns
    };
  }

  // Detect excessive context switching between topics/pages
  detectExcessiveContextSwitching() {
    const recentEntries = this.captureHistory.slice(-15);
    const urlChanges = [];
    let lastUrl = '';

    recentEntries.forEach(entry => {
      if (entry.url && entry.url !== lastUrl) {
        urlChanges.push(entry.url);
        lastUrl = entry.url;
      }
    });

    return {
      detected: urlChanges.length >= this.analysisConfig.rabbitHoleThresholds.contextSwitchThreshold,
      count: urlChanges.length,
      urls: urlChanges
    };
  }

  // Detect if user has been stuck for too long without progress
  detectTimeWithoutProgress() {
    const now = Date.now();
    let lastProgressTime = now;
    
    // Look for progress indicators in reverse chronological order
    for (let i = this.captureHistory.length - 1; i >= 0; i--) {
      const entry = this.captureHistory[i];
      if (this.containsProgressIndicators(entry.diff)) {
        lastProgressTime = new Date(entry.capturedAt).getTime();
        break;
      }
    }

    const timeWithoutProgress = now - lastProgressTime;
    return {
      detected: timeWithoutProgress >= this.analysisConfig.rabbitHoleThresholds.maxTimeWithoutProgress,
      duration: timeWithoutProgress,
      lastProgressTime: new Date(lastProgressTime).toISOString()
    };
  }

  // Detect error-related patterns
  detectErrorPatterns() {
    const recentEntries = this.captureHistory.slice(-10);
    let errorCount = 0;
    const errorTexts = [];

    recentEntries.forEach(entry => {
      if (entry.diff && this.containsErrorKeywords(entry.diff)) {
        errorCount++;
        errorTexts.push(entry.diff);
      }
    });

    return {
      detected: errorCount >= 3,
      count: errorCount,
      errorTexts: errorTexts
    };
  }

  // Detect confusion-indicating keywords
  detectConfusionKeywords() {
    const confusionKeywords = ['confused', 'stuck', 'help', 'dont understand', "don't get", 'lost'];
    const recentEntries = this.captureHistory.slice(-5);
    let confusionCount = 0;

    recentEntries.forEach(entry => {
      if (entry.diff) {
        confusionKeywords.forEach(keyword => {
          if (entry.diff.toLowerCase().includes(keyword)) {
            confusionCount++;
          }
        });
      }
    });

    return {
      detected: confusionCount >= 2,
      count: confusionCount
    };
  }

  // Detect circular behavior (going back to same content)
  detectCircularBehavior() {
    const recentEntries = this.captureHistory.slice(-20);
    const contentHashes = new Map();
    let circularCount = 0;

    recentEntries.forEach(entry => {
      if (entry.fullText) {
        const hash = this.simpleHash(entry.fullText.substring(0, 200));
        if (contentHashes.has(hash)) {
          circularCount++;
        } else {
          contentHashes.set(hash, 1);
        }
      }
    });

    return {
      detected: circularCount >= 3,
      count: circularCount
    };
  }

  // Helper functions
  containsSearchTerms(text) {
    const searchIndicators = ['search', 'find', 'looking for', 'query', 'results'];
    return searchIndicators.some(indicator => text.toLowerCase().includes(indicator));
  }

  extractSearchTerms(text) {
    // Simple extraction - could be enhanced with NLP
    const words = text.toLowerCase().split(/\s+/);
    return words.filter(word => word.length > 3 && !['search', 'find', 'looking', 'query'].includes(word));
  }

  countSimilarPatterns(patterns) {
    let similarCount = 0;
    for (let i = 0; i < patterns.length; i++) {
      for (let j = i + 1; j < patterns.length; j++) {
        if (this.calculateSimilarity(patterns[i], patterns[j]) > 0.7) {
          similarCount++;
        }
      }
    }
    return similarCount;
  }

  calculateSimilarity(pattern1, pattern2) {
    if (!pattern1 || !pattern2) return 0;
    const intersection = pattern1.filter(term => pattern2.includes(term));
    const union = [...new Set([...pattern1, ...pattern2])];
    return intersection.length / union.length;
  }

  containsProgressIndicators(text) {
    if (!text) return false;
    return this.analysisConfig.rabbitHoleThresholds.progressKeywords.some(keyword => 
      text.toLowerCase().includes(keyword)
    );
  }

  containsErrorKeywords(text) {
    if (!text) return false;
    return this.analysisConfig.rabbitHoleThresholds.errorKeywords.some(keyword => 
      text.toLowerCase().includes(keyword)
    );
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }

  // Determine if intervention should be triggered
  shouldTriggerIntervention(indicators) {
    const now = Date.now();
    
    // Check cooldown period
    if (now - this.analysisConfig.lastInterventionTime < this.analysisConfig.interventionCooldown) {
      return false;
    }

    // Count how many indicators are triggered
    const triggeredCount = Object.values(indicators).filter(indicator => indicator.detected).length;
    
    // Trigger if any indicator is present (for testing)
    return triggeredCount >= 1;
  }

  // Select appropriate intervention type
  selectInterventionType(indicators) {
    if (indicators.timeWithoutProgress.detected && indicators.errorPatterns.detected) {
      return 'error_guidance';
    } else if (indicators.repetitiveSearching.detected) {
      return 'refocus_suggestion';
    } else if (indicators.excessiveContextSwitching.detected) {
      return 'consolidation_help';
    } else if (indicators.confusionKeywords.detected) {
      return 'confusion_clarification';
    } else if (indicators.circularBehavior.detected) {
      return 'break_suggestion';
    } else {
      return 'general_guidance';
    }
  }

  // Calculate confidence score for intervention
  calculateConfidence(indicators) {
    let confidence = 0;
    const weights = {
      timeWithoutProgress: 0.3,
      repetitiveSearching: 0.2,
      errorPatterns: 0.25,
      confusionKeywords: 0.15,
      excessiveContextSwitching: 0.1
    };

    Object.entries(indicators).forEach(([key, indicator]) => {
      if (indicator.detected && weights[key]) {
        confidence += weights[key];
      }
    });

    return Math.min(confidence, 1.0);
  }

  // Generate human-readable reason for intervention
  generateInterventionReason(indicators) {
    const reasons = [];
    
    if (indicators.timeWithoutProgress.detected) {
      reasons.push(`You've been working on this for ${Math.round(indicators.timeWithoutProgress.duration / 60000)} minutes without clear progress`);
    }
    
    if (indicators.repetitiveSearching.detected) {
      reasons.push(`You've searched for similar terms ${indicators.repetitiveSearching.count} times recently`);
    }
    
    if (indicators.errorPatterns.detected) {
      reasons.push(`I noticed ${indicators.errorPatterns.count} error-related indicators`);
    }
    
    if (indicators.confusionKeywords.detected) {
      reasons.push(`You've expressed confusion or being stuck`);
    }
    
    if (indicators.excessiveContextSwitching.detected) {
      reasons.push(`You've switched between ${indicators.excessiveContextSwitching.count} different contexts`);
    }

    return reasons.join('; ');
  }

  // Generate AI intervention prompt
  generateInterventionPrompt(analysisResult, recentContext) {
    const basePrompt = `You are an AI study copilot. The student appears to be in a rabbit hole. `;
    
    let contextPrompt = `Analysis shows: ${analysisResult.reason}. `;
    
    if (recentContext && recentContext.length > 0) {
      const recentText = recentContext.slice(-3).map(entry => entry.diff).join(' ');
      contextPrompt += `Recent activity: "${recentText.substring(0, 500)}". `;
    }

    let interventionPrompt = '';
    
    switch (analysisResult.interventionType) {
      case 'error_guidance':
        interventionPrompt = `Provide specific guidance to help them overcome the error or obstacle they're facing. Be encouraging and offer concrete next steps.`;
        break;
      case 'refocus_suggestion':
        interventionPrompt = `Suggest they refocus their approach. They seem to be repeating similar searches. Help them think about the problem differently.`;
        break;
      case 'consolidation_help':
        interventionPrompt = `They're jumping between too many contexts. Help them consolidate their learning and focus on one concept at a time.`;
        break;
      case 'confusion_clarification':
        interventionPrompt = `They've expressed confusion. Ask clarifying questions to understand what specifically is confusing them, then provide targeted help.`;
        break;
      case 'break_suggestion':
        interventionPrompt = `They seem to be going in circles. Suggest taking a break or approaching the problem from a different angle.`;
        break;
      default:
        interventionPrompt = `Provide gentle guidance to help them get back on track with their learning.`;
    }

    return basePrompt + contextPrompt + interventionPrompt + ` Keep your response concise (2-3 sentences) and actionable.`;
  }

  // Mark that an intervention was triggered
  markInterventionTriggered() {
    this.analysisConfig.lastInterventionTime = Date.now();
  }

  // Reset analysis state
  reset() {
    this.captureHistory = [];
    this.behaviorPatterns = {
      repetitiveSearch: [],
      contextSwitches: [],
      errorIndicators: [],
      timeSpentOnTopic: new Map()
    };
    this.analysisConfig.lastInterventionTime = 0;
  }
}

// Make available globally for service workers (no window object)
if (typeof globalThis !== 'undefined') {
  globalThis.AIAnalyzer = AIAnalyzer;
} else if (typeof self !== 'undefined') {
  self.AIAnalyzer = AIAnalyzer;
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIAnalyzer;
}

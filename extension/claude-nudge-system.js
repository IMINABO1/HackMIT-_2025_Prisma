// claude-nudge-system.js - Claude-based nudging with escalation system

class ClaudeNudgeSystem {
  constructor() {
    this.nudgeHistory = [];
    this.interferenceLevel = 0; // 0: no nudges, 1: gentle nudges, 2: stronger hints, 3: full interference
    this.lastNudgeTime = 0;
    this.nudgeCooldowns = {
      0: 30000,  // 30 seconds between first nudges
      1: 45000,  // 45 seconds between gentle nudges
      2: 60000,  // 1 minute between stronger hints
      3: 90000   // 1.5 minutes between full interference
    };
    this.escalationThresholds = {
      toLevel1: 2,    // 2 concerning signals = gentle nudge
      toLevel2: 4,    // 4 concerning signals = stronger hint
      toLevel3: 6     // 6 concerning signals = full interference
    };
  }

  // Analyze structured batch from Tandem and decide on nudging
  analyzeAndNudge(structuredBatch, apiKey) {
    console.group('🧠 [Claude Nudge Analysis] Starting Analysis Pipeline');
    console.log('📥 Input Batch:', structuredBatch);
    console.log('🔑 API Key Available:', !!apiKey);
    
    if (!structuredBatch || !apiKey) {
      console.error('❌ Missing Required Data:', { 
        hasBatch: !!structuredBatch, 
        hasApiKey: !!apiKey 
      });
      console.groupEnd();
      return null;
    }

    try {
      // Analyze the structured text for concerning patterns
      console.log('🔍 Analyzing structured text for patterns...');
      const analysis = this.analyzeStructuredText(structuredBatch.structuredText);
      console.log('📊 Pattern Analysis Results:', analysis);

      // Update interference level based on analysis
      console.log('📈 Updating interference level...');
      const oldLevel = this.interferenceLevel;
      this.updateInterferenceLevel(analysis);
      console.log('🎚️ Interference Level:', { 
        previous: oldLevel, 
        current: this.interferenceLevel,
        changed: oldLevel !== this.interferenceLevel
      });

      // Check if we should nudge
      const shouldNudge = this.shouldNudge(analysis);
      console.log('🤔 Should Nudge Decision:', {
        shouldNudge,
        concerningSignals: analysis.concerningSignals,
        timeSinceLastNudge: Date.now() - this.lastNudgeTime,
        cooldownPeriod: this.nudgeCooldowns[this.interferenceLevel]
      });

      if (shouldNudge) {
        console.log('✅ Proceeding with nudge generation...');
        const result = this.generateNudge(structuredBatch, analysis, apiKey);
        console.groupEnd();
        return result;
      }

      console.log('⏭️ No nudge needed at this time');
      console.groupEnd();
      return null;
    } catch (error) {
      console.error('❌ Analysis Pipeline Error:', error);
      console.groupEnd();
      return null;
    }
  }

  // Analyze structured text for concerning patterns
  analyzeStructuredText(structuredText) {
    const analysis = {
      concerningSignals: 0,
      signalTypes: [],
      urgency: 'low',
      patterns: {
        hasErrors: false,
        hasConfusion: false,
        hasRepetition: false,
        hasLongDelays: false,
        hasContextSwitching: false,
        hasFrequentErrors: false,
        hasProlongedFocus: false,
        hasMathematicalContent: false,
        hasPotentialIncorrectAnswer: false
      }
    };

    // Check for error signals
    if (structuredText.includes('<error_signal>')) {
      analysis.concerningSignals++;
      analysis.signalTypes.push('errors');
      analysis.patterns.hasErrors = true;
    }

    // Check for confusion signals
    if (structuredText.includes('<confusion_signal>')) {
      analysis.concerningSignals += 2; // Confusion is more concerning
      analysis.signalTypes.push('confusion');
      analysis.patterns.hasConfusion = true;
    }

    // Check for repetitive content
    if (structuredText.includes('<repetitive>')) {
      analysis.concerningSignals++;
      analysis.signalTypes.push('repetition');
      analysis.patterns.hasRepetition = true;
    }

    // Check for long delays (indicates stuckness)
    const delayMatches = structuredText.match(/<delay time="(\d+)s"/g);
    if (delayMatches) {
      const longDelays = delayMatches.filter(match => {
        const seconds = parseInt(match.match(/(\d+)s/)[1]);
        return seconds > 30;
      });
      if (longDelays.length > 0) {
        analysis.concerningSignals++;
        analysis.signalTypes.push('long_delays');
        analysis.patterns.hasLongDelays = true;
      }
    }

    // Check behavioral patterns
    if (structuredText.includes('type="context_switching"')) {
      analysis.concerningSignals++;
      analysis.signalTypes.push('context_switching');
      analysis.patterns.hasContextSwitching = true;
    }

    if (structuredText.includes('type="frequent_errors"')) {
      analysis.concerningSignals += 2;
      analysis.signalTypes.push('frequent_errors');
      analysis.patterns.hasFrequentErrors = true;
    }

    if (structuredText.includes('type="prolonged_focus"')) {
      // This could be good or bad depending on context
      const durationMatch = structuredText.match(/duration="(\d+)s"/);
      if (durationMatch && parseInt(durationMatch[1]) > 300) { // More than 5 minutes
        analysis.concerningSignals++;
        analysis.signalTypes.push('prolonged_focus');
        analysis.patterns.hasProlongedFocus = true;
      }
    }

    // Check for mathematical content and potential errors
    const mathPatterns = this.detectMathematicalContent(structuredText);
    if (mathPatterns.hasMathContent) {
      analysis.patterns.hasMathematicalContent = true;
      
      if (mathPatterns.hasIncorrectAnswer) {
        analysis.concerningSignals += 2; // Mathematical errors are concerning
        analysis.signalTypes.push('incorrect_math');
        analysis.patterns.hasPotentialIncorrectAnswer = true;
      }
    }

    // Check for incorrect answer signals from tandem processor
    if (structuredText.includes('<incorrect_answer_signal>')) {
      analysis.concerningSignals += 3; // Incorrect answers are very concerning
      analysis.signalTypes.push('incorrect_answer');
      analysis.patterns.hasPotentialIncorrectAnswer = true;
    }

    // Determine urgency
    if (analysis.concerningSignals >= 6) {
      analysis.urgency = 'high';
    } else if (analysis.concerningSignals >= 3) {
      analysis.urgency = 'medium';
    }

    return analysis;
  }

  // Update interference level based on analysis
  updateInterferenceLevel(analysis) {
    const { concerningSignals } = analysis;

    if (concerningSignals >= this.escalationThresholds.toLevel3) {
      this.interferenceLevel = Math.max(this.interferenceLevel, 3);
    } else if (concerningSignals >= this.escalationThresholds.toLevel2) {
      this.interferenceLevel = Math.max(this.interferenceLevel, 2);
    } else if (concerningSignals >= this.escalationThresholds.toLevel1) {
      this.interferenceLevel = Math.max(this.interferenceLevel, 1);
    }

    // Decay interference level over time if no recent issues
    const now = Date.now();
    if (now - this.lastNudgeTime > 300000 && concerningSignals < 2) { // 5 minutes with low signals
      this.interferenceLevel = Math.max(0, this.interferenceLevel - 1);
    }
  }

  // Check if we should nudge based on cooldowns and analysis
  shouldNudge(analysis) {
    const now = Date.now();
    const cooldown = this.nudgeCooldowns[this.interferenceLevel] || 30000;

    // Must have concerning signals and be past cooldown
    return analysis.concerningSignals > 0 && 
           (now - this.lastNudgeTime) > cooldown;
  }

  // Generate appropriate nudge based on interference level
  async generateNudge(structuredBatch, analysis, apiKey) {
    const now = Date.now();
    
    try {
      const prompt = this.buildClaudePrompt(structuredBatch, analysis);
      const nudgeText = await this.callClaude(prompt, apiKey);
      
      const nudge = {
        id: `nudge_${now}`,
        timestamp: now,
        level: this.interferenceLevel,
        text: nudgeText,
        analysis: analysis,
        batchId: structuredBatch.batchId
      };

      this.nudgeHistory.push(nudge);
      this.lastNudgeTime = now;

      // Keep only last 20 nudges
      if (this.nudgeHistory.length > 20) {
        this.nudgeHistory = this.nudgeHistory.slice(-20);
      }

      console.log(`[Claude Nudge] Generated level ${this.interferenceLevel} nudge`);
      return nudge;

    } catch (error) {
      console.error('[Claude Nudge] Error generating nudge:', error);
      return null;
    }
  }

  // Detect mathematical content and potential errors
  detectMathematicalContent(structuredText) {
    const result = {
      hasMathContent: false,
      hasIncorrectAnswer: false,
      mathType: null
    };

    // Mathematical indicators
    const mathKeywords = [
      'probability', 'calculate', 'dice', 'roll', 'fraction', 'answer is',
      'equation', 'formula', 'solve', 'result', 'solution', 'theorem',
      'proof', 'derivative', 'integral', 'matrix', 'vector', 'function'
    ];

    const hasMathKeywords = mathKeywords.some(keyword => 
      structuredText.toLowerCase().includes(keyword)
    );

    // Fraction patterns (like 1/89, 5/36, etc.)
    const fractionPattern = /\b\d+\/\d+\b/g;
    const fractions = structuredText.match(fractionPattern) || [];

    // Mathematical expressions
    const mathExpressions = /[=+\-*/()^√∫∑∏]/g;
    const hasMathSymbols = mathExpressions.test(structuredText);

    if (hasMathKeywords || fractions.length > 0 || hasMathSymbols) {
      result.hasMathContent = true;

      // Specific checks for dice probability problems
      if (structuredText.toLowerCase().includes('dice') || 
          structuredText.toLowerCase().includes('roll')) {
        result.mathType = 'probability';
        
        // Check for common incorrect dice probability answers
        const suspiciousFractions = ['1/89', '1/90', '1/88', '2/89'];
        const hasIncorrectDiceAnswer = suspiciousFractions.some(fraction => 
          structuredText.includes(fraction)
        );
        
        if (hasIncorrectDiceAnswer) {
          result.hasIncorrectAnswer = true;
        }
      }

      // Check for other mathematical error patterns
      const errorPatterns = [
        /answer is 0\b/i,  // Probability of 0 is often wrong
        /answer is 1\b/i,  // Probability of 1 is often wrong (unless certain)
        /\b1\/89\b/,       // Specific incorrect answer from the screenshot
        /divide by 0/i,    // Division by zero
        /infinity/i        // Infinity as an answer (often wrong)
      ];

      if (errorPatterns.some(pattern => pattern.test(structuredText))) {
        result.hasIncorrectAnswer = true;
      }
    }

    return result;
  }

  // Build prompt for Claude based on interference level and analysis
  buildClaudePrompt(structuredBatch, analysis) {
    const { structuredText } = structuredBatch;
    const { interferenceLevel, signalTypes, urgency } = { ...analysis, interferenceLevel: this.interferenceLevel };

    let basePrompt = `You are Tandem DeepSeek, an AI study companion that monitors real-time learning activity. Your job is to either give helpful hints when the user is struggling OR stay completely silent when they're doing fine.

CRITICAL RULES:
1. If the user is making progress or doing well, respond with exactly: "SILENT" (nothing else)
2. Only give hints when there are clear signs of struggle, confusion, or errors
3. When you do give hints, be specific and actionable, not generic encouragement
4. Focus on the actual content/problem they're working on

Real-time learning data: ${structuredText}

Detected concerning signals: ${signalTypes.join(', ')}
Urgency level: ${urgency}

`;

    switch (this.interferenceLevel) {
      case 1: // Gentle nudge
        basePrompt += `Give a specific, actionable hint based on what you see (1 sentence). Focus on the actual content/problem, not generic encouragement. Examples:
- "Try console.log() to see what value that variable actually contains."
- "Check if you're missing a closing bracket or semicolon."
- "For dice probability, remember there are 6×6=36 total possible outcomes."
- "Double-check your calculation - does that fraction make sense for this problem?"

Your response (be specific to their situation):`;
        break;

      case 2: // Stronger hint
        basePrompt += `Provide a concrete suggestion based on their specific situation (1-2 sentences). Give actual technical advice, not motivation. Examples:
- "That TypeError means the variable is undefined. Check where you declared it and if it's in scope."
- "You're getting a 404 error because the URL path is wrong. Double-check the endpoint spelling."
- "For two dice rolls, the sample space has 36 outcomes, not 89. Try listing all possibilities where first < second."
- "That probability doesn't look right - check if you're counting favorable outcomes correctly."

Your response (give specific technical guidance):`;
        break;

      case 3: // Full interference
        basePrompt += `They're really stuck. Give specific, step-by-step technical help (2-3 sentences). Address their exact problem, not general advice. Examples:
- "Your loop is infinite because you're not incrementing the counter. Add i++ inside the loop."
- "The API call is failing because you need to add 'Content-Type: application/json' to your headers."
- "For dice probability: First roll can be 1,2,3,4,5 and second must be greater. Count: (1,2-6)=5 + (2,3-6)=4 + ... = 15 outcomes out of 36 total."
- "The answer 1/89 is incorrect because there are only 36 possible outcomes when rolling two dice, not 89."

Your response (specific technical solution):`;
        break;

      default:
        basePrompt += `Analyze the activity. If they're doing fine, respond "SILENT". If they need help, give a brief specific hint (1 sentence). Your response:`;
    }

    return basePrompt;
  }

  // Call Anthropic Claude API
  async callClaude(prompt, apiKey) {
    const startTime = Date.now();
    const requestId = `req_${startTime}`;
    
    console.group(`🤖 [Claude Inference ${requestId}] Starting API Call`);
    console.log('📝 Full Prompt Input:', prompt);
    console.log('🔑 API Key Status:', apiKey ? `✅ Present (${apiKey.substring(0, 10)}...)` : '❌ MISSING');
    console.log('⏰ Request Time:', new Date().toISOString());
    
    try {
      const requestBody = {
        model: "claude-3-haiku-20240307",
        max_tokens: 150,
        messages: [{ role: "user", content: prompt }]
      };
      
      console.log('📦 Request Body:', JSON.stringify(requestBody, null, 2));
      console.log('🌐 API Endpoint:', "https://api.anthropic.com/v1/messages");
      
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify(requestBody)
      });

      const responseTime = Date.now() - startTime;
      console.log(`⚡ Response Time: ${responseTime}ms`);
      console.log('📊 Response Status:', response.status, response.statusText);
      console.log('📋 Response Headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error Response Body:', errorText);
        console.groupEnd();
        throw new Error(`Claude API Error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Raw API Response:', JSON.stringify(result, null, 2));
      
      if (!result.content || !result.content[0] || !result.content[0].text) {
        console.error('❌ Invalid Response Structure:', 'Missing content/text in API response');
        console.groupEnd();
        throw new Error('Invalid response format from Claude API');
      }
      
      let responseText = result.content[0].text.trim();
      console.log('🎯 Extracted AI Response:', responseText);
      
      // Handle SILENT responses
      if (responseText.toUpperCase() === 'SILENT') {
        console.log('🤫 Claude chose to stay silent - no intervention needed');
        console.groupEnd();
        return null; // Return null to indicate no nudge should be shown
      }
      
      // Log token usage if available
      if (result.usage) {
        console.log('📊 Token Usage:', {
          prompt_tokens: result.usage.prompt_tokens,
          completion_tokens: result.usage.completion_tokens,
          total_tokens: result.usage.total_tokens
        });
      }
      
      // Filter out generic/annoying responses
      const genericPhrases = [
        "It's great that you're practicing",
        "Keep up the consistent effort",
        "don't hesitate to reach out",
        "That's a key part of the learning process",
        "You're doing well",
        "Great job",
        "Keep going",
        "You've got this"
      ];
      
      const isGeneric = genericPhrases.some(phrase => 
        responseText.toLowerCase().includes(phrase.toLowerCase())
      );
      
      if (isGeneric) {
        console.warn('⚠️ Generic Response Detected - Using Fallback');
        console.log('🔄 Original Generic Response:', responseText);
        
        // Return a more direct fallback based on the level
        if (this.interferenceLevel >= 3) {
          responseText = "Check the error message carefully - it usually tells you exactly what's wrong.";
        } else if (this.interferenceLevel >= 2) {
          responseText = "Try breaking the problem into smaller steps.";
        } else {
          responseText = "Take a step back and review what you're trying to accomplish.";
        }
        console.log('🎯 Fallback Response:', responseText);
      }
      
      console.log('✅ Final Processed Response:', responseText);
      console.log(`⏱️ Total Inference Time: ${Date.now() - startTime}ms`);
      console.groupEnd();
      
      return responseText;
      
    } catch (error) {
      console.error('❌ Claude API Request Failed:', error);
      console.error('🔍 Error Details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      console.groupEnd();
      throw error;
    }
  }

  // Get recent nudges for context
  getRecentNudges(count = 5) {
    return this.nudgeHistory.slice(-count);
  }

  // Get current status
  getStatus() {
    return {
      interferenceLevel: this.interferenceLevel,
      lastNudgeTime: new Date(this.lastNudgeTime).toISOString(),
      nudgeCount: this.nudgeHistory.length,
      timeSinceLastNudge: Date.now() - this.lastNudgeTime
    };
  }

  // Force analyze and nudge (for manual triggers)
  async forceAnalyzeAndNudge(structuredBatch, apiKey) {
    if (!structuredBatch || !apiKey) {
      console.log('[Claude Nudge] Missing batch or API key for forced analysis');
      return null;
    }

    try {
      console.log('[Claude Nudge] Force analyzing batch:', structuredBatch.batchId);
      
      // Analyze the structured text
      const analysis = this.analyzeStructuredText(structuredBatch.structuredText);
      console.log('[Claude Nudge] Forced analysis:', analysis);

      // Temporarily bypass cooldowns and generate nudge
      const originalLastNudgeTime = this.lastNudgeTime;
      this.lastNudgeTime = 0; // Reset to bypass cooldown
      
      // Force at least level 1 interference for manual triggers
      if (this.interferenceLevel === 0) {
        this.interferenceLevel = 1;
      }
      
      // Use forced prompting for manual triggers
      const nudge = await this.generateForcedNudge(structuredBatch, analysis, apiKey);
      
      // Restore original timing but don't reset interference level
      this.lastNudgeTime = originalLastNudgeTime;
      
      if (nudge) {
        nudge.manualTrigger = true;
        console.log(`[Claude Nudge] Forced nudge generated: "${nudge.text}"`);
      }
      
      return nudge;

    } catch (error) {
      console.error('[Claude Nudge] Error in forced analysis:', error);
      return null;
    }
  }

  // Generate forced nudge (Claude must respond, not stay silent)
  async generateForcedNudge(structuredBatch, analysis, apiKey) {
    const now = Date.now();
    
    try {
      const prompt = this.buildForcedClaudePrompt(structuredBatch, analysis);
      const nudgeText = await this.callClaude(prompt, apiKey);
      
      // If Claude still tries to be silent, give a default encouraging response
      const finalText = nudgeText || "Keep doing what you're doing - you're on the right track!";
      
      const nudge = {
        id: `forced_nudge_${now}`,
        timestamp: now,
        level: this.interferenceLevel,
        text: finalText,
        analysis: analysis,
        batchId: structuredBatch.batchId,
        forced: true
      };

      this.nudgeHistory.push(nudge);
      this.lastNudgeTime = now;

      // Keep only last 20 nudges
      if (this.nudgeHistory.length > 20) {
        this.nudgeHistory = this.nudgeHistory.slice(-20);
      }

      console.log(`[Claude Nudge] Generated forced nudge`);
      return nudge;

    } catch (error) {
      console.error('[Claude Nudge] Error generating forced nudge:', error);
      return null;
    }
  }

  // Build forced prompt where Claude must give a response
  buildForcedClaudePrompt(structuredBatch, analysis) {
    const { structuredText } = structuredBatch;
    const { signalTypes, urgency } = analysis;

    return `You are Tandem DeepSeek, an AI study companion. The user has MANUALLY requested your input, so you MUST provide a helpful response (you cannot stay silent).

Real-time learning data: ${structuredText}

Detected signals: ${signalTypes.join(', ')}
Urgency level: ${urgency}

Since this is a manual request, you must either:
1. Give a specific hint if you see any areas for improvement
2. Give encouragement like "Keep doing what you're doing - you're on the right track!" if they're doing well

Your response (you MUST respond, do not say SILENT):`;
  }

  // Reset system
  reset() {
    this.nudgeHistory = [];
    this.interferenceLevel = 0;
    this.lastNudgeTime = 0;
  }
}

// Export as ES module
export { ClaudeNudgeSystem };

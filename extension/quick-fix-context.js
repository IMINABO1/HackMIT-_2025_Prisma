// quick-fix-context.js - Quick fix to add conversation context for testing
// Run this in the browser console when your extension is open

console.log('🔧 Quick Fix: Adding conversation context...');

// Add test conversation history
const testConversation = [
  {
    question: "What's the probability that the first die roll is less than the second when rolling two dice?",
    response: "Let me help you with this probability problem. We need to count favorable outcomes where the first roll is less than the second roll.",
    timestamp: Date.now() - 300000,
    isFollowUp: false
  },
  {
    question: "I'm still confused about how to count the outcomes",
    response: "Let's break it down systematically. If the first die shows 1, the second can be 2,3,4,5,6 (5 outcomes). If first shows 2, second can be 3,4,5,6 (4 outcomes). Continue this pattern...",
    timestamp: Date.now() - 120000,
    isFollowUp: false
  }
];

// Add test memories
const testMemories = [
  {
    id: 'test-1',
    content: "I struggle with probability calculations, especially with dice problems",
    metadata: { category: 'weakness' }
  },
  {
    id: 'test-2', 
    content: "I learn best with step-by-step explanations and concrete examples",
    metadata: { category: 'strength' }
  }
];

// Add intervention context
const testIntervention = {
  message: "It looks like you're struggling with calculating probability. Try breaking it down step-by-step - first calculate the probability of rolling each individual number on the first die, then consider how that affects the probabilities for the second die.",
  level: 2,
  manualTrigger: false
};

// Store in chrome storage
if (typeof chrome !== 'undefined' && chrome.storage) {
  chrome.storage.local.set({ 
    conversationHistory: testConversation 
  }, () => {
    console.log('✅ Added test conversation history');
  });
  
  // Set intervention context globally
  window.currentInterventionData = testIntervention;
  console.log('✅ Added intervention context');
  
  console.log('🎯 Now try asking: "tell me a bit more" in the extension');
  console.log('Expected: Specific help with probability dice problem, not generic response');
} else {
  console.error('❌ Chrome extension API not available');
}

// Function to test the prompt that would be generated
function testPromptGeneration() {
  const question = "tell me a bit more";
  
  const prompt = `You are helping a student who just asked for more help after you gave them a hint.

CONTEXT: You previously told them: "${testIntervention.message}"

STUDENT'S FOLLOW-UP: "${question}"

RECENT CONVERSATION:
${testConversation.map((exchange, i) => 
  `${i+1}. Student: "${exchange.question}"\n   You: "${exchange.response.substring(0, 150)}..."`
).join('\n')}

STUDENT PROFILE:
${testMemories.map(m => `• [${m.metadata.category.toUpperCase()}] ${m.content}`).join('\n')}

INSTRUCTIONS:
- This is a direct follow-up to your previous hint
- Give specific, actionable help related to their original problem
- If they were struggling with probability/math, show step-by-step calculations
- Be concise but thorough (2-3 sentences max)
- Don't repeat generic advice - give concrete next steps

Specific help:`;

  console.log('🧪 Test prompt that should be generated:');
  console.log(prompt);
  
  return prompt;
}

// Make test function available
window.testPromptGeneration = testPromptGeneration;

console.log('🔧 Quick fix complete! Try the extension now.');
console.log('💡 Run testPromptGeneration() to see the expected prompt.');

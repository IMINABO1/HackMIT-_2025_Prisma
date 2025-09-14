# Claude AI Integration Setup

## 🎯 What You Get Now

The chat is now powered by **real Claude AI** instead of hardcoded responses! Claude will:

- **Analyze your mind map** and understand topic connections
- **Give specific critiques** and actionable improvements  
- **Ask targeted follow-up questions** to identify your exact problems
- **Remember conversation context** through the memory system
- **Provide personalized tutoring** based on your learning journey

## 🛠️ Quick Setup

### 1. Install Dependencies
```bash
cd backend
npm install @anthropic-ai/sdk
```

### 2. Set Your API Key
Create a `.env` file in the `backend/` directory:
```env
ANTHROPIC_API_KEY=your-claude-api-key-here
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-key
OPENAI_API_KEY=your-openai-key
```

### 3. Start the Backend
```bash
cd backend
node memory-api.js
```

### 4. Start the Frontend
```bash
cd web
python -m http.server 8080
```

## 🔥 Test the Real Claude Chat

Visit `http://localhost:8080/chat.html` and try:

- **"I'm struggling with probability"**
- **"My calculus issues"** 
- **"Help me improve my algebra"**
- **"What should I focus on next?"**

Claude will give you **real, personalized feedback** instead of generic responses!

## 🧠 How It Works

1. **You ask a question** → Frontend sends to `/api/chat/ask`
2. **Backend gets your mind map** + **searches relevant memories**
3. **Claude receives context**: Your topics, connections, past struggles
4. **Claude responds intelligently** with critiques and targeted help
5. **Conversation gets stored** as memory for future context

## ⚡ Fallback Mode

If the backend isn't running, you'll get a helpful message. The mind map and dashboard still work with fallback data, but Claude chat requires the backend + API key.

## 🎓 Example Claude Responses

Instead of hardcoded responses, Claude now gives dynamic, personalized advice like:

> "I see you're working on probability! Looking at your mind map, this connects to both calculus and statistics. What specific aspect is tripping you up - is it the conceptual understanding of conditional probability, or are you getting stuck on the computational side when solving problems? I'd love to pinpoint exactly where to focus your practice..."

Much better than the old generic responses! 🚀

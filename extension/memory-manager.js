// memory-manager.js - Client-side memory management for AI Study Copilot
// Inspired by Mem0 architecture for stateful AI interactions

class MemoryManager {
  constructor() {
    this.apiBaseUrl = 'http://localhost:3000/api'; // Backend API URL
    this.userId = this.getUserId();
    this.memoryCache = new Map(); // Local cache for recent memories
    this.maxCacheSize = 100;
  }

  // Get or generate user ID
  getUserId() {
    let userId = localStorage.getItem('ai_copilot_user_id');
    if (!userId) {
      userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('ai_copilot_user_id', userId);
    }
    return userId;
  }

  // Add a new memory
  async addMemory(content, metadata = {}) {
    try {
      const memoryData = {
        content: content,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          source: 'extension',
          userId: this.userId
        }
      };

      const response = await fetch(`${this.apiBaseUrl}/memory/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(memoryData)
      });

      if (!response.ok) {
        throw new Error(`Memory API error: ${response.status}`);
      }

      const result = await response.json();
      
      // Cache the memory locally
      this.cacheMemory(result.memory);
      
      console.log('[Memory] Added successfully:', result.memory.id);
      return result.memory;
    } catch (error) {
      console.error('[Memory] Error adding memory:', error);
      // Fallback to local storage if API is unavailable
      return this.addMemoryLocal(content, metadata);
    }
  }

  // Search for relevant memories
  async searchMemories(query, limit = 5) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/memory/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query,
          userId: this.userId,
          limit: limit
        })
      });

      if (!response.ok) {
        throw new Error(`Memory search error: ${response.status}`);
      }

      const result = await response.json();
      console.log(`[Memory] Found ${result.memories.length} relevant memories for query: "${query}"`);
      return result.memories;
    } catch (error) {
      console.error('[Memory] Error searching memories:', error);
      // Fallback to local search
      return this.searchMemoriesLocal(query, limit);
    }
  }

  // Get all memories for a user
  async getAllMemories() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/memory/user/${this.userId}`);
      
      if (!response.ok) {
        throw new Error(`Memory fetch error: ${response.status}`);
      }

      const result = await response.json();
      return result.memories;
    } catch (error) {
      console.error('[Memory] Error fetching all memories:', error);
      return this.getAllMemoriesLocal();
    }
  }

  // Update a memory
  async updateMemory(memoryId, updates) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/memory/${memoryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...updates,
          userId: this.userId
        })
      });

      if (!response.ok) {
        throw new Error(`Memory update error: ${response.status}`);
      }

      const result = await response.json();
      this.cacheMemory(result.memory);
      return result.memory;
    } catch (error) {
      console.error('[Memory] Error updating memory:', error);
      return null;
    }
  }

  // Delete a memory
  async deleteMemory(memoryId) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/memory/${memoryId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: this.userId })
      });

      if (!response.ok) {
        throw new Error(`Memory delete error: ${response.status}`);
      }

      // Remove from cache
      this.memoryCache.delete(memoryId);
      console.log('[Memory] Deleted successfully:', memoryId);
      return true;
    } catch (error) {
      console.error('[Memory] Error deleting memory:', error);
      return false;
    }
  }

  // Get memories relevant to current context
  async getContextualMemories(context) {
    const { url, pageTitle, selectedText, recentActivity } = context;
    
    // Build search queries based on context
    const queries = [];
    
    if (selectedText) {
      queries.push(selectedText);
    }
    
    if (pageTitle) {
      queries.push(pageTitle);
    }
    
    if (recentActivity && recentActivity.length > 0) {
      queries.push(recentActivity.join(' '));
    }

    // Search for memories related to each query
    const allMemories = [];
    for (const query of queries) {
      const memories = await this.searchMemories(query, 3);
      allMemories.push(...memories);
    }

    // Remove duplicates and return top memories
    const uniqueMemories = this.deduplicateMemories(allMemories);
    return uniqueMemories.slice(0, 6);
  }

  // Cache management
  cacheMemory(memory) {
    if (this.memoryCache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }
    this.memoryCache.set(memory.id, memory);
  }

  deduplicateMemories(memories) {
    const seen = new Set();
    return memories.filter(memory => {
      if (seen.has(memory.id)) {
        return false;
      }
      seen.add(memory.id);
      return true;
    });
  }

  // Local storage fallbacks (for offline use)
  addMemoryLocal(content, metadata) {
    const memories = this.getLocalMemories();
    const memory = {
      id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      content: content,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        source: 'extension_local',
        userId: this.userId
      },
      relevanceScore: 1.0
    };
    
    memories.push(memory);
    localStorage.setItem('ai_copilot_memories', JSON.stringify(memories));
    return memory;
  }

  searchMemoriesLocal(query, limit = 5) {
    const memories = this.getLocalMemories();
    const queryLower = query.toLowerCase();
    
    // Simple text matching for local search
    const scored = memories.map(memory => ({
      ...memory,
      relevanceScore: this.calculateLocalRelevance(memory.content, queryLower)
    }));
    
    return scored
      .filter(memory => memory.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }

  getAllMemoriesLocal() {
    return this.getLocalMemories();
  }

  getLocalMemories() {
    const stored = localStorage.getItem('ai_copilot_memories');
    return stored ? JSON.parse(stored) : [];
  }

  calculateLocalRelevance(content, query) {
    const contentLower = content.toLowerCase();
    const words = query.split(' ').filter(word => word.length > 2);
    
    let score = 0;
    for (const word of words) {
      if (contentLower.includes(word)) {
        score += 1;
      }
    }
    
    return score / Math.max(words.length, 1);
  }

  // Memory categories for better organization
  categorizeMemory(content) {
    const categories = {
      'learning_preference': /prefer|like|dislike|better at|good at|struggle with/i,
      'fact': /remember that|important|key point|note that/i,
      'concept': /concept|theory|principle|rule|formula/i,
      'problem_solving': /solution|approach|method|strategy|technique/i,
      'error_pattern': /mistake|error|wrong|confused about|misunderstood/i
    };

    for (const [category, pattern] of Object.entries(categories)) {
      if (pattern.test(content)) {
        return category;
      }
    }
    
    return 'general';
  }

  // Format memories for AI context
  formatMemoriesForAI(memories) {
    if (!memories || memories.length === 0) {
      return '';
    }

    const formatted = memories.map((memory, index) => {
      const category = memory.metadata?.category || 'general';
      const timestamp = new Date(memory.metadata?.timestamp || Date.now()).toLocaleDateString();
      return `[Memory ${index + 1}] (${category}, ${timestamp}): ${memory.content}`;
    });

    return `\nRelevant memories:\n${formatted.join('\n')}\n`;
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MemoryManager;
} else if (typeof window !== 'undefined') {
  window.MemoryManager = MemoryManager;
}

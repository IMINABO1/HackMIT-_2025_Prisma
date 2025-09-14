// memory-client.js - Client for local memory API
// Easy integration with your extension

import { LOCAL_MEMORY_API_URL, DEFAULT_USER_ID } from './config.js';

class MemoryClient {
  constructor(userId = DEFAULT_USER_ID) {
    this.baseUrl = LOCAL_MEMORY_API_URL;
    this.userId = userId;
  }

  // Add a memory (user preference, fact, etc.)
  async addMemory(content, metadata = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/api/memory/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          metadata: {
            ...metadata,
            userId: this.userId,
            source: 'extension',
            url: window.location.href,
            timestamp: new Date().toISOString()
          }
        })
      });
      
      const result = await response.json();
      if (result.success) {
        console.log('[Memory] Added:', result.memory.id);
        return result.memory;
      } else {
        throw new Error(result.error || 'Failed to add memory');
      }
    } catch (error) {
      console.error('[Memory] Add failed:', error);
      throw error;
    }
  }

  // Search memories for context
  async searchMemories(query, limit = 5) {
    try {
      const response = await fetch(`${this.baseUrl}/api/memory/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          userId: this.userId,
          limit
        })
      });
      
      const result = await response.json();
      if (result.success) {
        console.log(`[Memory] Found ${result.memories.length} memories for: "${query}"`);
        return result.memories;
      } else {
        throw new Error(result.error || 'Search failed');
      }
    } catch (error) {
      console.error('[Memory] Search failed:', error);
      return []; // Return empty array on failure
    }
  }

  // Get contextual memories based on current page/selection
  async getContextualMemories(context = {}) {
    try {
      const contextData = {
        url: window.location.href,
        pageTitle: document.title,
        selectedText: window.getSelection().toString(),
        ...context
      };

      const response = await fetch(`${this.baseUrl}/api/memory/context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: contextData,
          userId: this.userId,
          limit: 6
        })
      });
      
      const result = await response.json();
      if (result.success) {
        console.log(`[Memory] Found ${result.memories.length} contextual memories`);
        return result.memories;
      } else {
        throw new Error(result.error || 'Context search failed');
      }
    } catch (error) {
      console.error('[Memory] Context search failed:', error);
      return [];
    }
  }

  // Add a note
  async addNote(content, metadata = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/api/notes/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          metadata: {
            ...metadata,
            userId: this.userId,
            url: window.location.href,
            pageTitle: document.title,
            timestamp: new Date().toISOString()
          }
        })
      });
      
      const result = await response.json();
      if (result.success) {
        console.log('[Memory] Note added:', result.note.id);
        return result.note;
      } else {
        throw new Error(result.error || 'Failed to add note');
      }
    } catch (error) {
      console.error('[Memory] Add note failed:', error);
      throw error;
    }
  }

  // Get user's notes
  async getNotes(limit = 20) {
    try {
      const response = await fetch(`${this.baseUrl}/api/notes/user/${this.userId}?limit=${limit}`);
      const result = await response.json();
      
      if (result.success) {
        return result.notes;
      } else {
        throw new Error(result.error || 'Failed to get notes');
      }
    } catch (error) {
      console.error('[Memory] Get notes failed:', error);
      return [];
    }
  }

  // Add mind map node
  async addMindMapNode(label, metadata = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/api/mindmap/node`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label,
          metadata: {
            ...metadata,
            userId: this.userId
          }
        })
      });
      
      const result = await response.json();
      if (result.success) {
        console.log('[Memory] Mind map node added:', result.node.id);
        return result.node;
      } else {
        throw new Error(result.error || 'Failed to add node');
      }
    } catch (error) {
      console.error('[Memory] Add node failed:', error);
      throw error;
    }
  }

  // Get user's mind map
  async getMindMap() {
    try {
      const response = await fetch(`${this.baseUrl}/api/mindmap/user/${this.userId}`);
      const result = await response.json();
      
      if (result.success) {
        return result.mindmap;
      } else {
        throw new Error(result.error || 'Failed to get mind map');
      }
    } catch (error) {
      console.error('[Memory] Get mind map failed:', error);
      return { nodes: [], edges: [] };
    }
  }

  // Check if memory system is available
  async isAvailable() {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const result = await response.json();
      return result.status === 'healthy';
    } catch (error) {
      console.warn('[Memory] System unavailable:', error.message);
      return false;
    }
  }

  // Helper: Remember user preference
  async rememberPreference(preference, category = 'learning_preference') {
    return this.addMemory(preference, { category });
  }

  // Helper: Remember important fact
  async rememberFact(fact, category = 'fact') {
    return this.addMemory(fact, { category });
  }

  // Helper: Remember user strength
  async rememberStrength(strength) {
    return this.addMemory(`I am good at ${strength}`, { category: 'strength' });
  }

  // Helper: Remember user weakness
  async rememberWeakness(weakness) {
    return this.addMemory(`I struggle with ${weakness}`, { category: 'weakness' });
  }
}

// Create global instance
const memoryClient = new MemoryClient();

// Export for use in other scripts
export default memoryClient;
export { MemoryClient };

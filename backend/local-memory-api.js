// local-memory-api.js - Backend API using local file storage instead of Supabase
// Drop-in replacement for memory-api.js with identical API endpoints

const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const LocalMemoryStorage = require('./local-memory-storage');

class LocalMemoryAPI {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    
    // Initialize local storage
    this.storage = new LocalMemoryStorage('./data');
    
    // Initialize OpenAI for embeddings (optional - can work without it)
    this.openai = process.env.OPENAI_API_KEY ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    }) : null;
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));
    
    // Request logging
    this.app.use((req, res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        storage: 'local',
        openai_enabled: !!this.openai
      });
    });

    // Memory routes (same API as Supabase version)
    this.app.post('/api/memory/add', this.addMemory.bind(this));
    this.app.post('/api/memory/search', this.searchMemories.bind(this));
    this.app.get('/api/memory/user/:userId', this.getUserMemories.bind(this));
    this.app.put('/api/memory/:memoryId', this.updateMemory.bind(this));
    this.app.delete('/api/memory/:memoryId', this.deleteMemory.bind(this));
    
    // Batch operations
    this.app.post('/api/memory/batch/add', this.addMemoriesBatch.bind(this));
    this.app.post('/api/memory/context', this.getContextualMemories.bind(this));
    
    // Notes routes
    this.app.post('/api/notes/add', this.addNote.bind(this));
    this.app.get('/api/notes/user/:userId', this.getUserNotes.bind(this));
    this.app.put('/api/notes/:noteId', this.updateNote.bind(this));
    this.app.delete('/api/notes/:noteId', this.deleteNote.bind(this));
    
    // Mindmap routes
    this.app.post('/api/mindmap/node', this.addMindmapNode.bind(this));
    this.app.post('/api/mindmap/edge', this.addMindmapEdge.bind(this));
    this.app.get('/api/mindmap/user/:userId', this.getUserMindmap.bind(this));
    
    // Utility routes
    this.app.get('/api/stats/user/:userId', this.getUserStats.bind(this));
    this.app.post('/api/backup', this.createBackup.bind(this));
    this.app.post('/api/restore', this.restoreBackup.bind(this));
  }

  // Memory operations
  async addMemory(req, res) {
    try {
      const { content, metadata = {} } = req.body;
      
      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: 'Content is required' });
      }

      const userId = metadata.userId || 'default_user';
      
      // Generate embedding if OpenAI is available
      let embedding = null;
      if (this.openai) {
        try {
          embedding = await this.generateEmbedding(content);
        } catch (error) {
          console.warn('[Local Memory API] Could not generate embedding:', error.message);
        }
      }
      
      // Categorize the memory
      const category = this.categorizeMemory(content);
      
      // Prepare memory data
      const memoryMetadata = {
        ...metadata,
        category: category,
        timestamp: new Date().toISOString(),
        source: metadata.source || 'api',
        embedding: embedding
      };

      const memory = await this.storage.addMemory(content, memoryMetadata, userId);

      console.log(`[Local Memory API] Added memory: ${memory.id} for user: ${userId}`);
      res.json({ 
        success: true, 
        memory: {
          id: memory.id,
          content: memory.content,
          metadata: memory.metadata,
          category: memory.metadata.category,
          timestamp: memory.created_at
        }
      });

    } catch (error) {
      console.error('[Local Memory API] Error adding memory:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async searchMemories(req, res) {
    try {
      const { query, userId, limit = 5 } = req.body;
      
      if (!query || !userId) {
        return res.status(400).json({ error: 'Query and userId are required' });
      }

      let memories = [];
      
      if (this.openai) {
        // Use vector similarity search if OpenAI is available
        try {
          const queryEmbedding = await this.generateEmbedding(query);
          memories = await this.storage.searchMemories(queryEmbedding, userId, 0.7, limit);
        } catch (error) {
          console.warn('[Local Memory API] Vector search failed, falling back to text search:', error.message);
          memories = await this.textSearchMemories(query, userId, limit);
        }
      } else {
        // Fall back to simple text search
        memories = await this.textSearchMemories(query, userId, limit);
      }

      const formattedMemories = memories.map(item => ({
        id: item.id,
        content: item.content,
        metadata: item.metadata,
        relevanceScore: item.similarity || 1.0,
        timestamp: item.created_at
      }));

      console.log(`[Local Memory API] Found ${formattedMemories.length} memories for query: "${query}"`);
      res.json({ success: true, memories: formattedMemories });

    } catch (error) {
      console.error('[Local Memory API] Error searching memories:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getUserMemories(req, res) {
    try {
      const { userId } = req.params;
      const { limit = 50, offset = 0, category } = req.query;

      const result = await this.storage.getUserMemories(
        userId, 
        parseInt(limit), 
        parseInt(offset), 
        category
      );

      const formattedMemories = result.memories.map(item => ({
        id: item.id,
        content: item.content,
        metadata: item.metadata,
        timestamp: item.created_at
      }));

      res.json({ 
        success: true, 
        memories: formattedMemories, 
        total: result.total 
      });

    } catch (error) {
      console.error('[Local Memory API] Error getting user memories:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async updateMemory(req, res) {
    try {
      const { memoryId } = req.params;
      const { content, metadata, userId } = req.body;

      const updates = {};

      if (content) {
        updates.content = content.trim();
        updates.metadata = {
          ...metadata,
          category: this.categorizeMemory(content)
        };
        
        // Update embedding if OpenAI is available
        if (this.openai) {
          try {
            updates.embedding = await this.generateEmbedding(content);
          } catch (error) {
            console.warn('[Local Memory API] Could not update embedding:', error.message);
          }
        }
      } else if (metadata) {
        updates.metadata = metadata;
      }

      const memory = await this.storage.updateMemory(memoryId, updates, userId);

      res.json({ 
        success: true, 
        memory: {
          id: memory.id,
          content: memory.content,
          metadata: memory.metadata,
          timestamp: memory.updated_at
        }
      });

    } catch (error) {
      if (error.message === 'Memory not found') {
        return res.status(404).json({ error: 'Memory not found' });
      }
      console.error('[Local Memory API] Error updating memory:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async deleteMemory(req, res) {
    try {
      const { memoryId } = req.params;
      const { userId } = req.body;

      await this.storage.deleteMemory(memoryId, userId);
      res.json({ success: true });

    } catch (error) {
      if (error.message === 'Memory not found') {
        return res.status(404).json({ error: 'Memory not found' });
      }
      console.error('[Local Memory API] Error deleting memory:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async addMemoriesBatch(req, res) {
    try {
      const { memories, userId } = req.body;
      
      if (!Array.isArray(memories) || memories.length === 0) {
        return res.status(400).json({ error: 'Memories array is required' });
      }

      const processedMemories = [];
      
      for (const memory of memories) {
        let embedding = null;
        if (this.openai) {
          try {
            embedding = await this.generateEmbedding(memory.content);
          } catch (error) {
            console.warn('[Local Memory API] Could not generate embedding for batch item:', error.message);
          }
        }
        
        const category = this.categorizeMemory(memory.content);
        
        processedMemories.push({
          content: memory.content.trim(),
          embedding: embedding,
          metadata: {
            ...memory.metadata,
            category: category,
            timestamp: new Date().toISOString(),
            source: 'batch'
          }
        });
      }

      const result = await this.storage.addMemoriesBatch(processedMemories, userId);
      res.json({ success: true, count: result.length, memories: result });

    } catch (error) {
      console.error('[Local Memory API] Error in batch add:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getContextualMemories(req, res) {
    try {
      const { context, userId, limit = 6 } = req.body;
      const { url, pageTitle, selectedText, recentActivity } = context;

      // Build search queries from context
      const queries = [];
      if (selectedText) queries.push(selectedText);
      if (pageTitle) queries.push(pageTitle);
      if (recentActivity && recentActivity.length > 0) {
        queries.push(recentActivity.join(' '));
      }

      const allMemories = [];
      
      // Search for each query
      for (const query of queries) {
        let memories = [];
        
        if (this.openai) {
          try {
            const queryEmbedding = await this.generateEmbedding(query);
            memories = await this.storage.searchMemories(queryEmbedding, userId, 0.6, 3);
          } catch (error) {
            memories = await this.textSearchMemories(query, userId, 3);
          }
        } else {
          memories = await this.textSearchMemories(query, userId, 3);
        }
        
        allMemories.push(...memories);
      }

      // Deduplicate and sort by relevance
      const uniqueMemories = this.deduplicateMemories(allMemories);
      const topMemories = uniqueMemories.slice(0, limit);

      const formattedMemories = topMemories.map(item => ({
        id: item.id,
        content: item.content,
        metadata: item.metadata,
        relevanceScore: item.similarity || 1.0,
        timestamp: item.created_at
      }));

      res.json({ success: true, memories: formattedMemories });

    } catch (error) {
      console.error('[Local Memory API] Error getting contextual memories:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Notes operations
  async addNote(req, res) {
    try {
      const { content, metadata = {} } = req.body;
      const userId = metadata.userId || 'default_user';
      
      const note = await this.storage.addNote(content, metadata, userId);
      res.json({ success: true, note });
    } catch (error) {
      console.error('[Local Memory API] Error adding note:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getUserNotes(req, res) {
    try {
      const { userId } = req.params;
      const { limit = 50, offset = 0 } = req.query;
      
      const notes = await this.storage.getUserNotes(userId, parseInt(limit), parseInt(offset));
      res.json({ success: true, notes });
    } catch (error) {
      console.error('[Local Memory API] Error getting notes:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async updateNote(req, res) {
    try {
      const { noteId } = req.params;
      const { userId, ...updates } = req.body;
      
      const note = await this.storage.updateNote(noteId, updates, userId);
      res.json({ success: true, note });
    } catch (error) {
      if (error.message === 'Note not found') {
        return res.status(404).json({ error: 'Note not found' });
      }
      console.error('[Local Memory API] Error updating note:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async deleteNote(req, res) {
    try {
      const { noteId } = req.params;
      const { userId } = req.body;
      
      await this.storage.deleteNote(noteId, userId);
      res.json({ success: true });
    } catch (error) {
      if (error.message === 'Note not found') {
        return res.status(404).json({ error: 'Note not found' });
      }
      console.error('[Local Memory API] Error deleting note:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Mindmap operations
  async addMindmapNode(req, res) {
    try {
      const { label, metadata = {} } = req.body;
      const userId = metadata.userId || 'default_user';
      
      const node = await this.storage.addMindmapNode(label, metadata, userId);
      res.json({ success: true, node });
    } catch (error) {
      console.error('[Local Memory API] Error adding mindmap node:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async addMindmapEdge(req, res) {
    try {
      const { sourceNodeId, targetNodeId, metadata = {} } = req.body;
      const userId = metadata.userId || 'default_user';
      
      const edge = await this.storage.addMindmapEdge(sourceNodeId, targetNodeId, metadata, userId);
      res.json({ success: true, edge });
    } catch (error) {
      console.error('[Local Memory API] Error adding mindmap edge:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getUserMindmap(req, res) {
    try {
      const { userId } = req.params;
      
      const mindmap = await this.storage.getUserMindmap(userId);
      res.json({ success: true, mindmap });
    } catch (error) {
      console.error('[Local Memory API] Error getting mindmap:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Utility operations
  async getUserStats(req, res) {
    try {
      const { userId } = req.params;
      
      const stats = await this.storage.getMemoryStats(userId);
      res.json({ success: true, stats });
    } catch (error) {
      console.error('[Local Memory API] Error getting stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async createBackup(req, res) {
    try {
      const backupFile = await this.storage.createBackup();
      res.json({ success: true, backupFile });
    } catch (error) {
      console.error('[Local Memory API] Error creating backup:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async restoreBackup(req, res) {
    try {
      const { backupFile } = req.body;
      
      await this.storage.restoreFromBackup(backupFile);
      res.json({ success: true });
    } catch (error) {
      console.error('[Local Memory API] Error restoring backup:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Helper methods
  async generateEmbedding(text) {
    if (!this.openai) {
      throw new Error('OpenAI not configured');
    }
    
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    
    return response.data[0].embedding;
  }

  // Simple text-based search fallback
  async textSearchMemories(query, userId, limit = 5) {
    const { memories } = await this.storage.getUserMemories(userId, 1000, 0);
    const queryLower = query.toLowerCase();
    
    const results = memories
      .map(memory => {
        const contentLower = memory.content.toLowerCase();
        let score = 0;
        
        // Exact match gets highest score
        if (contentLower.includes(queryLower)) {
          score = 1.0;
        } else {
          // Word overlap scoring
          const queryWords = queryLower.split(/\s+/);
          const contentWords = contentLower.split(/\s+/);
          const overlap = queryWords.filter(word => contentWords.includes(word));
          score = overlap.length / queryWords.length;
        }
        
        return {
          ...memory,
          similarity: score
        };
      })
      .filter(result => result.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
    
    return results;
  }

  categorizeMemory(content) {
    const categories = {
      'learning_preference': /prefer|like|dislike|better at|good at|struggle with/i,
      'fact': /remember that|important|key point|note that|fact/i,
      'concept': /concept|theory|principle|rule|formula|definition/i,
      'problem_solving': /solution|approach|method|strategy|technique|solve/i,
      'error_pattern': /mistake|error|wrong|confused about|misunderstood/i,
      'strength': /good at|strong in|excel at|understand well/i,
      'weakness': /struggle with|difficult|hard to understand|confusing/i
    };

    for (const [category, pattern] of Object.entries(categories)) {
      if (pattern.test(content)) {
        return category;
      }
    }
    
    return 'general';
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

  async start() {
    try {
      await this.storage.init();
      this.app.listen(this.port, () => {
        console.log(`[Local Memory API] Server running on port ${this.port}`);
        console.log(`[Local Memory API] Health check: http://localhost:${this.port}/health`);
        console.log(`[Local Memory API] Storage: Local files in ./data/`);
        console.log(`[Local Memory API] OpenAI embeddings: ${this.openai ? 'Enabled' : 'Disabled (using text search)'}`);
      });
    } catch (error) {
      console.error('[Local Memory API] Failed to start:', error);
      process.exit(1);
    }
  }
}

// Create and start the server
if (require.main === module) {
  const memoryAPI = new LocalMemoryAPI();
  memoryAPI.start();
}

module.exports = LocalMemoryAPI;

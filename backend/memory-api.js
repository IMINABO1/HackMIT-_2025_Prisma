// memory-api.js - Backend API for memory management using Mem0-inspired architecture
// Handles persistent memory storage with vector embeddings for semantic search

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');

class MemoryAPI {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    
    // Initialize Supabase client
    this.supabase = createClient(
      process.env.SUPABASE_URL || 'your-supabase-url',
      process.env.SUPABASE_ANON_KEY || 'your-supabase-anon-key'
    );
    
    // Initialize OpenAI for embeddings
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'your-openai-key'
    });
    
    // Initialize Anthropic for chat
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || 'your-anthropic-key'
    });
    
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
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // Memory routes
    this.app.post('/api/memory/add', this.addMemory.bind(this));
    this.app.post('/api/memory/search', this.searchMemories.bind(this));
    this.app.get('/api/memory/user/:userId', this.getUserMemories.bind(this));
    this.app.put('/api/memory/:memoryId', this.updateMemory.bind(this));
    this.app.delete('/api/memory/:memoryId', this.deleteMemory.bind(this));
    
    // Batch operations
    this.app.post('/api/memory/batch/add', this.addMemoriesBatch.bind(this));
    this.app.post('/api/memory/context', this.getContextualMemories.bind(this));
    
    // Chat endpoints
    this.app.post('/api/chat/ask', this.handleChatQuery.bind(this));
    this.app.get('/api/mindmap/all', this.getMindMap.bind(this));
    this.app.get('/api/metrics', this.getMetrics.bind(this));
  }

  // Add a new memory with vector embedding
  async addMemory(req, res) {
    try {
      const { content, metadata = {} } = req.body;
      
      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: 'Content is required' });
      }

      // Generate embedding for semantic search
      const embedding = await this.generateEmbedding(content);
      
      // Categorize the memory
      const category = this.categorizeMemory(content);
      
      // Prepare memory data
      const memoryData = {
        content: content.trim(),
        embedding: embedding,
        metadata: {
          ...metadata,
          category: category,
          timestamp: new Date().toISOString(),
          source: metadata.source || 'api'
        },
        user_id: metadata.userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Insert into Supabase
      const { data, error } = await this.supabase
        .from('memories')
        .insert([memoryData])
        .select()
        .single();

      if (error) {
        console.error('[Memory API] Supabase error:', error);
        return res.status(500).json({ error: 'Failed to store memory' });
      }

      console.log(`[Memory API] Added memory: ${data.id} for user: ${data.user_id}`);
      res.json({ 
        success: true, 
        memory: {
          id: data.id,
          content: data.content,
          metadata: data.metadata,
          category: data.metadata.category,
          timestamp: data.created_at
        }
      });

    } catch (error) {
      console.error('[Memory API] Error adding memory:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Search memories using vector similarity
  async searchMemories(req, res) {
    try {
      const { query, userId, limit = 5 } = req.body;
      
      if (!query || !userId) {
        return res.status(400).json({ error: 'Query and userId are required' });
      }

      // Generate embedding for the search query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Perform vector similarity search using Supabase's pgvector
      const { data, error } = await this.supabase.rpc('search_memories', {
        query_embedding: queryEmbedding,
        match_user_id: userId,
        match_threshold: 0.7, // Similarity threshold
        match_count: limit
      });

      if (error) {
        console.error('[Memory API] Search error:', error);
        return res.status(500).json({ error: 'Search failed' });
      }

      const memories = data.map(item => ({
        id: item.id,
        content: item.content,
        metadata: item.metadata,
        relevanceScore: item.similarity,
        timestamp: item.created_at
      }));

      console.log(`[Memory API] Found ${memories.length} memories for query: "${query}"`);
      res.json({ success: true, memories });

    } catch (error) {
      console.error('[Memory API] Error searching memories:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get all memories for a user
  async getUserMemories(req, res) {
    try {
      const { userId } = req.params;
      const { limit = 50, offset = 0, category } = req.query;

      let query = this.supabase
        .from('memories')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (category) {
        query = query.eq('metadata->category', category);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[Memory API] Error fetching user memories:', error);
        return res.status(500).json({ error: 'Failed to fetch memories' });
      }

      const memories = data.map(item => ({
        id: item.id,
        content: item.content,
        metadata: item.metadata,
        timestamp: item.created_at
      }));

      res.json({ success: true, memories, total: data.length });

    } catch (error) {
      console.error('[Memory API] Error getting user memories:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Update a memory
  async updateMemory(req, res) {
    try {
      const { memoryId } = req.params;
      const { content, metadata, userId } = req.body;

      // Verify ownership
      const { data: existing, error: fetchError } = await this.supabase
        .from('memories')
        .select('*')
        .eq('id', memoryId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !existing) {
        return res.status(404).json({ error: 'Memory not found' });
      }

      const updates = {
        updated_at: new Date().toISOString()
      };

      if (content) {
        updates.content = content.trim();
        updates.embedding = await this.generateEmbedding(content);
        updates.metadata = {
          ...existing.metadata,
          ...metadata,
          category: this.categorizeMemory(content)
        };
      } else if (metadata) {
        updates.metadata = { ...existing.metadata, ...metadata };
      }

      const { data, error } = await this.supabase
        .from('memories')
        .update(updates)
        .eq('id', memoryId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('[Memory API] Update error:', error);
        return res.status(500).json({ error: 'Failed to update memory' });
      }

      res.json({ 
        success: true, 
        memory: {
          id: data.id,
          content: data.content,
          metadata: data.metadata,
          timestamp: data.updated_at
        }
      });

    } catch (error) {
      console.error('[Memory API] Error updating memory:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Delete a memory
  async deleteMemory(req, res) {
    try {
      const { memoryId } = req.params;
      const { userId } = req.body;

      const { error } = await this.supabase
        .from('memories')
        .delete()
        .eq('id', memoryId)
        .eq('user_id', userId);

      if (error) {
        console.error('[Memory API] Delete error:', error);
        return res.status(500).json({ error: 'Failed to delete memory' });
      }

      console.log(`[Memory API] Deleted memory: ${memoryId}`);
      res.json({ success: true });

    } catch (error) {
      console.error('[Memory API] Error deleting memory:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Add multiple memories in batch
  async addMemoriesBatch(req, res) {
    try {
      const { memories, userId } = req.body;
      
      if (!Array.isArray(memories) || memories.length === 0) {
        return res.status(400).json({ error: 'Memories array is required' });
      }

      const processedMemories = [];
      
      for (const memory of memories) {
        const embedding = await this.generateEmbedding(memory.content);
        const category = this.categorizeMemory(memory.content);
        
        processedMemories.push({
          content: memory.content.trim(),
          embedding: embedding,
          metadata: {
            ...memory.metadata,
            category: category,
            timestamp: new Date().toISOString(),
            source: 'batch'
          },
          user_id: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }

      const { data, error } = await this.supabase
        .from('memories')
        .insert(processedMemories)
        .select();

      if (error) {
        console.error('[Memory API] Batch insert error:', error);
        return res.status(500).json({ error: 'Failed to store memories' });
      }

      console.log(`[Memory API] Added ${data.length} memories in batch for user: ${userId}`);
      res.json({ success: true, count: data.length, memories: data });

    } catch (error) {
      console.error('[Memory API] Error in batch add:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get contextual memories based on current activity
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
        const queryEmbedding = await this.generateEmbedding(query);
        
        const { data, error } = await this.supabase.rpc('search_memories', {
          query_embedding: queryEmbedding,
          match_user_id: userId,
          match_threshold: 0.6,
          match_count: 3
        });

        if (!error && data) {
          allMemories.push(...data);
        }
      }

      // Deduplicate and sort by relevance
      const uniqueMemories = this.deduplicateMemories(allMemories);
      const topMemories = uniqueMemories.slice(0, limit);

      const formattedMemories = topMemories.map(item => ({
        id: item.id,
        content: item.content,
        metadata: item.metadata,
        relevanceScore: item.similarity,
        timestamp: item.created_at
      }));

      res.json({ success: true, memories: formattedMemories });

    } catch (error) {
      console.error('[Memory API] Error getting contextual memories:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Helper methods
  async generateEmbedding(text) {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error('[Memory API] Error generating embedding:', error);
      // Return a dummy embedding for testing
      return new Array(1536).fill(0);
    }
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

  // Handle chat queries with Claude and memory context
  async handleChatQuery(req, res) {
    try {
      const { query, userId = 'demo-user' } = req.body;
      
      if (!query) {
        return res.status(400).json({ error: 'Query is required' });
      }

      // Get relevant memories for context
      let relevantMemories = [];
      try {
        const searchResult = await this.searchMemoriesInternal(query, userId, 5);
        relevantMemories = searchResult || [];
      } catch (error) {
        console.log('[Chat] Could not fetch memories, continuing without context');
      }

      // Get mind map data
      const mindMapData = this.getMindMapData();
      
      // Build context-aware prompt
      const systemPrompt = `You are an AI Study Tutor. You help students identify specific learning problems and provide targeted guidance.

STUDENT'S MIND MAP: The student is learning these connected topics:
${mindMapData.nodes.map(n => n.label).join(', ')}

Key connections: ${mindMapData.edges.map(e => `${e.source} → ${e.target}`).join(', ')}

RELEVANT MEMORIES:
${relevantMemories.length > 0 ? relevantMemories.map(m => `- ${m.content}`).join('\n') : 'No previous context available'}

YOUR APPROACH:
1. Focus on identifying SPECIFIC problems and weaknesses, not just explaining concepts
2. Ask follow-up questions to understand exactly where they're struggling
3. Provide concrete critiques and actionable improvements
4. Reference their mind map to show connections and suggest learning paths
5. Be encouraging but direct about areas needing work

Be conversational and supportive, like a real tutor who cares about their progress.`;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: query
          }
        ]
      });

      const answer = response.content[0].text;

      // Store this interaction as a memory
      try {
        await this.addMemoryInternal(
          `User asked: "${query}" - Response context: ${answer.substring(0, 200)}...`,
          { userId, source: 'chat', topic: this.extractTopicFromQuery(query) }
        );
      } catch (error) {
        console.log('[Chat] Could not store interaction memory');
      }

      res.json({ success: true, answer });

    } catch (error) {
      console.error('[Chat] Error handling query:', error);
      res.status(500).json({ error: 'Failed to process chat query' });
    }
  }

  // Get mind map data
  async getMindMap(req, res) {
    try {
      const mindMapData = this.getMindMapData();
      res.json(mindMapData);
    } catch (error) {
      console.error('[MindMap] Error getting mind map:', error);
      res.status(500).json({ error: 'Failed to get mind map' });
    }
  }

  // Get dashboard metrics
  async getMetrics(req, res) {
    try {
      const userId = req.query.userId || 'demo-user';
      
      // Get memory count
      let memoryCount = 0;
      try {
        const { count } = await this.supabase
          .from('memories')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);
        memoryCount = count || 0;
      } catch (error) {
        console.log('[Metrics] Could not fetch memory count');
      }

      const mindMapData = this.getMindMapData();
      
      res.json({
        milestones: Math.min(Math.floor(memoryCount / 5), 10),
        streak: Math.min(Math.floor(memoryCount / 2), 15),
        notesCount: memoryCount,
        mindNodes: mindMapData.nodes.length,
        mindEdges: mindMapData.edges.length
      });

    } catch (error) {
      console.error('[Metrics] Error getting metrics:', error);
      res.status(500).json({ error: 'Failed to get metrics' });
    }
  }

  // Helper methods for chat functionality
  getMindMapData() {
    return {
      nodes: [
        { id: 'algebra', label: 'Algebra' },
        { id: 'geometry', label: 'Geometry' },
        { id: 'trigonometry', label: 'Trigonometry' },
        { id: 'calculus', label: 'Calculus' },
        { id: 'probability', label: 'Probability' },
        { id: 'statistics', label: 'Statistics' },
        { id: 'linear_algebra', label: 'Linear Algebra' },
        { id: 'physics', label: 'Physics' },
        { id: 'machine_learning', label: 'Machine Learning' }
      ],
      edges: [
        { source: 'algebra', target: 'calculus' },
        { source: 'geometry', target: 'trigonometry' },
        { source: 'trigonometry', target: 'calculus' },
        { source: 'algebra', target: 'linear_algebra' },
        { source: 'calculus', target: 'physics' },
        { source: 'probability', target: 'statistics' },
        { source: 'calculus', target: 'probability' },
        { source: 'statistics', target: 'machine_learning' },
        { source: 'linear_algebra', target: 'machine_learning' },
        { source: 'linear_algebra', target: 'physics' }
      ]
    };
  }

  async searchMemoriesInternal(query, userId, limit = 5) {
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      
      const { data, error } = await this.supabase.rpc('search_memories', {
        query_embedding: queryEmbedding,
        match_user_id: userId,
        match_threshold: 0.7,
        match_count: limit
      });

      if (error) return [];
      
      return data.map(item => ({
        id: item.id,
        content: item.content,
        metadata: item.metadata,
        relevanceScore: item.similarity,
        timestamp: item.created_at
      }));
    } catch (error) {
      return [];
    }
  }

  async addMemoryInternal(content, metadata) {
    try {
      const embedding = await this.generateEmbedding(content);
      const category = this.categorizeMemory(content);
      
      const memoryData = {
        content: content.trim(),
        embedding: embedding,
        metadata: {
          ...metadata,
          category: category,
          timestamp: new Date().toISOString(),
          source: metadata.source || 'api'
        },
        user_id: metadata.userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('memories')
        .insert([memoryData])
        .select()
        .single();

      return data;
    } catch (error) {
      console.error('Error adding memory internally:', error);
      return null;
    }
  }

  extractTopicFromQuery(query) {
    const topics = ['algebra', 'calculus', 'probability', 'statistics', 'geometry', 'trigonometry', 'physics', 'linear algebra', 'machine learning'];
    const q = query.toLowerCase();
    for (let topic of topics) {
      if (q.includes(topic)) return topic;
    }
    return 'general';
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`[Memory API] Server running on port ${this.port}`);
      console.log(`[Memory API] Health check: http://localhost:${this.port}/health`);
    });
  }
}

// Create and start the server
if (require.main === module) {
  const memoryAPI = new MemoryAPI();
  memoryAPI.start();
}

module.exports = MemoryAPI;

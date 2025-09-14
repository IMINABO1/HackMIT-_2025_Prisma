// local-memory-storage.js - Local file-based memory storage system
// Replaces Supabase with JSON files and in-memory vector search

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class LocalMemoryStorage {
  constructor(dataDir = './data') {
    this.dataDir = dataDir;
    this.memoriesFile = path.join(dataDir, 'memories.json');
    this.notesFile = path.join(dataDir, 'notes.json');
    this.mindmapFile = path.join(dataDir, 'mindmap.json');
    
    // In-memory cache for faster access
    this.memories = [];
    this.notes = [];
    this.mindmap = { nodes: [], edges: [] };
    
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    
    try {
      // Create data directory if it doesn't exist
      await fs.mkdir(this.dataDir, { recursive: true });
      
      // Load existing data
      await this.loadMemories();
      await this.loadNotes();
      await this.loadMindmap();
      
      this.initialized = true;
      console.log(`[Local Storage] Initialized with ${this.memories.length} memories, ${this.notes.length} notes`);
    } catch (error) {
      console.error('[Local Storage] Initialization error:', error);
      throw error;
    }
  }

  // Memory operations
  async loadMemories() {
    try {
      const data = await fs.readFile(this.memoriesFile, 'utf8');
      this.memories = JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.memories = [];
        await this.saveMemories();
      } else {
        throw error;
      }
    }
  }

  async saveMemories() {
    await fs.writeFile(this.memoriesFile, JSON.stringify(this.memories, null, 2));
  }

  async addMemory(content, metadata = {}, userId) {
    await this.init();
    
    const memory = {
      id: this.generateId(),
      user_id: userId,
      content: content.trim(),
      embedding: metadata.embedding || null, // Will be set by the API layer
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        source: metadata.source || 'api'
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.memories.push(memory);
    await this.saveMemories();
    
    console.log(`[Local Storage] Added memory: ${memory.id} for user: ${userId}`);
    return memory;
  }

  async searchMemories(queryEmbedding, userId, threshold = 0.7, limit = 5) {
    await this.init();
    
    const userMemories = this.memories.filter(m => m.user_id === userId);
    
    if (!queryEmbedding || userMemories.length === 0) {
      return [];
    }

    // Calculate cosine similarity for each memory
    const results = userMemories
      .map(memory => {
        if (!memory.embedding) return null;
        
        const similarity = this.cosineSimilarity(queryEmbedding, memory.embedding);
        return {
          ...memory,
          similarity
        };
      })
      .filter(result => result && result.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return results;
  }

  async getUserMemories(userId, limit = 50, offset = 0, category = null) {
    await this.init();
    
    let userMemories = this.memories.filter(m => m.user_id === userId);
    
    if (category) {
      userMemories = userMemories.filter(m => m.metadata.category === category);
    }
    
    // Sort by creation date (newest first)
    userMemories.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    // Apply pagination
    const paginatedMemories = userMemories.slice(offset, offset + limit);
    
    return {
      memories: paginatedMemories,
      total: userMemories.length
    };
  }

  async updateMemory(memoryId, updates, userId) {
    await this.init();
    
    const index = this.memories.findIndex(m => m.id === memoryId && m.user_id === userId);
    if (index === -1) {
      throw new Error('Memory not found');
    }

    this.memories[index] = {
      ...this.memories[index],
      ...updates,
      updated_at: new Date().toISOString()
    };

    await this.saveMemories();
    return this.memories[index];
  }

  async deleteMemory(memoryId, userId) {
    await this.init();
    
    const index = this.memories.findIndex(m => m.id === memoryId && m.user_id === userId);
    if (index === -1) {
      throw new Error('Memory not found');
    }

    this.memories.splice(index, 1);
    await this.saveMemories();
    
    console.log(`[Local Storage] Deleted memory: ${memoryId}`);
    return true;
  }

  // Notes operations
  async loadNotes() {
    try {
      const data = await fs.readFile(this.notesFile, 'utf8');
      this.notes = JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.notes = [];
        await this.saveNotes();
      } else {
        throw error;
      }
    }
  }

  async saveNotes() {
    await fs.writeFile(this.notesFile, JSON.stringify(this.notes, null, 2));
  }

  async addNote(content, metadata = {}, userId) {
    await this.init();
    
    const note = {
      id: this.generateId(),
      user_id: userId,
      content: content.trim(),
      title: metadata.title || null,
      url: metadata.url || null,
      page_title: metadata.pageTitle || null,
      metadata: metadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.notes.push(note);
    await this.saveNotes();
    
    return note;
  }

  async getUserNotes(userId, limit = 50, offset = 0) {
    await this.init();
    
    const userNotes = this.notes
      .filter(n => n.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(offset, offset + limit);
    
    return userNotes;
  }

  async updateNote(noteId, updates, userId) {
    await this.init();
    
    const index = this.notes.findIndex(n => n.id === noteId && n.user_id === userId);
    if (index === -1) {
      throw new Error('Note not found');
    }

    this.notes[index] = {
      ...this.notes[index],
      ...updates,
      updated_at: new Date().toISOString()
    };

    await this.saveNotes();
    return this.notes[index];
  }

  async deleteNote(noteId, userId) {
    await this.init();
    
    const index = this.notes.findIndex(n => n.id === noteId && n.user_id === userId);
    if (index === -1) {
      throw new Error('Note not found');
    }

    this.notes.splice(index, 1);
    await this.saveNotes();
    return true;
  }

  // Mindmap operations
  async loadMindmap() {
    try {
      const data = await fs.readFile(this.mindmapFile, 'utf8');
      this.mindmap = JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.mindmap = { nodes: [], edges: [] };
        await this.saveMindmap();
      } else {
        throw error;
      }
    }
  }

  async saveMindmap() {
    await fs.writeFile(this.mindmapFile, JSON.stringify(this.mindmap, null, 2));
  }

  async addMindmapNode(label, metadata = {}, userId) {
    await this.init();
    
    const node = {
      id: this.generateId(),
      user_id: userId,
      label: label,
      x: metadata.x || 0,
      y: metadata.y || 0,
      color: metadata.color || '#3B82F6',
      size: metadata.size || 1.0,
      metadata: metadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.mindmap.nodes.push(node);
    await this.saveMindmap();
    
    return node;
  }

  async addMindmapEdge(sourceNodeId, targetNodeId, metadata = {}, userId) {
    await this.init();
    
    const edge = {
      id: this.generateId(),
      user_id: userId,
      source_node_id: sourceNodeId,
      target_node_id: targetNodeId,
      label: metadata.label || null,
      weight: metadata.weight || 1.0,
      metadata: metadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.mindmap.edges.push(edge);
    await this.saveMindmap();
    
    return edge;
  }

  async getUserMindmap(userId) {
    await this.init();
    
    const nodes = this.mindmap.nodes.filter(n => n.user_id === userId);
    const edges = this.mindmap.edges.filter(e => e.user_id === userId);
    
    return { nodes, edges };
  }

  // Utility methods
  generateId() {
    return crypto.randomUUID();
  }

  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Batch operations
  async addMemoriesBatch(memories, userId) {
    await this.init();
    
    const processedMemories = memories.map(memory => ({
      id: this.generateId(),
      user_id: userId,
      content: memory.content.trim(),
      embedding: memory.embedding || null,
      metadata: {
        ...memory.metadata,
        timestamp: new Date().toISOString(),
        source: 'batch'
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    this.memories.push(...processedMemories);
    await this.saveMemories();
    
    console.log(`[Local Storage] Added ${processedMemories.length} memories in batch for user: ${userId}`);
    return processedMemories;
  }

  // Statistics
  async getMemoryStats(userId) {
    await this.init();
    
    const userMemories = this.memories.filter(m => m.user_id === userId);
    const categories = new Set(userMemories.map(m => m.metadata.category).filter(Boolean));
    
    return {
      total_memories: userMemories.length,
      categories_count: categories.size,
      last_memory_date: userMemories.length > 0 ? 
        Math.max(...userMemories.map(m => new Date(m.created_at))) : null,
      first_memory_date: userMemories.length > 0 ? 
        Math.min(...userMemories.map(m => new Date(m.created_at))) : null
    };
  }

  // Backup and restore
  async createBackup() {
    await this.init();
    
    const backup = {
      timestamp: new Date().toISOString(),
      memories: this.memories,
      notes: this.notes,
      mindmap: this.mindmap
    };

    const backupFile = path.join(this.dataDir, `backup_${Date.now()}.json`);
    await fs.writeFile(backupFile, JSON.stringify(backup, null, 2));
    
    console.log(`[Local Storage] Backup created: ${backupFile}`);
    return backupFile;
  }

  async restoreFromBackup(backupFile) {
    try {
      const data = await fs.readFile(backupFile, 'utf8');
      const backup = JSON.parse(data);
      
      this.memories = backup.memories || [];
      this.notes = backup.notes || [];
      this.mindmap = backup.mindmap || { nodes: [], edges: [] };
      
      await this.saveMemories();
      await this.saveNotes();
      await this.saveMindmap();
      
      console.log(`[Local Storage] Restored from backup: ${backupFile}`);
      return true;
    } catch (error) {
      console.error('[Local Storage] Restore error:', error);
      throw error;
    }
  }
}

module.exports = LocalMemoryStorage;

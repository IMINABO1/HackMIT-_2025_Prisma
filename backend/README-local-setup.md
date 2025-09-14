# Local Memory Storage Setup

This is a **local file-based** alternative to the Supabase setup that stores all data in JSON files. Perfect for hackathons and quick prototyping!

## 🚀 Quick Start

1. **Install dependencies** (no Supabase needed!):
   ```bash
   cd backend
   npm install
   ```

2. **Optional: Set up OpenAI for embeddings** (creates `.env` file):
   ```bash
   echo "OPENAI_API_KEY=your-openai-key-here" > .env
   ```
   
   **Note**: OpenAI is optional! If you don't have an API key, the system will fall back to simple text-based search.

3. **Start the server**:
   ```bash
   npm start
   # or for development with auto-restart:
   npm run dev
   ```

4. **Test it's working**:
   ```bash
   curl http://localhost:3000/health
   ```

## 📁 Data Storage

All data is stored locally in the `./data/` directory:

- `memories.json` - AI memories with embeddings
- `notes.json` - User notes from the extension  
- `mindmap.json` - Mind map nodes and edges
- `backup_*.json` - Automatic backups

The data directory is created automatically when you first run the server.

## 🔄 API Compatibility

The local version provides **identical API endpoints** to the Supabase version:

### Memory Operations
- `POST /api/memory/add` - Add a new memory
- `POST /api/memory/search` - Search memories (vector or text-based)
- `GET /api/memory/user/:userId` - Get all memories for user
- `PUT /api/memory/:memoryId` - Update a memory
- `DELETE /api/memory/:memoryId` - Delete a memory
- `POST /api/memory/batch/add` - Add multiple memories
- `POST /api/memory/context` - Get contextual memories

### Notes Operations  
- `POST /api/notes/add` - Add a note
- `GET /api/notes/user/:userId` - Get user notes
- `PUT /api/notes/:noteId` - Update a note
- `DELETE /api/notes/:noteId` - Delete a note

### Mind Map Operations
- `POST /api/mindmap/node` - Add a mind map node
- `POST /api/mindmap/edge` - Add a mind map edge  
- `GET /api/mindmap/user/:userId` - Get user's mind map

### Utility Operations
- `GET /api/stats/user/:userId` - Get user statistics
- `POST /api/backup` - Create a backup
- `POST /api/restore` - Restore from backup

## 🧠 Memory Search Modes

### With OpenAI API Key (Recommended)
- Uses `text-embedding-3-small` for semantic vector search
- Finds memories by meaning, not just keywords
- More accurate and contextual results

### Without OpenAI API Key (Fallback)
- Uses simple text-based keyword matching
- Still functional for basic memory operations
- Good enough for testing and development

## 🔧 Configuration

### Environment Variables (Optional)
```bash
# .env file
OPENAI_API_KEY=your-openai-key-here  # Optional: for vector embeddings
PORT=3000                            # Optional: server port (default 3000)
```

### Data Directory
By default, data is stored in `./data/`. You can change this by modifying the `LocalMemoryStorage` constructor in `local-memory-api.js`:

```javascript
this.storage = new LocalMemoryStorage('./my-custom-data-dir');
```

## 📊 Example Usage

### Add a Memory
```bash
curl -X POST http://localhost:3000/api/memory/add \
  -H "Content-Type: application/json" \
  -d '{
    "content": "I am good at modular arithmetic but struggle with graph algorithms",
    "metadata": {
      "userId": "student123",
      "source": "extension"
    }
  }'
```

### Search Memories
```bash
curl -X POST http://localhost:3000/api/memory/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "graph algorithms",
    "userId": "student123",
    "limit": 5
  }'
```

### Add a Note
```bash
curl -X POST http://localhost:3000/api/notes/add \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Dijkstra algorithm uses priority queue",
    "metadata": {
      "userId": "student123",
      "title": "Graph Algorithms",
      "url": "https://example.com/graphs"
    }
  }'
```

## 🔄 Migration from Supabase

If you have existing Supabase data, you can migrate it:

1. Export your Supabase data to JSON format
2. Use the backup/restore endpoints to import it
3. Or manually copy the data into the JSON files

## 🛡️ Data Persistence & Backups

- Data is automatically saved to JSON files after each operation
- Use `POST /api/backup` to create timestamped backups
- Backups are stored as `backup_[timestamp].json` in the data directory
- Use `POST /api/restore` with a backup file to restore data

## 🚀 Performance Notes

- **In-memory caching**: Data is loaded into memory on startup for fast access
- **File I/O**: Changes are written to disk immediately for persistence  
- **Vector search**: If using OpenAI, embeddings are cached in the JSON files
- **Scalability**: Good for development and small-scale deployments (< 10k memories)

## 🔧 Troubleshooting

### Server won't start
- Check if port 3000 is available: `lsof -i :3000`
- Try a different port: `PORT=3001 npm start`

### OpenAI errors
- The system will fall back to text search if OpenAI fails
- Check your API key and account credits
- Remove the `OPENAI_API_KEY` to disable vector search entirely

### Data corruption
- Use the backup/restore functionality
- JSON files are human-readable and can be manually edited if needed
- Delete the data directory to start fresh

## 🎯 Perfect for Hackathons!

This local setup is ideal because:
- ✅ **No external dependencies** (except optional OpenAI)
- ✅ **No database setup required**
- ✅ **Works offline** (except for OpenAI embeddings)
- ✅ **Easy to debug** (human-readable JSON files)
- ✅ **Fast to deploy** (just `npm start`)
- ✅ **Identical API** to production Supabase version

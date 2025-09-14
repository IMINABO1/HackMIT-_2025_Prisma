-- Supabase schema for AI Study Copilot memory system
-- This creates the necessary tables and functions for Mem0-inspired memory storage

-- Enable the pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create memories table with vector embeddings
CREATE TABLE IF NOT EXISTS memories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536), -- OpenAI text-embedding-3-small dimension
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_metadata_category ON memories USING GIN ((metadata->>'category'));

-- Create vector similarity index using HNSW (Hierarchical Navigable Small World)
CREATE INDEX IF NOT EXISTS idx_memories_embedding ON memories 
USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- Function to search memories by vector similarity
CREATE OR REPLACE FUNCTION search_memories(
    query_embedding vector(1536),
    match_user_id text,
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id uuid,
    content text,
    metadata jsonb,
    created_at timestamp with time zone,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        memories.id,
        memories.content,
        memories.metadata,
        memories.created_at,
        (1 - (memories.embedding <=> query_embedding)) as similarity
    FROM memories
    WHERE memories.user_id = match_user_id
        AND (1 - (memories.embedding <=> query_embedding)) > match_threshold
    ORDER BY memories.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Function to get memories by category
CREATE OR REPLACE FUNCTION get_memories_by_category(
    match_user_id text,
    match_category text,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    content text,
    metadata jsonb,
    created_at timestamp with time zone
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        memories.id,
        memories.content,
        memories.metadata,
        memories.created_at
    FROM memories
    WHERE memories.user_id = match_user_id
        AND memories.metadata->>'category' = match_category
    ORDER BY memories.created_at DESC
    LIMIT match_count;
END;
$$;

-- Function to get recent memories
CREATE OR REPLACE FUNCTION get_recent_memories(
    match_user_id text,
    days_back int DEFAULT 7,
    match_count int DEFAULT 20
)
RETURNS TABLE (
    id uuid,
    content text,
    metadata jsonb,
    created_at timestamp with time zone
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        memories.id,
        memories.content,
        memories.metadata,
        memories.created_at
    FROM memories
    WHERE memories.user_id = match_user_id
        AND memories.created_at >= NOW() - INTERVAL '%s days' % days_back
    ORDER BY memories.created_at DESC
    LIMIT match_count;
END;
$$;

-- Function to update the updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_memories_updated_at 
    BEFORE UPDATE ON memories 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create notes table for the extension's note-taking feature
CREATE TABLE IF NOT EXISTS notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    title TEXT,
    url TEXT,
    page_title TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for notes
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_url ON notes(url);

-- Create trigger for notes updated_at
CREATE TRIGGER update_notes_updated_at 
    BEFORE UPDATE ON notes 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create mind map tables
CREATE TABLE IF NOT EXISTS mindmap_nodes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    label TEXT NOT NULL,
    x FLOAT DEFAULT 0,
    y FLOAT DEFAULT 0,
    color TEXT DEFAULT '#3B82F6',
    size FLOAT DEFAULT 1.0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mindmap_edges (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    source_node_id UUID REFERENCES mindmap_nodes(id) ON DELETE CASCADE,
    target_node_id UUID REFERENCES mindmap_nodes(id) ON DELETE CASCADE,
    label TEXT,
    weight FLOAT DEFAULT 1.0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for mind map tables
CREATE INDEX IF NOT EXISTS idx_mindmap_nodes_user_id ON mindmap_nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_mindmap_edges_user_id ON mindmap_edges(user_id);
CREATE INDEX IF NOT EXISTS idx_mindmap_edges_source ON mindmap_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_mindmap_edges_target ON mindmap_edges(target_node_id);

-- Triggers for mind map tables
CREATE TRIGGER update_mindmap_nodes_updated_at 
    BEFORE UPDATE ON mindmap_nodes 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mindmap_edges_updated_at 
    BEFORE UPDATE ON mindmap_edges 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies for data isolation
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mindmap_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mindmap_edges ENABLE ROW LEVEL SECURITY;

-- Policies to ensure users can only access their own data
CREATE POLICY "Users can only access their own memories" ON memories
    FOR ALL USING (auth.uid()::text = user_id);

CREATE POLICY "Users can only access their own notes" ON notes
    FOR ALL USING (auth.uid()::text = user_id);

CREATE POLICY "Users can only access their own mindmap nodes" ON mindmap_nodes
    FOR ALL USING (auth.uid()::text = user_id);

CREATE POLICY "Users can only access their own mindmap edges" ON mindmap_edges
    FOR ALL USING (auth.uid()::text = user_id);

-- Create a view for memory statistics
CREATE OR REPLACE VIEW memory_stats AS
SELECT 
    user_id,
    COUNT(*) as total_memories,
    COUNT(DISTINCT metadata->>'category') as categories_count,
    MAX(created_at) as last_memory_date,
    MIN(created_at) as first_memory_date
FROM memories
GROUP BY user_id;

-- Grant permissions (adjust based on your Supabase setup)
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
-- GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

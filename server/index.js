require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend requests
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const hfToken = process.env.HUGGINGFACE_TOKEN;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in environment variables.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Multer setup for handling text/markdown uploads in memory
const upload = multer({ storage: multer.memoryStorage() });

// --- Helper Functions ---

// 1. Generate 384-dimensional embeddings via Hugging Face Inference API
async function getEmbedding(text) {
  try {
    const response = await axios.post(
      'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2',
      { inputs: text },
      {
        headers: {
          Authorization: `Bearer ${hfToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error generating embedding:', error?.response?.data || error.message);
    throw new Error('Failed to generate embedding from Hugging Face.');
  }
}

// 2. Simple text chunking with overlap
function chunkText(text, chunkSize = 500, overlap = 100) {
  const chunks = [];
  let index = 0;

  while (index < text.length) {
    const chunk = text.slice(index, index + chunkSize);
    if (chunk.trim().length > 0) {
      chunks.push(chunk.trim());
    }
    index += (chunkSize - overlap);
  }

  return chunks;
}

// --- Routes ---

// 🟢 1. HEALTH CHECK & KEEP-ALIVE ROUTE (Pings Supabase to prevent pausing)
app.get('/api/health', async (req, res) => {
  try {
    // Queries Supabase count to reset the 7-day inactivity timer
    const { count, error } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    res.status(200).json({
      status: 'healthy',
      message: 'Server is live and Supabase DB pinged successfully!',
      documentCount: count ?? 0
    });
  } catch (err) {
    console.error('Health check database query error:', err.message);
    res.status(500).json({
      status: 'unhealthy',
      error: err.message
    });
  }
});

// 📤 2. UPLOAD & INGEST DOCUMENT
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    let rawText = '';

    if (req.file) {
      rawText = req.file.buffer.toString('utf-8');
    } else if (req.body.text) {
      rawText = req.body.text;
    } else {
      return res.status(400).json({ error: 'Please provide a file or text body.' });
    }

    const chunks = chunkText(rawText);
    const records = [];

    for (const chunk of chunks) {
      const embedding = await getEmbedding(chunk);
      records.push({
        content: chunk,
        embedding: embedding
      });
    }

    const { data, error } = await supabase
      .from('documents')
      .insert(records);

    if (error) throw error;

    res.status(200).json({
      message: `Document processed and ${chunks.length} chunks indexed successfully!`,
      chunksCount: chunks.length
    });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: error.message || 'Failed to process document.' });
  }
});

// 🔍 3. VECTOR SEARCH ROUTE
app.post('/api/search', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required.' });
    }

    // 1. Embed user search query
    const queryEmbedding = await getEmbedding(query);

    // 2. Query Supabase using pgvector similarity function
    const { data: documents, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.2, // Returns relevant matches
      match_count: 5
    });

    if (error) throw error;

    res.status(200).json({ results: documents || [] });
  } catch (error) {
    console.error('Search Error:', error);
    res.status(500).json({ error: error.message || 'Error executing search.' });
  }
});

// Default root route
app.get('/', (req, res) => {
  res.send('AI Document Search Backend is running.');
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
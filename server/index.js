require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { chunkText, generateEmbedding } = require('./utils/ai');
const { supabase } = require('./utils/db');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({ storage });

// 1. Upload & Store in Vector DB Endpoint
app.post('/api/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const token = process.env.HUGGINGFACE_TOKEN;
    const fullText = fs.readFileSync(req.file.path, 'utf-8');
    const chunks = chunkText(fullText, 150);

    console.log(`Processing ${chunks.length} chunk(s) into database...`);

    for (let i = 0; i < chunks.length; i++) {
      const chunkTextContent = chunks[i];
      const vector = await generateEmbedding(chunkTextContent, token);

      // Insert chunk text and embedding vector into Supabase
      const { error } = await supabase.from('document_chunks').insert({
        filename: req.file.filename,
        chunk_index: i,
        content: chunkTextContent,
        embedding: vector,
      });

      if (error) {
        console.error('Supabase Insert Error:', error);
        throw error;
      }
    }

    console.log('Document chunks successfully stored in Supabase!');

    res.json({
      status: 'success',
      filename: req.file.filename,
      totalChunksStored: chunks.length,
    });
  } catch (error) {
    console.error('Upload & DB Error:', error);
    res.status(500).json({ error: 'Failed to process and store document embeddings.' });
  }
});

// 2. Semantic Vector Search Endpoint
app.post('/api/search', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required.' });
    }

    const token = process.env.HUGGINGFACE_TOKEN;

    console.log(`Generating embedding for user query: "${query}"`);
    const queryVector = await generateEmbedding(query, token);

    // Call Supabase RPC stored procedure to perform cosine similarity search
    const { data: matches, error } = await supabase.rpc('match_document_chunks', {
      query_embedding: queryVector,
      match_threshold: 0.1, // Filter out matches below 10% similarity
      match_count: 3,        // Return top 3 most relevant chunks
    });

    if (error) {
      console.error('Vector Search Error:', error);
      throw error;
    }

    res.json({
      status: 'success',
      query,
      resultsCount: matches.length,
      matches,
    });
  } catch (error) {
    console.error('Search Error:', error);
    res.status(500).json({ error: 'Failed to execute vector similarity search.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
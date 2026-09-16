require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const hfToken = process.env.HUGGINGFACE_TOKEN;
const databasePath = process.env.DATABASE_PATH || path.join(__dirname, 'documents.json');

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

function readDocuments() {
  try {
    return JSON.parse(fs.readFileSync(databasePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

function writeDocuments(documents) {
  fs.writeFileSync(databasePath, JSON.stringify(documents), 'utf8');
}

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

function chunkText(text, chunkSize = 500, overlap = 100) {
  const chunks = [];
  let index = 0;

  while (index < text.length) {
    const chunk = text.slice(index, index + chunkSize);
    if (chunk.trim().length > 0) {
      chunks.push(chunk.trim());
    }
    index += chunkSize - overlap;
  }

  return chunks;
}

function cosineSimilarity(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    throw new Error('Embedding dimensions do not match.');
  }

  let dotProduct = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    dotProduct += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

app.get('/api/health', (req, res) => {
  try {
    const documents = readDocuments();
    res.status(200).json({
      status: 'healthy',
      message: 'Server is live and local JSON database is ready.',
      documentCount: documents.length
    });
  } catch (error) {
    console.error('Health check database query error:', error.message);
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});

app.post('/api/upload', upload.single('document'), async (req, res) => {
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
    const filename = req.file?.originalname || 'text-input';
    const records = [];

    for (const [chunkIndex, chunk] of chunks.entries()) {
      records.push({
        filename,
        chunkIndex,
        content: chunk,
        embedding: await getEmbedding(chunk)
      });
    }

    const documents = readDocuments();
    writeDocuments(documents.concat(records));

    res.status(200).json({
      status: 'success',
      message: `Document processed and ${chunks.length} chunks indexed successfully!`,
      totalChunksStored: chunks.length
    });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: error.message || 'Failed to process document.' });
  }
});

app.post('/api/search', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required.' });
    }

    const queryEmbedding = await getEmbedding(query);
    const queryVector = Array.isArray(queryEmbedding[0]) ? queryEmbedding[0] : queryEmbedding;
    const documents = readDocuments();

    const matches = documents
      .map((document) => ({
        filename: document.filename,
        chunk_index: document.chunk_index,
        content: document.content,
        similarity: cosineSimilarity(queryVector, document.embedding)
      }))
      .filter((document) => document.similarity > 0.2)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);

    res.status(200).json({ status: 'success', matches });
  } catch (error) {
    console.error('Search Error:', error);
    res.status(500).json({ error: error.message || 'Error executing search.' });
  }
});

app.get('/', (req, res) => {
  res.send('AI Document Search Backend is running.');
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

const axios = require('axios');

function chunkText(text, chunkSize = 150) {
  const words = text.split(/\s+/);
  const chunks = [];
  let currentChunk = [];

  for (let i = 0; i < words.length; i++) {
    currentChunk.push(words[i]);
    if (currentChunk.length >= chunkSize || i === words.length - 1) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [];
    }
  }

  return chunks;
}

async function generateEmbedding(textChunk, hfToken) {
  // Explicitly target the feature-extraction pipeline endpoint
  const modelUrl = 'https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction';

  try {
    const response = await axios.post(
      modelUrl,
      { inputs: textChunk },
      {
        headers: {
          Authorization: `Bearer ${hfToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error) {
    if (error.response) {
      console.error('Hugging Face API Error Status:', error.response.status);
      console.error('Hugging Face API Error Details:', error.response.data);
    } else {
      console.error('Network / Request Error:', error.message);
    }
    throw error;
  }
}

module.exports = { chunkText, generateEmbedding };
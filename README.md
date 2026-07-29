# ⚡ Semantic AI Document Search Engine

A full-stack, end-to-end vector search application that allows users to upload text documents, generate high-dimensional vector embeddings, and execute semantic similarity queries over document contents.

---

## 🌟 Key Engineering Features

- **Document Ingestion & Chunking:** Processes uploaded `.txt` / `.md` files on server disk and splits text into optimized token windows (~150 words).
- **Feature Extraction Pipeline:** Leverages Hugging Face's `sentence-transformers/all-MiniLM-L6-v2` transformer model to generate **384-dimensional vector embeddings** per chunk.
- **Vector Database Storage:** Stores high-dimensional array embeddings natively in PostgreSQL via Supabase and the `pgvector` extension.
- **Cosine Similarity Querying:** Implements custom SQL stored procedures (`match_document_chunks`) calculating cosine distance (`1 - (a <=> b)`) to match query semantics against stored chunks.
- **Modern Responsive Dashboard:** Built with React, Tailwind CSS v4, and Lucide Icons providing live similarity score badges, progress states, and error boundary handling.

---

## 🏗 System Architecture & Data Flow
## 🛠 Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS v4, Lucide React
- **Backend:** Node.js, Express.js, Multer
- **AI / NLP Model:** `sentence-transformers/all-MiniLM-L6-v2` via Hugging Face Inference Router
- **Database:** PostgreSQL with `pgvector` hosted on Supabase
- **Utilities:** Axios, CORS, Dotenv, Concurrently

---

## 🚀 Local Installation & Setup

### 1. Prerequisites
- Node.js (v18+)
- Free Hugging Face Account & Access Token
- Free Supabase Account & Database Instance

### 2. Clone Repository
```bash
git clone https://github.com/Brististic/AI-Document-Search-Engine.git
cd ai-document-search-engine
npm install

### 3. Frontend Setup
Bash
cd client
npm install
cd ..

### 4. Database Setup (Supabase)
Run the following script in your Supabase SQL Editor:

SQL
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS document_chunks (
  id BIGSERIAL PRIMARY KEY,
  filename TEXT NOT NULL,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(384),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION match_document_chunks (
  query_embedding VECTOR(384),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id BIGINT,
  filename TEXT,
  chunk_index INT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$   SELECT     id,     filename,     chunk_index,     content,     1 - (document_chunks.embedding <=> query_embedding) AS similarity   FROM document_chunks   WHERE 1 - (document_chunks.embedding <=> query_embedding) > match_threshold   ORDER BY document_chunks.embedding <=> query_embedding ASC   LIMIT match_count; $$;

### 5. Environment Variables Configuration
Create a .env file in the root directory:

Code snippet
HUGGINGFACE_TOKEN=hf_your_token_here
SUPABASE_URL=[https://your-project.supabase.co](https://your-project.supabase.co)
SUPABASE_KEY=your_supabase_anon_key


### 6. Start Application
To run both backend API and frontend Vite server concurrently:

Bash
npm run dev
Frontend: http://localhost:5173

Backend: http://localhost:5000

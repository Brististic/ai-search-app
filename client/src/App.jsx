import React, { useState } from 'react';
import { Upload, Search, FileText, CheckCircle, AlertCircle, Loader2, Sparkles } from 'lucide-react';

export default function App() {
  // File Upload State
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(null);

  // Search State
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [searchAttempted, setSearchAttempted] = useState(false);

  // Handle Document Upload
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setUploadMessage(null);

    const formData = new FormData();
    formData.append('document', file);

    try {
      const response = await fetch('https://ai-document-search-backend.onrender.com/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.status === 'success') {
        setUploadMessage({
          type: 'success',
          text: `Stored ${data.totalChunksStored} vector chunk(s) from "${file.name}" into Supabase!`,
        });
        setFile(null);
      } else {
        setUploadMessage({ type: 'error', text: data.error || 'Failed to process document.' });
      }
    } catch (err) {
      setUploadMessage({ type: 'error', text: 'Error connecting to server.' });
    } finally {
      setIsUploading(false);
    }
  };

  // Handle Semantic Vector Search
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setSearchAttempted(true);

    try {
      const response = await fetch('https://ai-document-search-backend.onrender.com/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();

      if (data.status === 'success') {
        setResults(data.matches || []);
      } else {
        setResults([]);
      }
    } catch (err) {
      console.error('Search error:', err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <header className="mb-10 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-3">
          <Sparkles className="w-4 h-4" /> Vector Search Engine
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">AI Document Search Engine</h1>
        <p className="text-slate-600 mt-2">Upload text documents, generate vector embeddings, and search passages by semantic meaning.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left Column: Upload Section */}
        <section className="md:col-span-5 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
            <Upload className="w-5 h-5 text-indigo-600" /> Upload Document
          </h2>

          <form onSubmit={handleUpload} className="space-y-4">
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-indigo-400 transition-colors">
              <FileText className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <label className="block text-sm font-medium text-slate-700 cursor-pointer">
                <span>Select a .txt or .md file</span>
                <input
                  type="file"
                  accept=".txt,.md"
                  className="sr-only"
                  onChange={(e) => setFile(e.target.files[0])}
                />
              </label>
              {file && (
                <div className="mt-2 text-xs font-semibold text-indigo-600 bg-indigo-50 py-1 px-2 rounded inline-block">
                  {file.name}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!file || isUploading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Vectorizing & Storing...
                </>
              ) : (
                'Process & Index Document'
              )}
            </button>
          </form>

          {uploadMessage && (
            <div className={`mt-4 p-3 rounded-lg text-sm flex items-start gap-2 ${
              uploadMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {uploadMessage.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600" /> : <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />}
              <span>{uploadMessage.text}</span>
            </div>
          )}
        </section>

        {/* Right Column: Search Section */}
        <section className="md:col-span-7 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
            <Search className="w-5 h-5 text-indigo-600" /> Semantic Search
          </h2>

          <form onSubmit={handleSearch} className="flex gap-2 mb-6">
            <input
              type="text"
              placeholder="Ask a question or enter a search query..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={isSearching || !query.trim()}
              className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-medium px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors cursor-pointer"
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
            </button>
          </form>

          {/* Results List */}
          <div className="space-y-4">
            {results.length > 0 ? (
              results.map((item, idx) => {
                const matchPct = (item.similarity * 100).toFixed(1);
                return (
                  <div key={idx} className="p-4 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white hover:border-indigo-200 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-500">File: {item.filename}</span>
                      <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                        {matchPct}% Match
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed font-serif">"{item.content}"</p>
                  </div>
                );
              })
            ) : (
              searchAttempted && !isSearching && (
                <div className="text-center py-8 text-slate-500 text-sm">
                  No semantically matching document chunks found above the relevance threshold.
                </div>
              )
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
// File Upload Handling
document.getElementById('uploadBtn').addEventListener('click', async () => {
  const fileInput = document.getElementById('fileInput');
  const uploadStatus = document.getElementById('uploadStatus');

  if (!fileInput.files.length) return alert('Select a file first!');

  const formData = new FormData();
  formData.append('document', fileInput.files[0]);

  uploadStatus.innerText = 'Chunking, generating vectors, and storing in Supabase...';

  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();

    if (data.status === 'success') {
      uploadStatus.innerText = `Success! Stored ${data.totalChunksStored} vector chunks in Supabase database.`;
    } else {
      uploadStatus.innerText = `Error: ${data.error}`;
    }
  } catch (err) {
    uploadStatus.innerText = 'Failed to upload document.';
  }
});

// Semantic Search Handling
document.getElementById('searchBtn').addEventListener('click', async () => {
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  const queryText = searchInput.value;

  if (!queryText) return alert('Type a question or query first!');

  searchResults.innerHTML = 'Searching vector database for relevant passages...';

  try {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: queryText }),
    });

    const data = await res.json();

    if (data.status === 'success' && data.matches.length > 0) {
      searchResults.innerHTML = `<h4>Top Matches for "${data.query}":</h4>`;
      
      data.matches.forEach((match) => {
        const similarityPct = (match.similarity * 100).toFixed(1);
        searchResults.innerHTML += `
          <div class="card">
            <div><span class="score">Relevance Match: ${similarityPct}%</span> | File: <em>${match.filename}</em></div>
            <p>"${match.content}"</p>
          </div>
        `;
      });
    } else {
      searchResults.innerText = 'No matching relevant passages found in the database.';
    }
  } catch (err) {
    searchResults.innerText = 'Error performing search.';
  }
});
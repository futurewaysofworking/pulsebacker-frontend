'use client';

import { useState } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError('');
    setResults([]);

    try {
      const res = await fetch('/api/match', {
        method: 'POST',
        body: JSON.stringify({ prompt }),
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (res.ok && data.matches) {
        setResults(data.matches);
      } else {
        setError('No matches found or error occurred.');
      }
    } catch (err) {
      setError('Error fetching results.');
      console.error(err);
    }

    setLoading(false);
  };

  return (
    <main style={{ padding: '2rem', maxWidth: '700px', margin: 'auto', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>🎯 Find the Right Athlete</h1>

      <textarea
        placeholder="Describe your ideal athlete. E.g. 'female swimmer with values around teamwork and body positivity'"
        rows={5}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        style={{ width: '100%', padding: '1rem', fontSize: '1rem', marginBottom: '1rem' }}
      />

      <button
        onClick={handleSearch}
        disabled={loading}
        style={{
          padding: '0.75rem 1.5rem',
          fontSize: '1rem',
          backgroundColor: '#0070f3',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Searching...' : 'Find Matches'}
      </button>

      {error && <p style={{ color: 'red', marginTop: '1rem' }}>{error}</p>}

      {results.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h2>🏅 Top Matches</h2>
          {results.map((athlete, index) => (
            <div
              key={athlete.id || index}
              style={{
                marginBottom: '1.5rem',
                padding: '1rem',
                border: '1px solid #ccc',
                borderRadius: '8px',
              }}
            >
              <p><strong>@{athlete.Insta_handle}</strong></p>
              <p><strong>Sport:</strong> {athlete.Sport}</p>
              <p><strong>Location:</strong> {athlete.Location}</p>
              <p><strong>Followers:</strong> {athlete.Followers}</p>
              <p><strong>About me:</strong> {athlete.About_me}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

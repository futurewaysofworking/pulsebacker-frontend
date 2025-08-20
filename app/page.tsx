'use client';

import { useCallback, useState } from 'react';

type Athlete = {
  id?: string;
  Insta_handle?: string;
  Sport?: string;
  Location?: string;
  Followers?: number | string;
  About_me?: string;
  similarity?: number; // optional, if your API returns it
};

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [results, setResults] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleSearch = useCallback(async () => {
    const q = prompt.trim();
    if (!q) {
      setError('Please enter a brief description of the athlete you’re looking for.');
      return;
    }

    setLoading(true);
    setError('');
    setResults([]);

    try {
      const res = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: q }),
      });

      // Safeguard against empty/invalid JSON
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};

      if (res.ok && Array.isArray(data.matches)) {
        setResults(data.matches as Athlete[]);
        if (!data.matches.length) setError('No matches found. Try a broader prompt or different values.');
      } else {
        setError(data?.error || 'No matches found or an error occurred.');
      }
    } catch (e) {
      console.error(e);
      setError('Error fetching results. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [prompt]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <main
      style={{
        padding: '2rem',
        maxWidth: 820,
        margin: '0 auto',
        fontFamily: 'Orbitron, system-ui, Arial, sans-serif', // CHANGED: font family
        backgroundColor: '#F0B53E', // CHANGED: page background
        color: '#EE227D', // CHANGED: font color
      }}
    >
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}> Find the Right Sportsperson for your brand </h1>
      <p style={{ marginTop: 0, color: '#EE227D', marginBottom: '1rem' }}>
        Describe your ideal partner. For example: <em>“Brisbane-based gymnast who mentors youth and values consistency.”</em>
      </p>

      <label htmlFor="prompt" style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>
        Your brief
      </label>
      <textarea
        id="prompt"
        placeholder="e.g. Female swimmer, sustainability focused, strong community presence"
        rows={5}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={onKeyDown}
        style={{
          width: '100%',
          padding: '1rem',
          fontSize: '1rem',
          lineHeight: 1.5,
          border: '1px solid #ccc',
          borderRadius: 8,
          outline: 'none',
          color: '#EE227D', // CHANGED: font color
        }}
      />

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
        <button
          onClick={handleSearch}
          disabled={loading}
          style={{
            padding: '0.75rem 1.25rem',
            fontSize: '1rem',
            backgroundColor: '#F0B53E', // CHANGED: button background
            color: '#EE227D', // CHANGED: button font color
            border: 'none',
            borderRadius: 8,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Searching…' : 'Find Matches'}
        </button>
        <span style={{ fontSize: 12, color: '#EE227D' }}>Tip: ⌘/Ctrl + Enter to search</span>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 16,
            padding: '10px 12px',
            borderRadius: 8,
            background: '#fff2f2',
            color: '#EE227D', // CHANGED: font color
            border: '1px solid #ffcdd2',
          }}
        >
          {error}
        </div>
      )}

      {results.length > 0 && (
        <section style={{ marginTop: '2rem' }}>
          <h2 style={{ marginBottom: '1rem' }}> Top Matches</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            {results.map((athlete, index) => {
              const score =
                typeof athlete.similarity === 'number'
                  ? `${(athlete.similarity * 100).toFixed(1)}%`
                  : undefined;

              return (
                <article
                  key={athlete.id || index}
                  style={{
                    padding: '1rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: 12,
                    background: '#fff',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <p
                      style={{
                        margin: 0,
                        fontWeight: 700,
                        filter: 'blur(4px)', // CHANGED: blur handle
                        userSelect: 'none', // CHANGED: prevent text selection
                      }}
                    >
                      @{athlete.Insta_handle || 'unknown'}
                    </p>
                    {score && (
                      <span
                        title="Match score"
                        style={{
                          fontSize: 12,
                          padding: '2px 8px',
                          background: '#eef2ff',
                          color: '#EE227D', // CHANGED: font color
                          borderRadius: 999,
                        }}
                      >
                        {score}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '6px 0 0 0' }}>
                    <strong>Sport:</strong> {athlete.Sport || '—'}
                  </p>
                  <p style={{ margin: '4px 0 0 0' }}>
                    <strong>Location:</strong> {athlete.Location || '—'}
                  </p>
                  <p style={{ margin: '4px 0 0 0' }}>
                    <strong>Followers:</strong> {athlete.Followers ?? '—'}
                  </p>
                  <p style={{ margin: '8px 0 0 0', color: '#EE227D' }}>
                    <strong>About:</strong> {athlete.About_me || '—'}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}

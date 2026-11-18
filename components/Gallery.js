'use client';
import { useCallback, useEffect, useState } from 'react';
import Pager from './Pager';

const fmtSize = (b) => (!b ? '' : b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB');

export default function Gallery() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null); // index within current page
  const [prog, setProg] = useState({}); // photoId -> 0..100 (or -1 = unknown size)
  const [name, setName] = useState('');

  useEffect(() => { setName(localStorage.getItem('dl_name') || ''); }, []);
  useEffect(() => {
    setData(null); setError('');
    fetch(`/api/photos?page=${page}`)
      .then((r) => r.json()).then(setData)
      .catch(() => setError('Could not load photos. Check your connection and try again.'));
  }, [page]);

  const photos = data?.photos || [];

  const download = useCallback(async (p) => {
    if (prog[p.id] !== undefined) return;
    setProg((s) => ({ ...s, [p.id]: 0 }));
    try {
      const r = await fetch(`/api/photos/${p.id}/download`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
      });
      if (!r.ok) throw new Error();
      const { url, filename } = await r.json();
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const total = Number(res.headers.get('content-length')) || p.size || 0;
      const reader = res.body.getReader();
      const chunks = []; let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value); got += value.length;
        setProg((s) => ({ ...s, [p.id]: total ? Math.min(100, Math.round((got / total) * 100)) : -1 }));
      }
      const blob = new Blob(chunks, { type: res.headers.get('content-type') || 'image/jpeg' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    } catch {
      alert('The download failed. Please try again.');
    } finally {
      setProg((s) => { const n = { ...s }; delete n[p.id]; return n; });
    }
  }, [name, prog]);

  useEffect(() => {
    if (preview === null) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setPreview(null);
      if (e.key === 'ArrowRight') setPreview((i) => Math.min(photos.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setPreview((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview, photos.length]);

  const DlButton = ({ p, big }) => {
    const v = prog[p.id];
    if (v === undefined) return <button className={big ? 'btn primary' : 'btn'} onClick={() => download(p)}>Download</button>;
    return (
      <div className="bar" role="progressbar" aria-valuenow={v < 0 ? undefined : v} aria-label="Download progress">
        <div className={v < 0 ? 'fill indet' : 'fill'} style={v < 0 ? undefined : { width: v + '%' }} />
        <span>{v < 0 ? 'Downloading…' : v + '%'}</span>
      </div>
    );
  };

  return (
    <div className="shell">
      <header className="top">
        <h1>Photo Library</h1>
        <span className="count">{data ? `${data.total} photo${data.total === 1 ? '' : 's'}` : ''}</span>
      </header>

      <main className="canvas">
        {error && <p className="msg">{error}</p>}
        {!data && !error && <p className="msg">Loading photos…</p>}
        {data && photos.length === 0 && <p className="msg">No photos have been added yet.</p>}
        <div className="grid">
          {photos.map((p, i) => (
            <figure className="cell" key={p.id}>
              <button className="thumb" onClick={() => setPreview(i)} aria-label={`Preview ${p.title || p.filename}`}>
                <img src={p.thumb_url} alt={p.title || p.filename} loading="lazy" />
              </button>
              <figcaption title={p.filename}>{p.title || p.filename}<small>{fmtSize(p.size)}</small></figcaption>
              <div className="actions">
                <button className="btn" onClick={() => setPreview(i)}>Preview</button>
                <DlButton p={p} />
              </div>
            </figure>
          ))}
        </div>
      </main>

      <footer className="status">
        <Pager page={page} pages={data?.pages || 1} onChange={(n) => { setPage(n); window.scrollTo({ top: 0 }); }} />
        <label className="who">
          Your name (optional)
          <input value={name} maxLength={80} placeholder="e.g. Mr. Banda"
            onChange={(e) => { setName(e.target.value); localStorage.setItem('dl_name', e.target.value); }} />
        </label>
      </footer>

      {preview !== null && photos[preview] && (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={() => setPreview(null)}>
          <div className="lb-bar" onClick={(e) => e.stopPropagation()}>
            <span>{photos[preview].title || photos[preview].filename} <small>{preview + 1} of {photos.length}</small></span>
            <div className="lb-actions">
              <DlButton p={photos[preview]} big />
              <button className="btn" onClick={() => setPreview(null)}>Close</button>
            </div>
          </div>
          <button className="nav left" disabled={preview === 0} onClick={(e) => { e.stopPropagation(); setPreview(preview - 1); }} aria-label="Previous photo">‹</button>
          <img className="lb-img" src={photos[preview].url} alt={photos[preview].title || ''} onClick={(e) => e.stopPropagation()} />
          <button className="nav right" disabled={preview === photos.length - 1} onClick={(e) => { e.stopPropagation(); setPreview(preview + 1); }} aria-label="Next photo">›</button>
        </div>
      )}
    </div>
  );
}

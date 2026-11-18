'use client';
import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Pager from './Pager';

const MAX_SELECTION = 24;
const WHATSAPP_URL = `https://wa.me/265996103277?text=${encodeURIComponent('Hi Kingsley, I am contacting you about my experience with KIA Mens Welfare Memoirs. My feedback or problem is: ')}`;
const fmtSize = (b) => (!b ? '' : b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB');

export default function Gallery() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null); // index within current page
  const [prog, setProg] = useState({}); // photoId -> 0..100 (or -1 = unknown size)
  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [imageFallbacks, setImageFallbacks] = useState({});

  useEffect(() => { setName(localStorage.getItem('dl_name') || ''); }, []);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError('');
    fetch(`/api/photos?page=${page}`, { signal: controller.signal })
      .then(async (r) => {
        const result = await r.json();
        if (!r.ok) throw new Error(result.error || `Could not load photos (${r.status}).`);
        return result;
      })
      .then(setData)
      .catch((e) => {
        if (e?.name !== 'AbortError') setError(e?.message || 'Could not load photos. Check your connection and try again.');
      });
    return () => controller.abort();
  }, [page]);

  const photos = data?.photos || [];
  const allOnPageSelected = photos.length > 0 && photos.every((p) => selectedIds.includes(Number(p.id)));
  const canSelectPage = allOnPageSelected || selectedIds.length + photos.filter((p) => !selectedIds.includes(Number(p.id))).length <= MAX_SELECTION;

  const toggleSelection = (photoId) => {
    setSelectedIds((current) => current.includes(photoId)
      ? current.filter((id) => id !== photoId)
      : current.length < MAX_SELECTION ? [...current, photoId] : current);
  };

  const togglePageSelection = () => {
    const pageIds = photos.map((p) => Number(p.id));
    if (pageIds.every((id) => selectedIds.includes(id))) {
      setSelectedIds((current) => current.filter((id) => !pageIds.includes(id)));
    } else if (selectedIds.length + pageIds.filter((id) => !selectedIds.includes(id)).length <= MAX_SELECTION) {
      setSelectedIds((current) => [...new Set([...current, ...pageIds])]);
    }
  };

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
        <h1>KIA Mens Welfare Memoirs</h1>
        <span className="count">{data ? `${data.total} photo${data.total === 1 ? '' : 's'}` : ''}</span>
      </header>

      <main className="canvas">
        {error && <p className="msg" role="alert">{error}</p>}
        {!data && !error && <div className="grid loading-grid" aria-label="Loading photos" aria-live="polite">
          {Array.from({ length: 8 }, (_, i) => <div className="skeleton-card" key={i}><div className="skeleton-image" /><div className="skeleton-line" /></div>)}
        </div>}
        {data && photos.length === 0 && <p className="msg">No photos have been added yet.</p>}
        {data && photos.length > 0 && <div className="gallery-tools">
          <span>Choose photos to download them together as a ZIP.</span>
          <button className="btn" onClick={togglePageSelection} disabled={!canSelectPage}>
            {allOnPageSelected ? 'Deselect this page' : 'Select this page'}
          </button>
        </div>}
        <div className="grid">
          {photos.map((p, i) => {
            const photoId = Number(p.id);
            const isSelected = selectedIds.includes(photoId);
            return (
              <figure className={`cell${isSelected ? ' selected' : ''}`} key={p.id}>
                <div className="photo-media">
                  <button className="thumb" onClick={() => setPreview(i)} aria-label={`Preview ${p.title || p.filename}`}>
                    <Image
                      src={imageFallbacks[photoId] ? p.url : (p.thumb_url || p.url)}
                      alt={p.title || p.filename}
                      width={360}
                      height={270}
                      sizes="(max-width: 520px) 44vw, (max-width: 800px) 29vw, 15vw"
                      priority={i < 4}
                      className="gallery-thumb-image"
                      onError={() => setImageFallbacks((current) => ({ ...current, [photoId]: current[photoId] ? 'failed' : true }))}
                      style={{ visibility: imageFallbacks[photoId] === 'failed' ? 'hidden' : 'visible' }}
                    />
                  </button>
                  <label className={`select-toggle${isSelected ? ' is-selected' : ''}`}>
                    <input type="checkbox" checked={isSelected} disabled={!isSelected && selectedIds.length >= MAX_SELECTION} onChange={() => toggleSelection(photoId)} aria-label={`Select ${p.title || p.filename}`} />
                    <span>Select</span>
                  </label>
                </div>
                <figcaption title={p.filename}>{p.title || p.filename}<small>{fmtSize(p.size)}</small></figcaption>
                <div className="actions">
                  <button className="btn" onClick={() => setPreview(i)}>Preview</button>
                  <DlButton p={p} />
                </div>
              </figure>
            );
          })}
        </div>
      </main>

      <footer className="status">
        {selectedIds.length > 0 && <div className="bulk-actions" aria-live="polite">
          <div className="bulk-summary"><strong>{selectedIds.length} selected</strong><small>Up to {MAX_SELECTION} photos per ZIP</small></div>
          <button className="btn" onClick={() => setSelectedIds([])}>Clear</button>
          <a className="btn primary" href={`/api/photos/archive?ids=${selectedIds.join(',')}`} target="_blank" rel="noopener noreferrer">Download ZIP</a>
        </div>}
        <Pager page={page} pages={data?.pages || 1} onChange={(n) => { setPage(n); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
        <label className="who">
          Your name (optional)
          <input value={name} maxLength={80} placeholder="e.g. Mr. Banda"
            onChange={(e) => { setName(e.target.value); localStorage.setItem('dl_name', e.target.value); }} />
        </label>
        <div className="contact-footer"><span>Any problem Contact Kingsley Phiri Click </span><a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">here</a></div>
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

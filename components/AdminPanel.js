'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';
import Pager from './Pager';

const WHATSAPP_URL = `https://wa.me/265996103277?text=${encodeURIComponent('Hi Kingsley, I am contacting you about my experience with KIA Mens Welfare Memoirs. My feedback or problem is: ')}`;

async function makeThumb(file, max = 360) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  const context = c.getContext('2d', { alpha: false });
  if (!context) throw new Error('Could not prepare the thumbnail on this device.');
  context.imageSmoothingQuality = 'high';
  context.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return new Promise((res, rej) => c.toBlob((blob) => blob ? res(blob) : rej(new Error('Could not create the thumbnail.')), 'image/jpeg', 0.74));
}

const Bar = ({ value, label }) => (
  <div className="bar wide" role="progressbar" aria-valuenow={value} aria-label={label}>
    <div className="fill" style={{ width: value + '%' }} /><span>{value}%</span>
  </div>
);

function Uploader({ onDone }) {
  const [items, setItems] = useState([]); // {name, pct, state}
  const [busy, setBusy] = useState(false);
  const input = useRef();

  const patch = (i, o) => setItems((arr) => arr.map((x, j) => (j === i ? { ...x, ...o } : x)));

  async function start(files) {
    files = [...files];
    if (!files.length) return;
    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    setBusy(true);
    setItems(files.map((f) => ({
      name: f.name,
      pct: 0,
      state: supportedTypes.includes(f.type) ? 'waiting' : 'failed',
      error: supportedTypes.includes(f.type) ? '' : `Unsupported image format (${f.type || 'unknown type'}). Use JPEG, PNG, WebP, or GIF.`,
    })));
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!supportedTypes.includes(f.type)) continue;
      try {
        patch(i, { state: 'uploading' });
        const thumb = await makeThumb(f);
        const main = await upload('photos/' + f.name, f, {
          access: 'public', handleUploadUrl: '/api/admin/upload', multipart: f.size > 8 * 1024 * 1024,
          onUploadProgress: ({ percentage }) => patch(i, { pct: Math.round(percentage * 0.92) }),
        });
        const th = await upload('thumbs/' + f.name.replace(/\.\w+$/, '') + '.jpg', thumb, {
          access: 'public', handleUploadUrl: '/api/admin/upload', contentType: 'image/jpeg',
        });
        const r = await fetch('/api/admin/photos', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: f.name.replace(/\.\w+$/, ''), filename: f.name, url: main.url, thumbUrl: th.url, size: f.size }),
        });
        if (!r.ok) {
          const result = await r.json().catch(() => ({}));
          throw new Error(result.error || `Could not save photo (${r.status}).`);
        }
        patch(i, { pct: 100, state: 'done' });
      } catch (e) {
        patch(i, { state: 'failed', error: e?.message || 'Upload failed. Check storage and database configuration, then try again.' });
      }
    }
    setBusy(false); onDone();
  }

  const done = items.filter((x) => x.state === 'done' || x.state === 'failed').length;
  const overall = items.length ? Math.round(items.reduce((a, x) => a + x.pct, 0) / items.length) : 0;

  return (
    <section>
      <div className="drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (!busy) start(e.dataTransfer.files); }}>
        <p>Drag photos here, or</p>
        <button className="btn primary" disabled={busy} onClick={() => input.current.click()}>Choose photos</button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => { start(e.target.files); e.target.value = ''; }} />
      </div>
      {items.length > 0 && (
        <>
          <p className="sub">{busy ? `Uploading ${done + 1 > items.length ? items.length : done + 1} of ${items.length}` : `Finished: ${items.filter((x) => x.state === 'done').length} uploaded, ${items.filter((x) => x.state === 'failed').length} failed`}</p>
          <Bar value={overall} label="Overall upload progress" />
          <ul className="files">
            {items.map((x, i) => (
              <li key={i}><span className="fn">{x.name}</span>
                {x.state === 'failed' ? <><em className="err">Failed</em><span className="file-error">{x.error}</span></> : x.state === 'waiting' ? <em>Waiting</em> : <Bar value={x.pct} label={x.name} />}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Manage({ refreshKey }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const load = useCallback(() => {
    setError('');
    fetch(`/api/photos?page=${page}`)
      .then(async (r) => {
        const result = await r.json();
        if (!r.ok) throw new Error(result.error || `Could not load photos (${r.status}).`);
        return result;
      })
      .then(setData)
      .catch((e) => setError(e?.message || 'Could not load photos.'));
  }, [page]);
  useEffect(() => { load(); }, [load, refreshKey]);

  async function remove(p) {
    if (!confirm(`Delete "${p.title || p.filename}"? This cannot be undone.`)) return;
    setDeletingId(p.id);
    setNotice(null);
    try {
      const r = await fetch(`/api/admin/photos/${p.id}`, { method: 'DELETE' });
      const result = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(result.error || `Could not delete the photo (${r.status}).`);

      const remainingTotal = Math.max(0, Number(data?.total || 0) - 1);
      const nextPages = Math.max(1, Math.ceil(remainingTotal / (Number(data?.perPage) || 24)));
      setData((current) => current ? {
        ...current,
        photos: current.photos.filter((photo) => photo.id !== p.id),
        total: remainingTotal,
        pages: nextPages,
      } : current);
      setNotice({
        type: result.storageDeleted === false ? 'warning' : 'success',
        text: result.storageDeleted === false
          ? 'The photo was removed from the library, but its stored image files could not be deleted. Check BLOB_READ_WRITE_TOKEN.'
          : 'Photo deleted successfully.',
      });
      if (page > nextPages) setPage(nextPages);
      else load();
    } catch (e) {
      setNotice({ type: 'error', text: e?.message || 'Could not delete the photo. Please try again.' });
    } finally {
      setDeletingId(null);
    }
  }

  if (error) return <p className="msg" role="alert">{error}</p>;
  if (!data) return <p className="msg">Loading…</p>;
  return (
    <section>
      {notice && <p className={`manage-notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
      {data.photos.length === 0 && <p className="msg">No photos yet. Use the Upload tab to add some.</p>}
      <div className="grid admin-grid">
        {data.photos.map((p) => (
          <figure className="cell" key={p.id}>
            <div className="thumb"><img src={p.thumb_url || p.url} alt="" loading="lazy" onError={(e) => {
              if (e.currentTarget.src !== p.url) e.currentTarget.src = p.url;
              else e.currentTarget.style.visibility = 'hidden';
            }} /></div>
            <figcaption title={p.filename}>{p.title || p.filename}</figcaption>
            <div className="actions"><button className="btn danger" disabled={deletingId !== null} onClick={() => remove(p)}>{deletingId === p.id ? 'Deleting…' : 'Delete'}</button></div>
          </figure>
        ))}
      </div>
      <Pager page={page} pages={data.pages} onChange={setPage} />
    </section>
  );
}

function Report() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  useEffect(() => { fetch(`/api/admin/report?page=${page}`).then((r) => r.json()).then(setData); }, [page]);
  if (!data) return <p className="msg">Loading…</p>;
  const device = (ua = '') => {
    const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac OS/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : 'Unknown';
    const br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
    return [os, br].filter(Boolean).join(' / ');
  };
  return (
    <section>
      <div className="stats">
        <div><b>{data.stats.total}</b> downloads</div>
        <div><b>{data.stats.visitors}</b> different IP addresses</div>
        <div><b>{data.stats.photos}</b> photos downloaded</div>
        <a className="btn" href="/api/admin/report?format=csv">Export CSV</a>
      </div>
      {data.rows.length === 0 ? <p className="msg">Nobody has downloaded a photo yet.</p> : (
        <div className="scroll">
          <table>
            <thead><tr><th>Date</th><th>Photo</th><th>Name</th><th>IP address</th><th>Location</th><th>Device</th></tr></thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.downloaded_at).toLocaleString()}</td>
                  <td>{r.photo_title}</td>
                  <td>{r.downloader_name || <i>not given</i>}</td>
                  <td>{r.ip}</td>
                  <td>{[r.city, r.country].filter(Boolean).join(', ') || '—'}</td>
                  <td>{device(r.user_agent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} pages={data.pages} onChange={setPage} />
    </section>
  );
}

export default function AdminPanel() {
  const [tab, setTab] = useState('upload');
  const [refreshKey, setRefreshKey] = useState(0);
  async function logout() { await fetch('/api/admin/logout', { method: 'POST' }); window.location.href = '/admin/login'; }
  return (
    <div className="shell admin">
      <header className="top">
        <h1>Admin</h1>
        <nav className="tabs">
          {[['upload', 'Upload'], ['photos', 'Photos'], ['report', 'Downloads']].map(([k, l]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </nav>
        <span className="spacer" />
        <a className="btn" href="/">View gallery</a>
        <button className="btn" onClick={logout}>Sign out</button>
      </header>
      <main className="canvas">
        {tab === 'upload' && <Uploader onDone={() => setRefreshKey((k) => k + 1)} />}
        {tab === 'photos' && <Manage refreshKey={refreshKey} />}
        {tab === 'report' && <Report />}
      </main>
      <footer className="site-footer"><span>Any problem Contact Kingsley Phiri Click </span><a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">here</a></footer>
    </div>
  );
}

'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';
import Pager from './Pager';

async function makeThumb(file, max = 480) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob(res, 'image/jpeg', 0.82));
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
    files = [...files].filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    setBusy(true);
    setItems(files.map((f) => ({ name: f.name, pct: 0, state: 'waiting' })));
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
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
        if (!r.ok) throw new Error('save failed');
        patch(i, { pct: 100, state: 'done' });
      } catch (e) {
        patch(i, { state: 'failed' });
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
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { start(e.target.files); e.target.value = ''; }} />
      </div>
      {items.length > 0 && (
        <>
          <p className="sub">{busy ? `Uploading ${done + 1 > items.length ? items.length : done + 1} of ${items.length}` : `Finished: ${items.filter((x) => x.state === 'done').length} uploaded, ${items.filter((x) => x.state === 'failed').length} failed`}</p>
          <Bar value={overall} label="Overall upload progress" />
          <ul className="files">
            {items.map((x, i) => (
              <li key={i}><span className="fn">{x.name}</span>
                {x.state === 'failed' ? <em className="err">Failed</em> : x.state === 'waiting' ? <em>Waiting</em> : <Bar value={x.pct} label={x.name} />}
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
  const load = useCallback(() => fetch(`/api/photos?page=${page}`).then((r) => r.json()).then(setData), [page]);
  useEffect(() => { load(); }, [load, refreshKey]);

  async function remove(p) {
    if (!confirm(`Delete "${p.title || p.filename}"? This cannot be undone.`)) return;
    const r = await fetch(`/api/admin/photos/${p.id}`, { method: 'DELETE' });
    if (r.ok) load(); else alert('Could not delete the photo.');
  }

  if (!data) return <p className="msg">Loading…</p>;
  return (
    <section>
      {data.photos.length === 0 && <p className="msg">No photos yet. Use the Upload tab to add some.</p>}
      <div className="grid admin-grid">
        {data.photos.map((p) => (
          <figure className="cell" key={p.id}>
            <div className="thumb"><img src={p.thumb_url} alt="" loading="lazy" /></div>
            <figcaption title={p.filename}>{p.title || p.filename}</figcaption>
            <div className="actions"><button className="btn danger" onClick={() => remove(p)}>Delete</button></div>
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
    </div>
  );
}

'use client';

export default function Pager({ page, pages, onChange }) {
  if (pages <= 1) return null;
  const nums = [];
  const from = Math.max(1, Math.min(page - 2, pages - 4));
  const to = Math.min(pages, from + 4);
  for (let i = from; i <= to; i++) nums.push(i);
  return (
    <nav className="pager" aria-label="Pages">
      <button disabled={page === 1} onClick={() => onChange(1)}>First</button>
      <button disabled={page === 1} onClick={() => onChange(page - 1)}>Previous</button>
      {nums.map((n) => (
        <button key={n} className={n === page ? 'on' : ''} aria-current={n === page ? 'page' : undefined} onClick={() => onChange(n)}>{n}</button>
      ))}
      <button disabled={page === pages} onClick={() => onChange(page + 1)}>Next</button>
      <button disabled={page === pages} onClick={() => onChange(pages)}>Last</button>
    </nav>
  );
}

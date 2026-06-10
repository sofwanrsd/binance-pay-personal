import React, { useState, useEffect } from 'react';
import { getCreds, api } from '../api.js';

const METHOD_COLOR = { get: '#22c55e', post: '#8b7cff', put: '#eab308', delete: '#ef4444' };

export default function Docs() {
  const [spec, setSpec] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/openapi.json')
      .then((r) => r.json())
      .then(setSpec)
      .catch((e) => setError('Gagal memuat openapi.json: ' + e.message));
  }, []);

  if (error) return <div className="container"><div className="card"><div className="alert alert-error">{error}</div></div></div>;
  if (!spec) return <div className="container"><div className="card"><div className="empty-state"><span className="spinner" />Memuat spec...</div></div></div>;

  const creds = getCreds();
  const hasCreds = creds.apiKey && creds.apiSecret;

  // flatten paths -> daftar endpoint
  const endpoints = [];
  for (const [path, methods] of Object.entries(spec.paths || {})) {
    for (const [method, op] of Object.entries(methods)) {
      endpoints.push({ path, method, op });
    }
  }

  return (
    <div className="container">
      <div className="card">
        <h2>{spec.info?.title || 'API Docs'}</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {spec.info?.description}
        </p>
        <div className={`creds-pill ${hasCreds ? 'ok' : ''}`}>
          <span className="dot" />
          {hasCreds
            ? `Credentials aktif — ${creds.apiKey.slice(0, 6)}••••${creds.payId ? ' · Pay ID ' + creds.payId : ''}`
            : 'Credentials belum diset — set di Dashboard untuk try-out'}
        </div>
      </div>

      {endpoints.map((e, i) => <Endpoint key={i} {...e} />)}
    </div>
  );
}

function Endpoint({ path, method, op }) {
  const [open, setOpen] = useState(false);
  const color = METHOD_COLOR[method] || '#888';

  return (
    <div className="card endpoint">
      <div className="ep-head" onClick={() => setOpen((o) => !o)}>
        <span className="ep-method" style={{ background: color }}>{method.toUpperCase()}</span>
        <span className="ep-path">{path}</span>
        <span className="ep-summary">{op.summary}</span>
        <span className="ep-chevron" style={{ transform: open ? 'rotate(90deg)' : 'none' }}>›</span>
      </div>
      {open && <EndpointBody path={path} method={method} op={op} />}
    </div>
  );
}

function EndpointBody({ path, method, op }) {
  const [body, setBody] = useState(() => sampleBody(op));
  const [pathParams, setPathParams] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const params = (op.parameters || []).filter((p) => p.in === 'path');

  const tryIt = async () => {
    setLoading(true);
    setResult(null);
    let url = path;
    for (const p of params) url = url.replace(`{${p.name}}`, encodeURIComponent(pathParams[p.name] || ''));
    const opts = { method: method.toUpperCase() };
    if (method !== 'get' && body.trim()) opts.body = body;
    const r = await api(url, opts);
    setLoading(false);
    setResult(r);
  };

  return (
    <div className="ep-body">
      {op.description && <p className="ep-desc">{op.description}</p>}

      {params.length > 0 && (
        <div className="ep-section">
          <div className="method-label">Path Parameters</div>
          {params.map((p) => (
            <div className="field" key={p.name} style={{ marginTop: 8 }}>
              <label>{p.name}{p.required && ' *'}</label>
              <input type="text" placeholder={p.example || p.schema?.example || ''}
                value={pathParams[p.name] || ''}
                onChange={(e) => setPathParams({ ...pathParams, [p.name]: e.target.value })} />
            </div>
          ))}
        </div>
      )}

      {method !== 'get' && (
        <div className="ep-section">
          <div className="method-label">Request Body (JSON)</div>
          <textarea className="ep-textarea" value={body} rows={Math.min(body.split('\n').length + 1, 14)}
            onChange={(e) => setBody(e.target.value)} spellCheck={false} />
        </div>
      )}

      <div className="btn-row">
        <button className="btn btn-primary" onClick={tryIt} disabled={loading}>
          {loading ? <><span className="spinner" />Mengirim...</> : 'Try it out'}
        </button>
      </div>

      {result && (
        <div className="ep-section">
          <div className="method-label">
            Response <span style={{ color: result.ok ? '#4ade80' : '#f87171' }}>· {result.status}</span>
          </div>
          <pre className="ep-pre">{JSON.stringify(result.data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

// Bangun contoh body dari schema requestBody
function sampleBody(op) {
  const schema = op.requestBody?.content?.['application/json']?.schema;
  if (!schema || !schema.properties) return '';
  const obj = {};
  for (const [key, prop] of Object.entries(schema.properties)) {
    if (prop.example !== undefined) obj[key] = prop.example;
    else if (prop.type === 'number') obj[key] = 0;
    else if (prop.type === 'boolean') obj[key] = false;
    else obj[key] = '';
  }
  return JSON.stringify(obj, null, 2);
}

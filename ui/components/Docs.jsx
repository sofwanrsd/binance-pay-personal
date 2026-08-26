import React, { useState, useEffect } from 'react';
import { getCreds, api, copy } from '../clientApi.js';
import { FileText, Search, Play, Copy, ChevronRight } from 'lucide-react';

const METHOD_COLOR = {
  get: 'var(--binance-green)',
  post: 'var(--binance-yellow)',
  put: '#eab308',
  delete: 'var(--binance-red)',
};

export default function Docs() {
  const [spec, setSpec] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/openapi.json')
      .then((r) => r.json())
      .then(setSpec)
      .catch((e) => setError('Gagal memuat openapi.json: ' + e.message));
  }, []);

  if (error)
    return (
      <div className="container">
        <div className="card">
          <div className="alert alert-error">{error}</div>
        </div>
      </div>
    );
  if (!spec)
    return (
      <div className="container">
        <div className="card">
          <div className="empty-state">
            <span className="spinner" /> Memuat API Specification...
          </div>
        </div>
      </div>
    );

  const creds = getCreds();
  const hasCreds = creds.apiKey && creds.apiSecret;

  const endpoints = [];
  for (const [path, methods] of Object.entries(spec.paths || {})) {
    for (const [method, op] of Object.entries(methods)) {
      endpoints.push({ path, method, op });
    }
  }

  const filteredEndpoints = endpoints.filter((e) => {
    const q = search.toLowerCase();
    return !q || e.path.toLowerCase().includes(q) || e.op.summary?.toLowerCase().includes(q);
  });

  return (
    <div className="container">
      <div className="card">
        <div className="card-title docs-header-title">
          <h2>
            <span className="title-icon"><FileText size={20} /></span>
            <span>{spec.info?.title || 'Dokumentasi API Interactive'}</span>
          </h2>
          <div className="input-wrap docs-search-wrap">
            <input
              type="text"
              placeholder="Cari endpoint API..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, lineHeight: 1.6 }}>
          {spec.info?.description}
        </p>

        <div className={`status-pill status-pill-card ${hasCreds ? 'status-connected' : 'status-disconnected'}`} style={{ marginTop: 14 }}>
          <span className="status-dot" />
          <span>
            {hasCreds
              ? `Credentials Aktif — ${creds.apiKey.slice(0, 6)}••••${creds.payId ? ' · Pay ID ' + creds.payId : ''}`
              : 'Credentials belum diset — isi di tab Pengaturan untuk langsung mencoba Endpoint API (Try Out)'}
          </span>
        </div>
      </div>

      <div className="endpoints-list">
        {filteredEndpoints.map((e, i) => (
          <Endpoint key={i} {...e} creds={creds} />
        ))}
      </div>
    </div>
  );
}

function Endpoint({ path, method, op, creds }) {
  const [open, setOpen] = useState(false);
  const color = METHOD_COLOR[method] || 'var(--text-secondary)';

  return (
    <div className="card endpoint">
      <div className="ep-head" onClick={() => setOpen((o) => !o)}>
        <div className="ep-head-left">
          <span className="ep-method" style={{ background: color }}>
            {method.toUpperCase()}
          </span>
          <span className="ep-path">{path}</span>
        </div>
        <div className="ep-head-right">
          <span className="ep-summary">{op.summary}</span>
          <span className="ep-chevron" style={{ transform: open ? 'rotate(90deg)' : 'none' }}>
            <ChevronRight size={18} />
          </span>
        </div>
      </div>
      {open && <EndpointBody path={path} method={method} op={op} creds={creds} />}
    </div>
  );
}

function EndpointBody({ path, method, op, creds }) {
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

  const copyCurl = () => {
    let url = `${window.location.origin}/api${path}`;
    for (const p of params) url = url.replace(`{${p.name}}`, pathParams[p.name] || `:${p.name}`);

    let cmd = `curl -X ${method.toUpperCase()} "${url}" \\\n  -H "Content-Type: application/json"`;
    if (creds.apiKey) cmd += ` \\\n  -H "X-Binance-Api-Key: ${creds.apiKey}"`;
    if (creds.apiSecret) cmd += ` \\\n  -H "X-Binance-Api-Secret: ${creds.apiSecret}"`;
    if (method !== 'get' && body.trim()) {
      cmd += ` \\\n  -d '${body.replace(/\n/g, '')}'`;
    }
    copy(cmd, 'Perintah cURL');
  };

  return (
    <div className="ep-body">
      {op.description && <p className="ep-desc">{op.description}</p>}

      {params.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="inv-label" style={{ fontWeight: 700, marginBottom: 8 }}>Path Parameters</div>
          {params.map((p) => (
            <div className="field" key={p.name} style={{ marginTop: 8 }}>
              <label>
                {p.name} {p.required && <span className="required-star">*</span>}
              </label>
              <input
                type="text"
                placeholder={p.example || p.schema?.example || ''}
                value={pathParams[p.name] || ''}
                onChange={(e) => setPathParams({ ...pathParams, [p.name]: e.target.value })}
              />
            </div>
          ))}
        </div>
      )}

      {method !== 'get' && (
        <div style={{ marginTop: 14 }}>
          <div className="inv-label" style={{ fontWeight: 700, marginBottom: 8 }}>Request Body (JSON Schema)</div>
          <textarea
            className="ep-textarea"
            value={body}
            rows={Math.min(body.split('\n').length + 1, 14)}
            onChange={(e) => setBody(e.target.value)}
            spellCheck={false}
          />
        </div>
      )}

      <div className="btn-row">
        <button className="btn btn-primary" onClick={tryIt} disabled={loading}>
          {loading ? <span className="spinner" /> : <Play size={15} />}
          <span>Try It Out (Eksekusi API)</span>
        </button>
        <button className="btn btn-outline" onClick={copyCurl}>
          <Copy size={15} />
          <span>Salin Perintah cURL</span>
        </button>
      </div>

      {result && (
        <div style={{ marginTop: 16 }}>
          <div className="inv-label" style={{ fontWeight: 700, marginBottom: 8 }}>
            Response Status: <span style={{ color: result.ok ? 'var(--binance-green)' : 'var(--binance-red)' }}>{result.status}</span>
          </div>
          <pre className="ep-pre">{JSON.stringify(result.data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

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

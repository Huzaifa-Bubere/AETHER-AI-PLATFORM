import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiService } from '../services/api';
import { Card } from '../components/Card';
import { Button } from '../components/Button';

interface Source { _id: string; title: string; url: string; topic: string; license: string; enabled: boolean; status: string; chunkCount: number; refreshedAt?: string; lastError?: string }
export default function KnowledgeSourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = async () => {
    const response = await apiService.get<Source[]>('/admin/rag/sources');
    if (response.success && response.data) { setSources(response.data); setError(''); }
    else setError(response.error || 'Could not load knowledge sources.');
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  const running = sources.some(s => s.status === 'ingesting');
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => { void load(); }, 4000);
    return () => window.clearInterval(timer);
  }, [running]);

  const ingest = async (id: string, text?: string) => {
    const result = await apiService.post('/admin/rag/sources/' + id + '/ingest', text ? { text } : {});
    if (!result.success) throw new Error(result.error || 'Could not start ingestion.');
    setSources(rows => rows.map(s => s._id === id ? { ...s, status: 'ingesting' } : s));
    setNotice('Ingestion requested. Source status updates as processing completes.');
  };
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    const form = event.currentTarget, data = new FormData(form);
    try {
      const result = await apiService.post<Source>('/admin/rag/sources', Object.fromEntries(['title', 'url', 'topic', 'license'].map(k => [k, String(data.get(k) || '')])));
      if (!result.success || !result.data) throw new Error(result.error || 'Could not save source.');
      setSources(rows => [result.data!, ...rows]);
      await ingest(result.data._id, String(data.get('text') || '').trim() || undefined);
      form.reset();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };
  const refresh = async (id: string) => {
    setBusy(true); setError('');
    try { await ingest(id); } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };
  return <div className="mx-auto max-w-6xl space-y-6 px-5 py-24">
    <div><p className="text-sm font-medium text-primary">ATHER Administration</p><h1 className="mt-2 text-3xl font-semibold">Knowledge sources</h1>
      <p className="mt-2 text-muted-foreground">Maintain the reference material used to generate original assessment questions.</p></div>
    {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-red-50 p-4 text-destructive">{error} <button className="underline" onClick={() => void load()}>Retry loading</button></div>}
    {notice && <p role="status" className="rounded-lg bg-primary/10 p-4 text-primary">{notice}</p>}
    <Card>
      <h2 className="text-xl font-semibold">Add a trusted source</h2>
      <p className="mt-2 text-sm text-muted-foreground">Use documentation you have permission to process. Record its license or permission basis. You can import a focused section as text or fetch the public URL.</p>
      <form onSubmit={create} className="mt-5 grid gap-4 md:grid-cols-2">
        {([['title', 'Source title'], ['topic', 'Topic'], ['url', 'Documentation URL'], ['license', 'License or permission basis']] as const).map(([name, label]) =>
          <label key={name} className="text-sm font-medium">{label}<input name={name} type={name === 'url' ? 'url' : 'text'} required minLength={name === 'license' ? 10 : 2} maxLength={name === 'url' ? 2000 : name === 'license' ? 500 : 160} className="mt-2 w-full rounded-lg border border-border bg-background p-3" /></label>)}
        <label className="text-sm font-medium md:col-span-2">Permitted source text (optional)<textarea name="text" rows={5} minLength={200} maxLength={40000} className="mt-2 w-full rounded-lg border border-border bg-background p-3" placeholder="Paste a focused documentation section, or leave blank to fetch the URL." /></label>
        <div><Button type="submit" disabled={busy}>{busy ? 'Processing request…' : 'Save and ingest source'}</Button></div>
      </form>
    </Card>
    <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Source library</h2><Button variant="outline" size="sm" onClick={() => void load()}>Refresh status</Button></div>
    {loading ? <p role="status">Loading sources…</p> : sources.length === 0 ? <Card><p className="text-muted-foreground">No sources yet. Add documentation above, then create a source-grounded test.</p></Card> :
      <div className="grid gap-4 md:grid-cols-2">{sources.map(source => <Card key={source._id}>
        <div className="flex justify-between gap-3"><h3 className="font-semibold">{source.title}</h3><span className="rounded-md bg-muted px-2 py-1 text-xs">{source.status}</span></div>
        <p className="mt-2 text-sm text-muted-foreground">{source.topic} · {source.chunkCount} indexed sections</p>
        <a href={source.url} target="_blank" rel="noopener noreferrer" className="mt-2 block break-all text-sm text-primary underline">View source documentation</a>
        <p className="mt-2 text-xs text-muted-foreground">{source.license}</p>
        {source.refreshedAt && <p className="mt-2 text-xs text-muted-foreground">Last indexed {new Date(source.refreshedAt).toLocaleString()}</p>}
        {source.lastError && <p className="mt-3 text-sm text-destructive">{source.lastError}</p>}
        <div className="mt-4 flex gap-3"><Button variant="outline" size="sm" disabled={busy || source.status === 'ingesting' || !source.enabled} onClick={() => void refresh(source._id)}>Refresh from URL</Button></div>
      </Card>)}</div>}
    <p className="text-sm text-muted-foreground">After indexing, <Link to="/admin/aptitude/tests" className="text-primary underline">create a test template</Link> using the same topic. Questions are generated when the usable cache needs replenishing.</p>
  </div>;
}

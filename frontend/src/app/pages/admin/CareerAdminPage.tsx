import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Database, Upload, RefreshCw, Loader2, CheckCircle2, XCircle,
  Eye, Ban, Plus, FileJson, FileText,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import careerService from '../../services/career';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

interface AdminRole {
  _id: string; slug: string; name: string; category: string; isActive: boolean;
  skills: unknown[]; roadmapStages: unknown[]; roadmapNodes: unknown[]; lastReviewedAt?: string;
}

interface ImportResult {
  batchId: string; totalRows: number; acceptedRows: number; rejectedRows: number;
  unmappedRoles: number; rolesMapped: Record<string, number>;
  errors: Array<{ row: number; reason: string }>;
}

const SAMPLE_CSV = `job_title,description,location,experience
Backend Developer,"Build REST APIs with Node.js and PostgreSQL. Docker, Redis and AWS experience preferred. JWT authentication.",Mumbai,2-4 years
Frontend Developer,"React and TypeScript developer. Experience with Redux, Jest testing and responsive CSS.",Bengaluru,1-3 years
Data Analyst,"SQL, Excel and Power BI. Statistics and dashboarding for business stakeholders.",Pune,fresher`;

export default function CareerAdminPage() {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);

  const [importFormat, setImportFormat] = useState<'csv' | 'json'>('csv');
  const [sourceName, setSourceName] = useState('');
  const [region, setRegion] = useState('India');
  const [payload, setPayload] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [snapshots, setSnapshots] = useState<Array<{ _id: string; role: string; region: string; periodEnd: string; totalPostings: number; sourceMetadata: { sourceName: string } }>>([]);
  const [processing, setProcessing] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([careerService.adminListRoles(), careerService.adminSnapshots().catch(() => ({ snapshots: [], imports: [] }))])
      .then(([r, s]) => { setRoles(r); setSnapshots(s.snapshots); })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const toggleRole = async (role: AdminRole) => {
    try {
      if (role.isActive) {
        await apiDisable(role._id);
        toast.success(`${role.name} disabled`);
      } else {
        await apiEnable(role._id);
        toast.success(`${role.name} enabled`);
      }
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const apiDisable = async (id: string) => {
    const res = await fetch(`/api/admin/careers/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('accessToken') || localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error('Failed to disable role');
  };
  const apiEnable = async (id: string) => {
    const res = await fetch(`/api/admin/careers/${id}/enable`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${localStorage.getItem('accessToken') || localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error('Failed to enable role');
  };

  const runImport = async () => {
    if (!sourceName.trim()) { toast.error('Give the dataset a source name (e.g. "Internal DSP dataset Aug 2026")'); return; }
    if (!payload.trim()) { toast.error('Paste CSV or JSON content first'); return; }
    setImporting(true);
    setImportResult(null);
    try {
      const result = await careerService.adminImportMarket({ format: importFormat, sourceName, region, payload });
      setImportResult(result);
      toast.success(`Imported ${result.acceptedRows}/${result.totalRows} rows`);
      load();
    } catch (e: any) { toast.error(e?.response?.data?.message || e.message); } finally { setImporting(false); }
  };

  const generateSnapshot = async (roleSlug: string) => {
    setProcessing(roleSlug);
    try {
      const res = await careerService.adminProcessSnapshot(roleSlug, region);
      toast.success(`Snapshot created: ${res.totalPostings} postings for ${roleSlug}`);
      load();
    } catch (e: any) { toast.error(e?.response?.data?.message || e.message); } finally { setProcessing(null); }
  };

  return (
    <div className="min-h-screen bg-background text-foreground px-4 sm:px-6 lg:px-8 pt-20 pb-14">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link to="/admin" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Admin
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight">Career & Market Data</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage career roles, import job datasets, and generate market snapshots.</p>
        </div>

        {/* Market import */}
        <Card className="p-6 rounded-2xl space-y-4">
          <h2 className="text-base font-bold flex items-center gap-2"><Upload className="w-4 h-4 text-primary" /> Import market dataset</h2>
          <p className="text-xs text-muted-foreground">
            Upload job postings (CSV/JSON). AETHER extracts skills deterministically (no AI guessing), maps titles to roles, and stores rows for snapshot generation.
            Expected fields: <code className="bg-secondary px-1 rounded">job_title</code>, <code className="bg-secondary px-1 rounded">description</code>, optional <code className="bg-secondary px-1 rounded">location</code>, <code className="bg-secondary px-1 rounded">experience</code>, <code className="bg-secondary px-1 rounded">date</code>.
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Format</label>
              <div className="flex gap-2">
                <button onClick={() => { setImportFormat('csv'); setPayload(''); }} className={`flex-1 text-xs px-3 py-2 rounded-lg border font-semibold inline-flex items-center justify-center gap-1.5 ${importFormat === 'csv' ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted-foreground'}`}><FileText className="w-3.5 h-3.5" /> CSV</button>
                <button onClick={() => { setImportFormat('json'); setPayload(''); }} className={`flex-1 text-xs px-3 py-2 rounded-lg border font-semibold inline-flex items-center justify-center gap-1.5 ${importFormat === 'json' ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted-foreground'}`}><FileJson className="w-3.5 h-3.5" /> JSON</button>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Source name *</label>
              <input value={sourceName} onChange={e => setSourceName(e.target.value)} placeholder="e.g. DSP dataset Aug 2026" className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Region</label>
              <select value={region} onChange={e => setRegion(e.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm">
                {['India', 'Global'].map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-muted-foreground">Data payload</label>
              <button onClick={() => setPayload(SAMPLE_CSV)} className="text-[11px] text-primary hover:underline">Insert sample CSV</button>
            </div>
            <textarea value={payload} onChange={e => setPayload(e.target.value)} rows={8}
              placeholder={importFormat === 'csv' ? 'job_title,description,location,experience\n...' : '[{ "job_title": "...", "description": "..." }]'}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-mono" />
          </div>
          <Button onClick={runImport} disabled={importing} className="text-xs font-bold">
            {importing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
            Validate & import
          </Button>

          {importResult && (
            <div className="rounded-xl border border-border p-4 space-y-2 bg-secondary/40">
              <div className="flex flex-wrap gap-4 text-xs">
                <span className="font-bold text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {importResult.acceptedRows} accepted</span>
                <span className="font-bold text-rose-600 inline-flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> {importResult.rejectedRows} rejected</span>
                <span className="text-muted-foreground">{importResult.unmappedRoles} rows didn't map to a seeded role (stored as "unmapped")</span>
              </div>
              {Object.keys(importResult.rolesMapped).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(importResult.rolesMapped).map(([slug, count]) => (
                    <span key={slug} className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{slug} × {count}</span>
                  ))}
                </div>
              )}
              {importResult.errors.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-rose-600">{importResult.errors.length} row error(s)</summary>
                  <ul className="mt-1 space-y-0.5 text-muted-foreground list-disc pl-4">
                    {importResult.errors.slice(0, 20).map((e, i) => <li key={i}>Row {e.row}: {e.reason}</li>)}
                  </ul>
                </details>
              )}
              <p className="text-[11px] text-muted-foreground">Batch: <code>{importResult.batchId}</code> — now generate snapshots per role below.</p>
            </div>
          )}
        </Card>

        {/* Roles */}
        <Card className="p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold flex items-center gap-2"><Database className="w-4 h-4 text-primary" /> Career roles ({roles.length})</h2>
            <Button variant="outline" size="sm" onClick={load} className="text-xs"><RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh</Button>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2 pr-4">Role</th>
                    <th className="py-2 pr-4">Category</th>
                    <th className="py-2 pr-4">Skills</th>
                    <th className="py-2 pr-4">Topics</th>
                    <th className="py-2 pr-4">Snapshot</th>
                    <th className="py-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map(role => {
                    const snap = snapshots.find(s => s.role === role.slug);
                    return (
                      <tr key={role._id} className="border-b border-border/60">
                        <td className="py-2.5 pr-4">
                          <Link to={`/career-learning/${role.slug}`} className="font-medium text-foreground hover:text-primary">{role.name}</Link>
                          {!role.isActive && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">DISABLED</span>}
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-muted-foreground">{role.category}</td>
                        <td className="py-2.5 pr-4 text-xs">{role.skills?.length ?? 0}</td>
                        <td className="py-2.5 pr-4 text-xs">{role.roadmapNodes?.length ?? 0}</td>
                        <td className="py-2.5 pr-4 text-xs">
                          {snap ? (
                            <span className="text-emerald-700">{snap.totalPostings} postings · {new Date(snap.periodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => generateSnapshot(role.slug)} disabled={processing === role.slug}
                              title="Generate market snapshot from imported jobs"
                              className="text-[11px] px-2 py-1 rounded border border-border hover:border-primary/40 inline-flex items-center gap-1">
                              {processing === role.slug ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                              Snapshot
                            </button>
                            <button onClick={() => toggleRole(role)}
                              className={`text-[11px] px-2 py-1 rounded border inline-flex items-center gap-1 ${role.isActive ? 'border-rose-200 text-rose-600 hover:bg-rose-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}>
                              {role.isActive ? <><Ban className="w-3 h-3" /> Disable</> : <><Plus className="w-3 h-3" /> Enable</>}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Import audit */}
        <Card className="p-6 rounded-2xl">
          <h2 className="text-base font-bold mb-3">Snapshot history</h2>
          {snapshots.length ? (
            <div className="space-y-1.5">
              {snapshots.slice(0, 15).map(s => (
                <div key={s._id} className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-secondary/40">
                  <span className="font-medium text-foreground">{s.role}</span>
                  <span className="text-muted-foreground">{s.region} · {s.totalPostings} postings · {s.sourceMetadata?.sourceName} · {new Date(s.periodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No snapshots yet — import a dataset, then generate snapshots per role.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

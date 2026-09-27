import { useState } from 'react';
import {
  Star, Copy, Trash2, Pencil, Plus, Check, X, Loader2, FileText, CloudOff, Cloud,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import type { IVersionSummary } from '../../services/resumeBuilderService';

/**
 * AETHER Resume Builder — version switcher (spec §15, §26).
 * Create / load / rename / duplicate / delete / set default, plus the autosave
 * status indicator (spec §25).
 */

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'unsaved-new';

const SAVE_COPY: Record<SaveStatus, { text: string; cls: string; icon: 'ok' | 'busy' | 'warn' }> = {
  idle: { text: 'All changes saved', cls: 'text-muted-foreground', icon: 'ok' },
  dirty: { text: 'Unsaved changes', cls: 'text-amber-700', icon: 'warn' },
  saving: { text: 'Saving…', cls: 'text-muted-foreground', icon: 'busy' },
  saved: { text: 'Saved', cls: 'text-emerald-700', icon: 'ok' },
  error: { text: 'Save failed — retrying on next edit', cls: 'text-rose-600', icon: 'warn' },
  'unsaved-new': { text: 'New resume — not saved yet', cls: 'text-amber-700', icon: 'warn' },
};

export function SaveStatusChip({ status, lastSavedAt }: { status: SaveStatus; lastSavedAt: string | null }) {
  const meta = SAVE_COPY[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11.5px] font-medium ${meta.cls}`} title={lastSavedAt ? `Last saved ${lastSavedAt}` : undefined}>
      {meta.icon === 'busy' ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : meta.icon === 'warn' ? <CloudOff className="w-3.5 h-3.5" />
        : <Cloud className="w-3.5 h-3.5" />}
      {meta.text}
      {status === 'saved' && lastSavedAt ? <span className="text-muted-foreground">· {lastSavedAt}</span> : null}
    </span>
  );
}

export default function ResumeToolbar({
  versions, activeId, onSelect, onCreate, onDuplicate, onDelete, onRename, onSetDefault, onFromUpload,
  status, lastSavedAt,
}: {
  versions: IVersionSummary[];
  activeId: string | null;
  onSelect: (v: IVersionSummary) => void;
  onCreate: () => void;
  onDuplicate: (v: IVersionSummary) => void;
  onDelete: (v: IVersionSummary) => void;
  onRename: (v: IVersionSummary, name: string) => void;
  onSetDefault: (v: IVersionSummary) => void;
  onFromUpload: () => void;
  status: SaveStatus;
  lastSavedAt: string | null;
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Resume versions</span>
          <SaveStatusChip status={status} lastSavedAt={lastSavedAt} />
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="text-xs" onClick={onFromUpload}>
            <Plus className="w-3.5 h-3.5 mr-1" /> From uploaded resume
          </Button>
          <Button size="sm" variant="outline" className="text-xs" onClick={onCreate}>
            <Plus className="w-3.5 h-3.5 mr-1" /> New version
          </Button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {versions.map(v => {
          const active = v._id === activeId;
          if (renamingId === v._id) {
            return (
              <div key={v._id} className="flex items-center gap-1 rounded-xl border border-primary bg-primary/5 px-2 py-1.5 shrink-0">
                <input
                  autoFocus
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { onRename(v, renameValue.trim() || v.name); setRenamingId(null); }
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  className="w-40 rounded-md border border-border bg-background px-2 py-1 text-[12.5px] focus:outline-none"
                />
                <button className="p-1 text-emerald-600" onClick={() => { onRename(v, renameValue.trim() || v.name); setRenamingId(null); }}>
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button className="p-1 text-muted-foreground" onClick={() => setRenamingId(null)}><X className="w-3.5 h-3.5" /></button>
              </div>
            );
          }
          return (
            <div key={v._id}
              className={`group shrink-0 rounded-xl border px-3 py-1.5 transition-colors ${active ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/40'}`}>
              <button type="button" onClick={() => onSelect(v)} className="text-left">
                <span className={`block text-[12.5px] font-semibold ${active ? 'text-primary' : 'text-foreground'}`}>
                  {v.isDefault && <Star className="w-3 h-3 inline mr-1 -mt-0.5 fill-current" />}
                  {v.name}
                </span>
                <span className="block text-[10.5px] text-muted-foreground">
                  {v.template} · {v.atsScore != null ? `ATS ${v.atsScore}/100` : 'unscored'}
                </span>
              </button>
              <div className="flex items-center gap-0.5 mt-1">
                <button type="button" title="Rename" className="p-1 rounded hover:bg-secondary text-muted-foreground"
                  onClick={() => { setRenamingId(v._id); setRenameValue(v.name); }}>
                  <Pencil className="w-3 h-3" />
                </button>
                <button type="button" title="Duplicate" className="p-1 rounded hover:bg-secondary text-muted-foreground" onClick={() => onDuplicate(v)}>
                  <Copy className="w-3 h-3" />
                </button>
                <button type="button" title="Set as default" className="p-1 rounded hover:bg-secondary text-muted-foreground"
                  onClick={() => onSetDefault(v)} disabled={v.isDefault}>
                  <Star className={`w-3 h-3 ${v.isDefault ? 'fill-current text-amber-500' : ''}`} />
                </button>
                <button type="button" title="Delete" className="p-1 rounded hover:bg-rose-50 text-rose-600" onClick={() => onDelete(v)}>
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
        {versions.length === 0 && (
          <p className="text-[12px] text-muted-foreground py-2">
            No saved versions yet — fill in the editor and it saves automatically.
          </p>
        )}
      </div>
    </div>
  );
}

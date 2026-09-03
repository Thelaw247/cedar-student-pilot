import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Paperclip, Upload, Download, Trash2, Loader2, FileText, ShieldCheck, RefreshCw, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Widget from '@/components/ui/Widget';
import { fetchWithCache } from '@/hooks/useEntityData';
import { invalidateEntity } from '@/lib/cache';

export const MATERIAL_ACCEPT = '.pdf,.txt,.md,application/pdf,text/plain,text/markdown';

/**
 * The professor's own files for this lecture — slides, handouts, the
 * formula sheet. Two jobs:
 *   1. keep them with the lecture, downloadable;
 *   2. feed their text to the analysis so formulas and definitions are
 *      checked against what the professor actually wrote, not what the
 *      microphone heard. After an upload, "Re-check against materials"
 *      re-runs the pass (free; the server only runs it when something is
 *      new), and the study page's Verified badges update.
 */
export default function LectureMaterials({ lecture, onEnriched, onCountChange }) {
  const [materials, setMaterials] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(null); // file name in flight
  const [error, setError] = useState(null);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [notice, setNotice] = useState(null);
  const inputRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const rows = await fetchWithCache('LectureMaterial', 'filter', [{ lecture_id: lecture.id }]);
      setMaterials(Array.isArray(rows) ? rows : []);
    } catch { /* keep what is shown */ }
    setLoaded(true);
  }, [lecture.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { onCountChange?.(materials.filter((m) => m.extraction_status === 'ready').length); }, [materials, onCountChange]);

  const canUpload = typeof base44?.materials?.upload === 'function';

  const uploadFiles = async (files) => {
    setError(null);
    setNotice(null);
    for (const file of files) {
      setUploading(file.name);
      try {
        await base44.materials.upload(lecture.id, file);
        invalidateEntity('LectureMaterial');
        await load();
      } catch (e) {
        setError(e?.response?.data?.error || e?.message || `Could not upload ${file.name}`);
        break;
      }
    }
    setUploading(null);
  };

  const onPick = (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (files.length) uploadFiles(files);
  };

  const onDrop = (e) => {
    e.preventDefault();
    const files = [...(e.dataTransfer?.files || [])];
    if (files.length) uploadFiles(files);
  };

  const download = async (m) => {
    try {
      const { url } = await base44.materials.getDownloadUrl(m.id);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      setError(e?.message || 'Could not open this file');
    }
  };

  const remove = async (m) => {
    setError(null);
    try {
      await base44.materials.delete(m.id);
      invalidateEntity('LectureMaterial');
      await load();
    } catch (e) {
      setError(e?.message || 'Could not delete this file');
    }
  };

  const reanalyze = async () => {
    setReanalyzing(true);
    setError(null);
    setNotice(null);
    try {
      const res = await base44.functions.invoke('enrichLecture', { lecture_id: lecture.id });
      const d = res?.data || {};
      if (d.ran) {
        setNotice(`Re-checked. ${d.stats?.verified_formulas ?? 0} formula${d.stats?.verified_formulas === 1 ? '' : 's'} and ${d.stats?.verified_definitions ?? 0} definition${d.stats?.verified_definitions === 1 ? '' : 's'} verified against your materials${d.todos_added ? ` · ${d.todos_added} to-do${d.todos_added === 1 ? '' : 's'} added` : ''}.`);
        onEnriched?.();
      } else {
        setNotice('Already up to date with these materials.');
      }
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Could not re-run the analysis.');
    }
    setReanalyzing(false);
  };

  const readyCount = materials.filter((m) => m.extraction_status === 'ready').length;
  const enrichedAt = lecture.enriched_at ? new Date(lecture.enriched_at).getTime() : 0;
  const newest = materials.reduce((max, m) => Math.max(max, new Date(m.updated_at || m.created_at).getTime()), 0);
  const stale = readyCount > 0 && newest > enrichedAt && !!lecture.transcript;

  return (
    <Widget id="sec-materials" icon={Paperclip} title="Professor's materials" collapsible storageKey="lec-materials"
      meta={materials.length ? `${materials.length} file${materials.length === 1 ? '' : 's'} · ${readyCount} used to verify this page` : 'Attach slides or handouts to verify formulas and definitions'}
      className="mb-4 scroll-mt-24" padded>
      <div className="pt-1">
        {materials.length > 0 && (
          <ul className="space-y-1.5 mb-3">
            {materials.map((m) => (
              <li key={m.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{m.file_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatBytes(m.size_bytes)}{m.page_count ? ` · ${m.page_count} pages` : ''}
                    {m.extraction_status === 'ready' && <span className="inline-flex items-center gap-1 ml-2 text-emerald-600"><ShieldCheck className="w-3 h-3" /> used for verification</span>}
                    {m.extraction_status === 'failed' && <span className="inline-flex items-center gap-1 ml-2 text-amber-600"><AlertTriangle className="w-3 h-3" /> no readable text (scanned?) — kept for download only</span>}
                    {m.extraction_status === 'unsupported' && <span className="ml-2 text-amber-600">kept for download only</span>}
                  </p>
                </div>
                <button type="button" onClick={() => download(m)} aria-label={`Download ${m.file_name}`} className="text-muted-foreground hover:text-foreground"><Download className="w-4 h-4" /></button>
                <button type="button" onClick={() => remove(m)} aria-label={`Delete ${m.file_name}`} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
        )}

        {canUpload ? (
          <div onDragOver={(e) => e.preventDefault()} onDrop={onDrop}
            className="rounded-xl border border-dashed border-border px-4 py-4 text-center hover:border-primary/40 transition-colors">
            <input ref={inputRef} type="file" accept={MATERIAL_ACCEPT} multiple className="hidden" onChange={onPick} />
            {uploading ? (
              <p className="text-sm text-muted-foreground inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Uploading {uploading}…</p>
            ) : (
              <>
                <button type="button" onClick={() => inputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90">
                  <Upload className="w-3.5 h-3.5" /> Attach slides, handouts or notes
                </button>
                <p className="text-[11px] text-muted-foreground mt-2">PDF, text or Markdown · up to 20 MB each · or drop files here</p>
              </>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">Attachments are available on the new Praelecta stack.</p>
        )}

        {loaded && lecture.transcript && readyCount > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={reanalyze} disabled={reanalyzing}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${stale ? 'border-primary/40 bg-primary/5 text-primary hover:bg-primary/10' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
              {reanalyzing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Re-checking…</> : <><RefreshCw className="w-3.5 h-3.5" /> {stale ? 'Re-check the page against these materials' : 'Re-check against materials'}</>}
            </button>
            {stale && !reanalyzing && <span className="text-[11px] text-muted-foreground">New material since the last analysis.</span>}
          </div>
        )}
        {notice && <p className="text-[11px] text-emerald-600 mt-2">{notice}</p>}
        {error && <p className="text-[11px] text-destructive mt-2">{error}</p>}
      </div>
    </Widget>
  );
}

function formatBytes(n) {
  const b = Number(n || 0);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

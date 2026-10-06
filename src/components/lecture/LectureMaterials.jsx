import React, { useCallback, useEffect, useRef, useState } from 'react';
import { lectureTitle } from '@/lib/lectureTitle';
import { Link } from 'react-router-dom';
import { Paperclip, Upload, Download, Trash2, Loader2, FileText, ShieldCheck, RefreshCw, AlertTriangle, BookOpen, Link2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Widget from '@/components/ui/Widget';
import { fetchWithCache } from '@/hooks/useEntityData';
import { invalidateEntity } from '@/lib/cache';
import GateNotice, { gateFromError } from '@/components/monetization/GateNotice';

export const MATERIAL_ACCEPT = '.pdf,.txt,.md,application/pdf,text/plain,text/markdown';

/**
 * The professor's own files, in one of two scopes.
 *
 * Lecture scope (`lecture`): the slides, handouts and formula sheet for THIS
 * lecture. Two jobs: keep them with the lecture, downloadable; and feed their
 * text to the analysis so formulas and definitions are checked against what
 * the professor actually wrote, not what the microphone heard. After an
 * upload, "Re-check against materials" re-runs the pass (free; the server
 * only runs it when something is new), and the study page's Verified badges
 * update.
 *
 * Class scope (`cls`, with `lectures` for labels): every file of the course
 * in one place — the ones attached to the class itself (syllabus, past
 * exams, textbook chapters; uploaded here, with no lecture) and the ones
 * attached to individual lectures, each labelled with its lecture and linked
 * to it. A class file is what the practice-question generator can build
 * from; it does not feed any one lecture's analysis, so there is no re-check
 * here. Same component, same upload pipeline, same 1-credit PDF read.
 */
export default function LectureMaterials({ lecture = null, cls = null, lectures = [], onEnriched = null, onCountChange = null }) {
  const classScope = !lecture && !!cls;
  const scopeId = classScope ? cls.id : lecture?.id;
  const [materials, setMaterials] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(null); // file name in flight
  const [error, setError] = useState(null);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [notice, setNotice] = useState(null);
  const [gate, setGate] = useState(null);
  const inputRef = useRef(null);
  // A link instead of a file: the field is folded until asked for, so the
  // dropzone stays one button for the common case.
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState('');
  const [fetching, setFetching] = useState(false);
  const linkRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const rows = await fetchWithCache('LectureMaterial', 'filter', [classScope ? { class_id: scopeId } : { lecture_id: scopeId }]);
      setMaterials(Array.isArray(rows) ? rows : []);
    } catch { /* keep what is shown */ }
    setLoaded(true);
  }, [classScope, scopeId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { onCountChange?.(materials.filter((m) => m.extraction_status === 'ready').length); }, [materials, onCountChange]);

  const canUpload = typeof base44?.materials?.upload === 'function';

  const uploadFiles = async (files) => {
    setError(null);
    setNotice(null);
    setGate(null);
    for (const file of files) {
      setUploading(file.name);
      try {
        await base44.materials.upload(classScope ? { class_id: scopeId } : scopeId, file);
        invalidateEntity('LectureMaterial');
        await load();
      } catch (e) {
        // A tier/credit refusal is a 402 the student can act on — show the
        // upgrade card, not a red error string. Anything else is a real failure.
        const g = gateFromError(e);
        if (g) setGate(g);
        else setError(e?.response?.data?.message || e?.message || `Could not upload ${file.name}`);
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

  // The server fetches the link, checks what came back (a real PDF with
  // nothing hostile inside, or real text), keeps it and reads it like an
  // upload. Every refusal is a sentence from the server, shown as it is.
  const importLink = async (e) => {
    e?.preventDefault?.();
    const value = link.trim();
    if (!value || fetching) return;
    setError(null);
    setNotice(null);
    setGate(null);
    setFetching(true);
    try {
      const result = await base44.materials.importFromUrl(classScope ? { class_id: scopeId } : scopeId, value);
      invalidateEntity('LectureMaterial');
      await load();
      setLink('');
      setLinkOpen(false);
      const name = result?.material?.file_name || 'The file';
      setNotice(result?.material?.extraction_status === 'ready'
        ? `${name} added and read.`
        : `${name} added. No text could be read from it, so it is kept for download only.`);
    } catch (err) {
      const g = gateFromError(err);
      if (g) setGate(g);
      else setError(err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Could not fetch that link.');
    }
    setFetching(false);
  };

  const openLink = () => {
    setLinkOpen(true);
    setTimeout(() => linkRef.current?.focus(), 0);
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
  const enrichedAt = lecture?.enriched_at ? new Date(lecture.enriched_at).getTime() : 0;
  const newest = materials.reduce((max, m) => Math.max(max, new Date(m.updated_at || m.created_at).getTime()), 0);
  const stale = !classScope && readyCount > 0 && newest > enrichedAt && !!lecture?.transcript;

  // Class scope: the lecture a file belongs to, for its label and link.
  const lectureById = new Map((lectures || []).map((l) => [l.id, l]));
  const lectureLabel = (m) => {
    if (!m.lecture_id) return null;
    const l = lectureById.get(m.lecture_id);
    return l ? lectureTitle(l) : 'a lecture';
  };

  const meta = classScope
    ? (materials.length
      ? `${materials.length} file${materials.length === 1 ? '' : 's'} · ${readyCount} ready for practice questions`
      : 'Syllabus, past exams, formula sheets: files for the whole course')
    : (materials.length
      ? `${materials.length} file${materials.length === 1 ? '' : 's'} · ${readyCount} used to verify this page`
      : 'Attach slides or handouts to verify formulas and definitions');

  return (
    <Widget id={classScope ? 'sec-course-materials' : 'sec-materials'} icon={classScope ? BookOpen : Paperclip}
      title={classScope ? 'Course materials' : "Professor's materials"} collapsible storageKey={classScope ? 'class-materials' : 'lec-materials'}
      meta={meta} className="mb-4 scroll-mt-24" padded>
      <div className="pt-1">
        {materials.length > 0 && (
          <ul className="space-y-1.5 mb-3">
            {materials.map((m) => {
              const from = classScope ? lectureLabel(m) : null;
              return (
                <li key={m.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{m.file_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatBytes(m.size_bytes)}{m.page_count ? ` · ${m.page_count} pages` : ''}
                      {from && m.lecture_id && (
                        <> · from <Link to={`/lectures/${m.lecture_id}`} className="text-primary hover:underline">{from}</Link></>
                      )}
                      {m.extraction_status === 'ready' && !classScope && <span className="inline-flex items-center gap-1 ml-2 text-emerald-600"><ShieldCheck className="w-3 h-3" /> used for verification</span>}
                      {m.extraction_status === 'ready' && classScope && <span className="inline-flex items-center gap-1 ml-2 text-emerald-600"><ShieldCheck className="w-3 h-3" /> ready for questions</span>}
                      {m.extraction_status === 'failed' && <span className="inline-flex items-center gap-1 ml-2 text-amber-600"><AlertTriangle className="w-3 h-3" /> no text found (a scan?), kept for download only</span>}
                      {m.extraction_status === 'unsupported' && <span className="ml-2 text-amber-600">kept for download only</span>}
                    </p>
                  </div>
                  <button type="button" onClick={() => download(m)} aria-label={`Download ${m.file_name}`} className="text-muted-foreground hover:text-foreground"><Download className="w-4 h-4" /></button>
                  <button type="button" onClick={() => remove(m)} aria-label={`Delete ${m.file_name}`} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                </li>
              );
            })}
          </ul>
        )}

        {canUpload ? (
          <div onDragOver={(e) => e.preventDefault()} onDrop={onDrop}
            className="rounded-xl border border-dashed border-border px-4 py-4 text-center hover:border-primary/40 transition-colors">
            <input ref={inputRef} type="file" accept={MATERIAL_ACCEPT} multiple className="hidden" onChange={onPick} />
            {uploading ? (
              <p className="text-sm text-muted-foreground inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Uploading {uploading}…</p>
            ) : fetching ? (
              <p className="text-sm text-muted-foreground inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Fetching the file and checking it…</p>
            ) : linkOpen ? (
              <form onSubmit={importLink} className="text-left">
                <label htmlFor={`material-link-${scopeId}`} className="text-xs font-medium text-muted-foreground block mb-1.5">Link to the file</label>
                <div className="flex items-center gap-2">
                  <input
                    ref={linkRef}
                    id={`material-link-${scopeId}`}
                    type="url"
                    inputMode="url"
                    autoComplete="off"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://… a PDF, or a Drive, Dropbox or OneDrive share link"
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <button type="submit" disabled={!link.trim()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 active:scale-[0.98] transition-all duration-micro disabled:opacity-50 flex-shrink-0">
                    <Link2 className="w-3.5 h-3.5" /> Fetch
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                  <p className="text-[11px] text-muted-foreground">Fetched by us, checked for anything a PDF should not carry, then read like an upload. Same 1 credit per PDF.</p>
                  <button type="button" onClick={() => { setLinkOpen(false); setLink(''); }} className="text-[11px] text-muted-foreground hover:text-foreground py-2 -my-2 px-1 -mx-1">Cancel</button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button type="button" onClick={() => inputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 active:scale-[0.98] transition-all duration-micro">
                    <Upload className="w-3.5 h-3.5" /> {classScope ? 'Add a course file' : 'Attach slides, handouts or notes'}
                  </button>
                  <button type="button" onClick={openLink}
                    className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted active:scale-[0.98] transition-all duration-micro">
                    <Link2 className="w-3.5 h-3.5" /> Add from a link
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">PDF or text files up to 20 MB · 1 credit per PDF<span className="hidden sm:inline"> · or drop a file here</span></p>
              </>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">Attachments are available on the new Praelecta stack.</p>
        )}

        {!classScope && loaded && lecture?.transcript && readyCount > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={reanalyze} disabled={reanalyzing}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${stale ? 'border-primary/40 bg-primary/5 text-primary hover:bg-primary/10' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
              {reanalyzing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Re-checking…</> : <><RefreshCw className="w-3.5 h-3.5" /> {stale ? 'Re-check the page against these materials' : 'Re-check against materials'}</>}
            </button>
            {stale && !reanalyzing && <span className="text-[11px] text-muted-foreground">New material since the last analysis.</span>}
          </div>
        )}
        {gate && <GateNotice gate={gate} source="materials" className="mt-3" />}
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

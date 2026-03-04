import React, { useState, useRef, useCallback, useEffect } from 'react';
import './App.css';
import { configureRunPod, runpodGenerate, uploadImageBlob } from './runpod';
import { saveMedia, loadAllMedia, deleteMedia, makeThumbnail, uid, type StoredMedia } from './db';
import {
  SendHorizontal, Sparkles, Upload, X, CheckCircle,
  AlertCircle, Download, Play, Loader2, Clock, Trash2,
  Film, Image as ImageIcon
} from 'lucide-react';


// ─── Auto-configure RunPod ────────────────────────────────────────────────────
configureRunPod(
  import.meta.env.VITE_RUNPOD_API_KEY as string,
  '3hqdyqnb6rppcw'
);

// ─── Theme ────────────────────────────────────────────────────────────────────
const t = {
  accent: '#8b5cf6', accentBright: '#a78bfa', accentGlow: 'rgba(139,92,246,0.35)',
  bg: '#09090f', bgCard: '#0f0f1a', glass: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.08)', textPrimary: '#f1f0f5',
  textSecondary: '#8b8a99', textMuted: '#4a4a5a',
  success: '#34d399', error: '#f87171',
};

type GenStatus = 'idle' | 'generating' | 'done' | 'error';
type View = 'generator' | 'gallery';
type GenMode = 't2i' | 'i2v'; // Text-to-Image (Flux) or Image-to-Video (Wan)

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  // Generator state
  const [view, setView] = useState<View>('generator');
  const [genMode, setGenMode] = useState<GenMode>('i2v');
  const [image, setImage] = useState<string | null>(null);
  const [imageDims, setImageDims] = useState<{ w: number; h: number } | null>(null);
  const [prompt, setPrompt] = useState('');
  const [denoise, setDenoise] = useState(0.8);
  const [status, setStatus] = useState<GenStatus>('idle');
  const [statusMsg, setStatusMsg] = useState(''); // Generated videos in the current session
  const [sessionResults, setSessionResults] = useState<StoredMedia[]>([]);

  // Gallery view state
  const [gallery, setGallery] = useState<StoredMedia[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // Load gallery from IndexedDB on mount
  useEffect(() => {
    loadAllMedia().then(setGallery).catch(console.error);
  }, []);

  // Clipboard paste
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      for (const item of Array.from(e.clipboardData?.items ?? [])) {
        if (item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) handleFile(f);
        }
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, []);

  /** Load image from a URL (file:// or blob:) and detect its natural dims */
  const setImageFromUrl = (url: string) => {
    const img = new Image();
    img.onload = () => {
      setImageDims({ w: img.naturalWidth, h: img.naturalHeight });
      setImage(url);
    };
    img.src = url;
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setImageFromUrl(URL.createObjectURL(file));
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const canGenerate = !!image && prompt.trim().length > 0 && status === 'idle';

  const handleMagicPrompt = () => {
    const magicTokens = "static camera, highly detailed, beautiful lighting, smooth cinematic motion, masterwork";
    setPrompt(prev => {
      const base = prev.trim();
      if (!base) return magicTokens;
      // Prevent duplicates if already clicked
      if (base.includes("smooth cinematic motion")) return base;
      return `${magicTokens}, ${base} `;
    });
  };

  const handleGenerate = async () => {
    if (!canGenerate && genMode === 'i2v') return;
    if (genMode === 't2i' && prompt.trim().length === 0) return;

    abortRef.current = new AbortController();
    setStatus('generating');
    setStatusMsg(genMode === 't2i' ? 'Shooting photo...' : 'Preparing image…');

    try {
      if (genMode === 't2i') {
        // TEXT-TO-IMAGE / IMAGE-TO-IMAGE FLOW (Flux.1)
        const processed = image ? await uploadImageBlob(image, setStatusMsg) : undefined;
        const result = await runpodGenerate({
          endpointId: 'flux-schnell',
          prompt: prompt.trim(),
          inputImageUrl: processed,
          imageWidth: imageDims?.w || 832,
          imageHeight: imageDims?.h || 1216,
          signal: abortRef.current.signal,
          onProgress: setStatusMsg,
          denoise: denoise,
        });

        console.log('✅ FLUX RAW RESULT:', result);

        // Put the generated photo in the UI
        setImageFromUrl(result.url);

        const entry: StoredMedia = {
          id: uid(),
          url: result.url,
          prompt: prompt.trim(),
          inputThumb: result.url, // For base image, thumb is image itself (browser caches this)
          mediaType: 'image',
          createdAt: Date.now(),
        };
        await saveMedia(entry);
        setSessionResults(prev => [entry, ...prev]);
        setGallery(prev => [entry, ...prev]);

      } else {
        // IMAGE-TO-VIDEO FLOW (Wan 2.2)
        const processed = await uploadImageBlob(image!, setStatusMsg);

        const result = await runpodGenerate({
          endpointId: 'wan22-i2v',
          prompt: prompt.trim(),
          inputImageUrl: processed,
          imageWidth: imageDims?.w,
          imageHeight: imageDims?.h,
          signal: abortRef.current.signal,
          onProgress: setStatusMsg,
        });

        const thumb = await makeThumbnail(processed);

        const entry: StoredMedia = {
          id: uid(),
          url: result.url,
          prompt: prompt.trim(),
          inputThumb: thumb,
          mediaType: 'video',
          createdAt: Date.now(),
        };
        await saveMedia(entry);
        setSessionResults(prev => [entry, ...prev]);
        setGallery(prev => [entry, ...prev]);
      }

      setStatus('done');
      setTimeout(() => setStatus('idle'), 2500);
    } catch (err) {
      console.error('❌ HANDLE GENERATE ERROR:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('canceled') || msg.toLowerCase().includes('aborted')) { setStatus('idle'); return; }
      setStatusMsg(msg);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 5000);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteMedia(id);
    setGallery(prev => prev.filter(v => v.id !== id));
    setSessionResults(prev => prev.filter(v => v.id !== id));
    if (playing === id) setPlaying(null);
  };

  const handleCancel = () => abortRef.current?.abort();

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', flexDirection: 'column', fontFamily: "'Inter', sans-serif", color: t.textPrimary }}>

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '0 20px', borderBottom: `1px solid ${t.border} `, height: 52, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 14px ${t.accentGlow} ` }}>
            <Sparkles size={14} color="white" />
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>Aether</span>
          <span style={{ fontSize: 12, color: t.textMuted, marginLeft: 2 }}>Wan 2.2 · I2V</span>
        </div>

        {/* Nav tabs */}
        <nav style={{ display: 'flex', gap: 2 }}>
          {(['generator', 'gallery'] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
              background: view === v ? 'rgba(139,92,246,0.15)' : 'transparent',
              color: view === v ? t.accentBright : t.textSecondary,
              border: view === v ? `1px solid rgba(139, 92, 246, 0.3)` : '1px solid transparent',
            }}>
              {v === 'generator' ? '⚡ Generate' : `🎬 Gallery${gallery.length > 0 ? ` (${gallery.length})` : ''} `}
            </button>
          ))}
        </nav>
      </header>

      {/* ── GENERATOR VIEW ── */}
      {view === 'generator' && (
        <main style={{ flex: 1, display: 'flex', gap: 20, padding: '20px 24px', maxWidth: 1050, margin: '0 auto', width: '100%' }}>

          {/* Left: Input */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Mode Switcher */}
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: 4, borderRadius: 10, alignSelf: 'flex-start' }}>
              <button onClick={() => setGenMode('t2i')} style={{ padding: '6px 14px', borderRadius: 7, fontSize: 13, fontWeight: 600, color: genMode === 't2i' ? '#fff' : t.textMuted, background: genMode === 't2i' ? t.accent : 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}>
                📸 Shoot Photo
              </button>
              <button onClick={() => setGenMode('i2v')} style={{ padding: '6px 14px', borderRadius: 7, fontSize: 13, fontWeight: 600, color: genMode === 'i2v' ? '#fff' : t.textMuted, background: genMode === 'i2v' ? t.accent : 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6 }}>
                🎬 Animate
              </button>
            </div>

            {/* Drop zone (Always visible, since both modes support images now) */}
            <div
              onDrop={onDrop} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
              onClick={() => !image && inputRef.current?.click()}
              style={{
                borderRadius: 18, border: `2px dashed ${dragging ? t.accent : image ? 'rgba(139,92,246,0.3)' : t.border} `,
                background: dragging ? 'rgba(139,92,246,0.06)' : t.glass,
                position: 'relative', overflow: 'hidden', cursor: image ? 'default' : 'pointer',
                transition: 'border-color 0.2s', minHeight: image ? 'auto' : 190,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              {image ? (
                <>
                  <img src={image} alt="input" style={{ width: '100%', maxHeight: 380, objectFit: 'contain', display: 'block' }} />
                  <button onClick={e => { e.stopPropagation(); setImage(null); }}
                    style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', border: `1px solid ${t.border} `, borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <X size={13} color={t.textSecondary} />
                  </button>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '28px 20px' }}>
                  <div style={{ width: 50, height: 50, borderRadius: 14, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                    <Upload size={20} color={t.accent} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.textSecondary, marginBottom: 6 }}>Drop an image here</div>
                  <div style={{ fontSize: 12, color: t.textMuted }}>or click · Ctrl+V to paste</div>
                </div>
              )}
            </div>

            {/* Prompt */}
            <div style={{ borderRadius: 14, border: `1px solid ${prompt.length > 0 ? 'rgba(139,92,246,0.35)' : t.border} `, background: t.glass, padding: '12px 14px', transition: 'border-color 0.2s' }}>
              <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGenerate(); }}
                placeholder={genMode === 't2i' ? "Describe the perfect photo… e.g: photorealistic portrait of a redhead girl, studio lighting" : "Describe the motion… e.g: slow cinematic zoom, hair flowing in the wind"}
                style={{ width: '100%', minHeight: 80, fontSize: 13, lineHeight: 1.7, color: t.textPrimary, caretColor: t.accent, resize: 'none', background: 'transparent', outline: 'none' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <span style={{ fontSize: 11, color: t.textMuted }}>{prompt.length > 0 ? `${prompt.length} chars` : 'Ctrl+Enter to generate'}</span>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {genMode === 'i2v' && !image && <span style={{ fontSize: 11, color: t.error }}>⚠ Upload an image first</span>}
                  {genMode === 'i2v' && (
                    <button onClick={handleMagicPrompt} disabled={status === 'generating'}
                      style={{ fontSize: 11, fontWeight: 600, color: t.accentBright, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', padding: '4px 10px', borderRadius: 6, cursor: status === 'generating' ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.2s' }}>
                      <Sparkles size={11} /> Magic Enhance
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Denoise Slider for I2I */}
            {genMode === 't2i' && image && (
              <div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: t.textSecondary, fontWeight: 500 }}>
                  <span>Denoising Strength</span>
                  <span>{denoise.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.1" max="1.0" step="0.05"
                  value={denoise}
                  onChange={e => setDenoise(parseFloat(e.target.value))}
                  style={{ width: '100%', cursor: 'pointer', accentColor: t.accent }}
                />
                <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.4 }}>
                  Higher values modify the original image more. 0.8+ is recommended for significant changes.
                </div>
              </div>
            )}

            {/* Generate button */}
            <button onClick={status === 'generating' ? handleCancel : handleGenerate}
              disabled={status !== 'generating' && (genMode === 'i2v' ? !canGenerate : prompt.trim().length === 0)}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 13, fontSize: 14, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, cursor: (status === 'generating' || canGenerate || (genMode === 't2i' && prompt.length > 0)) ? 'pointer' : 'not-allowed', transition: 'all 0.2s',
                background: status === 'generating' ? 'rgba(248,113,113,0.12)' : (canGenerate || (genMode === 't2i' && prompt.length > 0)) ? 'linear-gradient(135deg,#8b5cf6,#7c3aed)' : 'rgba(255,255,255,0.04)',
                color: status === 'generating' ? t.error : (canGenerate || (genMode === 't2i' && prompt.length > 0)) ? 'white' : t.textMuted,
                border: status === 'generating' ? `1px solid rgba(248,113,113,0.3)` : 'none',
                boxShadow: (canGenerate || (genMode === 't2i' && prompt.length > 0)) ? `0 4px 20px ${t.accentGlow}` : 'none',
              }}>
              {status === 'generating' ? <><Loader2 size={16} className="spin" /> {statusMsg}</>
                : status === 'done' ? <><CheckCircle size={16} /> Saved to Gallery!</>
                  : status === 'error' ? <><AlertCircle size={16} /> Error · Retry</>
                    : <><SendHorizontal size={16} /> {genMode === 't2i' ? 'Shoot Photo' : 'Animate Scene'}</>}
            </button>

            {/* Status msg */}
            {(status === 'generating' || status === 'error') && (
              <div style={{ textAlign: 'center', fontSize: 12, color: status === 'error' ? t.error : t.textMuted }}>
                {statusMsg}
              </div>
            )}

            {/* Info Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: 14, borderRadius: 14, background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: t.accentBright, fontSize: 13, fontWeight: 600 }}>
                  <ImageIcon size={14} /> Flux.1 Schnell Studio
                </div>
                <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.5 }}>
                  Generates cinematic, photorealistic inputs. Drop an existing image to use it as foundation (Image-to-Image editing).
                </div>
              </div>

              <div style={{ padding: 14, borderRadius: 14, background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: t.accentBright, fontSize: 13, fontWeight: 600 }}>
                  <Film size={14} /> Wan 2.2 Cinematic Engine
                </div>
                <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.5 }}>
                  State of the art Image-to-Video generation. 1.2 CFG scale heavily optimized for buttery smooth motion.
                </div>
              </div>
            </div>

          </div>

          {/* Right: Session results */}
          <div style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              This session
            </div>

            {sessionResults.length === 0 && status !== 'generating' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: 0.35, paddingTop: 60 }}>
                <Play size={36} strokeWidth={1} color={t.textMuted} />
                <div style={{ fontSize: 12, color: t.textMuted, textAlign: 'center' }}>Generated videos<br />will appear here</div>
              </div>
            )}

            {/* Generating placeholder */}
            {status === 'generating' && (
              <div style={{ borderRadius: 14, border: `1px solid rgba(139, 92, 246, 0.2)`, background: 'rgba(139,92,246,0.04)', overflow: 'hidden' }}>
                <div style={{ height: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', border: '2px solid rgba(139,92,246,0.15)', borderTopColor: t.accent, animation: 'spin 1s linear infinite', position: 'relative' }}>
                    <Sparkles size={16} color={t.accent} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
                  </div>
                  <div style={{ fontSize: 12, color: t.textSecondary }}>{statusMsg}</div>
                  <div style={{ fontSize: 11, color: t.textMuted }}>~3-5 min · RTX 4090</div>
                </div>
              </div>
            )}

            {sessionResults.map(r => (
              <VideoCard key={r.id} video={r} playing={playing === r.id} onPlay={() => setPlaying(r.id)} onDelete={() => handleDelete(r.id)} />
            ))}
          </div>
        </main>
      )}

      {/* ── GALLERY VIEW ── */}
      {view === 'gallery' && (
        <div style={{ flex: 1, padding: '20px 24px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          {gallery.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 14, opacity: 0.4 }}>
              <Clock size={48} strokeWidth={1} color={t.textMuted} />
              <div style={{ fontSize: 14, color: t.textMuted }}>All your generated videos will appear here</div>
              <button onClick={() => setView('generator')} style={{ padding: '8px 18px', borderRadius: 10, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: t.accentBright, fontSize: 13, cursor: 'pointer' }}>
                Generate first
              </button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 16 }}>{gallery.length} video{gallery.length !== 1 ? 's' : ''} saved locally</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {gallery.map(r => (
                  <VideoCard key={r.id} video={r} playing={playing === r.id} onPlay={() => setPlaying(r.id === playing ? null : r.id)} onDelete={() => handleDelete(r.id)} showDate />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box- sizing: border - box; margin: 0; padding: 0; }
button, input, textarea { font - family: inherit; border: none; background: none; }
        textarea { resize: none; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .spin { animation: spin 0.8s linear infinite; }
        .fade -in { animation: fadeIn 0.25s ease; }
        :: -webkit - scrollbar { width: 5px; }
        :: -webkit - scrollbar - thumb { background: rgba(255, 255, 255, 0.08); border - radius: 3px; }
`}</style>
    </div>
  );
}

// ─── VideoCard component ───────────────────────────────────────────────────────
function VideoCard({ video, playing, onPlay, onDelete, showDate }: {
  video: StoredMedia; playing: boolean;
  onPlay: () => void; onDelete: () => void; showDate?: boolean;
}) {
  const t_local = {
    bgCard: '#0f0f1a', border: 'rgba(255,255,255,0.08)', textSecondary: '#8b8a99',
    textMuted: '#4a4a5a', accentBright: '#a78bfa', error: '#f87171',
  };

  return (
    <div className="fade-in" style={{ borderRadius: 14, border: `1px solid ${t_local.border} `, background: t_local.bgCard, overflow: 'hidden' }}>
      {video.mediaType === 'image' ? (
        <div style={{ position: 'relative', cursor: 'pointer', background: '#000', maxHeight: 260, display: 'flex', justifyContent: 'center' }} onClick={onPlay}>
          <img src={video.url} alt="Generated" style={{ width: '100%', maxHeight: 260, objectFit: 'contain' }} />
        </div>
      ) : playing ? (
        <video src={video.url} controls autoPlay loop muted
          style={{ width: '100%', display: 'block', maxHeight: 260, objectFit: 'contain', background: '#000' }} />
      ) : (
        <div style={{ position: 'relative', cursor: 'pointer', aspectRatio: '16/9', background: '#000' }} onClick={onPlay}>
          <img src={video.inputThumb} alt="Thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Play size={18} color="white" fill="white" style={{ marginLeft: 2 }} />
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 12, color: t_local.textSecondary, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={video.prompt}>
          {video.prompt}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {showDate && (
            <span style={{ fontSize: 11, color: t_local.textMuted }}>
              {new Date(video.createdAt).toLocaleDateString('es', { day: '2-digit', month: 'short' })} · {new Date(video.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            <a href={video.url} download={`aether-${video.id}.${video.mediaType === 'image' ? 'jpg' : 'mp4'}`}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: t_local.accentBright, fontWeight: 600, textDecoration: 'none', padding: '4px 10px', borderRadius: 7, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)' }}>
              <Download size={11} /> Download
            </a>
            <button onClick={onDelete}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', cursor: 'pointer' }}>
              <Trash2 size={12} color={t_local.error} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
// Using existing Sheet component for modal-style overlay (as dialog components not present)
import { SheetClose } from '@/components/ui/sheet';
import { toast } from 'sonner';

interface SignatureModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
  initialDataUrl?: string;
}

// Simple utility to downscale large images to a max bounding box
const downscaleImage = (img: HTMLImageElement, maxW = 400, maxH = 150): string => {
  const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
  const canvas = document.createElement('canvas');
  canvas.width = img.width * ratio;
  canvas.height = img.height * ratio;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
};

const SignatureModal: React.FC<SignatureModalProps> = ({ open, onClose, onSave, initialDataUrl }) => {
  const [tab, setTab] = useState<'draw'|'upload'>('draw');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [strokes, setStrokes] = useState<Array<Array<[number, number]>>>([]);
  const [currentStroke, setCurrentStroke] = useState<Array<[number, number]>>([]);
  const [uploadPreview, setUploadPreview] = useState<string | null>(initialDataUrl || null);
  const [penColor, setPenColor] = useState('#111111');
  const [penSize, setPenSize] = useState(2);
  const deviceRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,canvas.width, canvas.height);
    ctx.setTransform(deviceRatio,0,0,deviceRatio,0,0);
    const w = canvas.width / deviceRatio;
    const h = canvas.height / deviceRatio;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,w,h);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    strokes.forEach(stroke => {
      ctx.beginPath();
      stroke.forEach(([x,y], i) => i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y));
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penSize;
      ctx.stroke();
    });
    if (currentStroke.length) {
      ctx.beginPath();
      currentStroke.forEach(([x,y], i) => i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y));
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penSize;
      ctx.stroke();
    }
    ctx.restore();
  }, [strokes, currentStroke, penColor, penSize, deviceRatio]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = containerRef.current;
    if (!canvas || !wrapper) return;
    const width = wrapper.clientWidth;
    const height = 180;
    canvas.width = Math.floor(width * deviceRatio);
    canvas.height = Math.floor(height * deviceRatio);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    redraw();
  }, [deviceRatio, redraw]);

  useEffect(() => {
    if (open && tab === 'draw') {
      setTimeout(() => resizeCanvas(), 50);
    }
  }, [open, tab, resizeCanvas]);

  // Re-render when stroke data changes
  useEffect(() => { redraw(); }, [redraw]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tab !== 'draw') return;
    setDrawing(true);
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCurrentStroke([[x,y]]);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing || tab !== 'draw') return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCurrentStroke(prev => [...prev, [x,y]]);
  };
  const handlePointerUp = () => {
    if (!drawing) return;
    setDrawing(false);
    setStrokes(prev => currentStroke.length ? [...prev, currentStroke] : prev);
    setCurrentStroke([]);
  };
  const clearCanvas = () => { setStrokes([]); setCurrentStroke([]); };
  const undoStroke = () => { setStrokes(prev => prev.slice(0,-1)); };
  const saveDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!strokes.length) { toast.error('Draw your signature first'); return; }
    redraw();
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
    onClose();
  };

  const handleFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Upload an image file'); return; }
    if (file.size > 2_000_000) { toast.error('Image too large (max 2MB)'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const scaled = downscaleImage(img);
        setUploadPreview(scaled);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const confirmUpload = () => {
    if (!uploadPreview) { toast.error('Select an image first'); return; }
    onSave(uploadPreview);
    onClose();
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[95%] max-w-[640px] bg-background border border-border rounded-lg shadow-xl p-5 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold tracking-tight">Add Signature</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition text-xs">Close</button>
        </div>
        <div className="mt-1 flex-1 overflow-auto">
          <div className="flex items-center gap-2 mb-4">
            <Button size="sm" variant={tab==='draw'? 'default':'outline'} onClick={()=> setTab('draw')}>Draw</Button>
            <Button size="sm" variant={tab==='upload'? 'default':'outline'} onClick={()=> setTab('upload')}>Upload</Button>
          </div>
          {tab === 'draw' && (
            <div className="space-y-3">
              <div ref={containerRef} className="border rounded-md bg-white shadow-inner h-[180px] relative overflow-hidden">
                <canvas
                  ref={canvasRef}
                  className="touch-none cursor-crosshair absolute inset-0"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                />
                {!strokes.length && !currentStroke.length && (
                  <div className="absolute inset-0 flex items-center justify-center text-[11px] text-muted-foreground select-none pointer-events-none">Draw your signature</div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px]">
                <div className="flex items-center gap-1">
                  <span className="uppercase tracking-wide text-[9px] font-medium text-muted-foreground">Pen</span>
                  <input type="color" value={penColor} onChange={(e)=> setPenColor(e.target.value)} className="h-6 w-6 p-0 border rounded" aria-label="Pen color" />
                  <select value={penSize} onChange={(e)=> setPenSize(parseInt(e.target.value))} className="h-6 text-[11px] border rounded px-1 bg-background" aria-label="Pen size">
                    {[2,3,4,5,6].map(s => <option key={s} value={s}>{s}px</option>)}
                  </select>
                </div>
                <Button size="sm" variant="outline" onClick={undoStroke} disabled={!strokes.length} className="h-7 px-3">Undo</Button>
                <Button size="sm" variant="outline" onClick={clearCanvas} disabled={!strokes.length && !currentStroke.length} className="h-7 px-3">Clear</Button>
                <div className="ml-auto flex items-center gap-2">
                  <Button size="sm" onClick={saveDrawing} disabled={!strokes.length} className="h-7 px-4">Save</Button>
                </div>
              </div>
            </div>
          )}
          {tab === 'upload' && (
            <div className="space-y-3">
              <div className="border rounded-md bg-white h-[180px] flex items-center justify-center relative overflow-hidden">
                {uploadPreview ? (
                  <img src={uploadPreview} alt="Signature preview" className="max-h-full max-w-full object-contain" />
                ) : (
                  <div className="text-[11px] text-muted-foreground">No image selected</div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  aria-label="Upload signature image"
                  onChange={(e)=> handleFile(e.target.files?.[0])}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={()=> setUploadPreview(null)} disabled={!uploadPreview}>Remove</Button>
                <div className="ml-auto" />
                <Button size="sm" onClick={confirmUpload} disabled={!uploadPreview}>Save</Button>
              </div>
            </div>
          )}
          <div className="flex w-full justify-between items-center mt-6">
            <span className="text-[10px] text-muted-foreground">Accepted: PNG (auto-scaled). Max 2MB.</span>
            <div className="flex gap-2">
              {tab==='upload' && (
                <label className="relative inline-flex">
                  <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e)=> handleFile(e.target.files?.[0])} />
                  <Button size="sm" variant="outline" type="button">Choose File</Button>
                </label>
              )}
              <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignatureModal;

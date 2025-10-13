import React from "react";

type Props = { fire: boolean; duration?: number; className?: string };

export default function ConfettiBurst({ fire, duration = 1200, className }: Props) {
  const ref = React.useRef<HTMLCanvasElement | null>(null);
  const firedRef = React.useRef(false);

  React.useEffect(() => {
    if (!fire || firedRef.current) return;
    firedRef.current = true;

    const cvs = ref.current!;
    const ctx = cvs.getContext("2d")!;
    let frameId = 0, running = true;

    const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const resize = () => {
      const { width, height } = cvs.getBoundingClientRect();
      cvs.width = Math.floor(width * DPR);
      cvs.height = Math.floor(height * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cvs);

    const colors = ["#34d399", "#60a5fa", "#f472b6", "#f59e0b", "#a78bfa"];
    const N = 160;
    const parts = Array.from({ length: N }).map((_, i) => {
      const a = (i / N) * Math.PI * 2 + (Math.random() * 0.8 - 0.4);
      const s = 4 + Math.random() * 3.5;
      return {
        x: cvs.clientWidth / 2, y: cvs.clientHeight / 2,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2,
        g: 0.12 + Math.random() * 0.08,
        w: 2 + Math.random() * 3, h: 8 + Math.random() * 10,
        r: Math.random() * Math.PI, rv: (Math.random() * 0.3 + 0.15) * (Math.random() < 0.5 ? -1 : 1),
        c: colors[i % colors.length], a: 1,
      };
    });

    const t0 = performance.now();
    const tick = (t: number) => {
      if (!running) return;
      const el = t - t0;
      ctx.clearRect(0, 0, cvs.width, cvs.height);

      parts.forEach(p => {
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.r += p.rv;
        p.a = Math.max(0, 1 - el / duration);
        ctx.save(); ctx.globalAlpha = p.a; ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c; ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h); ctx.restore();
      });

      if (el < duration) frameId = requestAnimationFrame(tick);
      else { running = false; ctx.clearRect(0,0,cvs.width,cvs.height); ro.disconnect(); }
    };
    frameId = requestAnimationFrame(tick);
    return () => { running = false; cancelAnimationFrame(frameId); ro.disconnect(); };
  }, [fire, duration]);

  return <div className={`pointer-events-none absolute inset-0 ${className||""}`}><canvas ref={ref} className="w-full h-full"/></div>;
}

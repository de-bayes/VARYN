'use client';

import { useEffect, useRef } from 'react';

const chars = ' .~≈-';

export function AsciiWaveHero() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frameId = 0;

    const draw = (time = 0) => {
      const { width, height } = canvas;
      context.fillStyle = '#0d0d0f';
      context.fillRect(0, 0, width, height);
      context.font = '13px ui-monospace, SFMono-Regular, Menlo, monospace';

      for (let y = 24; y < height; y += 14) {
        const crest = Math.sin(y * 0.07 + time * 0.0005);

        for (let x = 0; x < width; x += 9) {
          const swell = Math.sin(x * 0.028 + time * 0.0012 + y * 0.02);
          const ripple = Math.sin(x * 0.06 - time * 0.0015) * 0.35;
          const wave = (swell + ripple + crest) / 2.35;
          const normalized = Math.max(0, Math.min(1, wave * 0.5 + 0.5));
          const idx = Math.floor(normalized * (chars.length - 1));
          const char = chars[idx];
          context.fillStyle = `rgba(244, 244, 241, ${0.1 + normalized * 0.32})`;
          context.fillText(char, x, y);
        }
      }

      if (!reduceMotion) {
        frameId = window.requestAnimationFrame(draw);
      }
    };

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      draw(performance.now());
    };

    resize();
    window.addEventListener('resize', resize);
    if (!reduceMotion) frameId = window.requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <div className="relative h-[74vh] min-h-[480px] overflow-hidden rounded-3xl border border-white/10 bg-background">
      <canvas ref={canvasRef} className="h-full w-full" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-background/70" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}

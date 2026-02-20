'use client';

import { useEffect, useRef } from 'react';

const chars = ' .:-=+*#%@';

const pseudoRandom = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453123;
  return x - Math.floor(x);
};

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
      context.textBaseline = 'middle';

      const stepX = 9;
      const stepY = 14;
      const cols = Math.max(1, Math.floor(width / stepX));
      const rows = Math.max(1, Math.floor(height / stepY));
      const density = Array.from({ length: rows }, () => new Float32Array(cols));
      const centerRow = rows * 0.52;
      const traces = Math.max(220, Math.floor(rows * 9));
      const t = time * 0.001;

      for (let i = 0; i < traces; i += 1) {
        let y = centerRow;
        let drift = (pseudoRandom(i * 2.31) - 0.5) * 0.06;
        const branchBias = (pseudoRandom(i * 0.73) - 0.5) * 0.018;
        const noiseRate = 0.12 + pseudoRandom(i * 3.91) * 0.2;

        for (let x = 0; x < cols; x += 1) {
          const progress = x / cols;
          const spread = 0.011 + Math.sqrt(progress) * 0.06;
          const stochastic = (pseudoRandom(i * 13.1 + x * 2.7 + t * noiseRate) - 0.5) * spread;
          const pulse = (pseudoRandom(i * 5.37 + x * 0.61 + t * 0.17) - 0.5) * (0.006 + progress * 0.014);

          drift += branchBias * 0.03;
          drift *= 0.996;
          y += drift + stochastic + pulse;

          // Mild mean reversion keeps trajectories sock-like instead of exploding quadratically.
          y += (centerRow - y) * 0.004;

          if (y < 0) y = 0;
          if (y > rows - 1) y = rows - 1;

          const yInt = Math.floor(y);
          const frac = y - yInt;
          const intensity = 0.58 + progress * 0.78;

          density[yInt][x] += intensity * (1 - frac);
          if (yInt + 1 < rows) density[yInt + 1][x] += intensity * frac;
        }
      }

      for (let row = 0; row < rows; row += 1) {
        const y = row * stepY + stepY / 2;

        for (let col = 0; col < cols; col += 1) {
          const raw = density[row][col];
          if (raw < 0.15) continue;

          const normalized = Math.min(1, raw / 10.5);
          const charIndex = Math.min(chars.length - 1, Math.floor(normalized * (chars.length - 1)));
          const char = chars[charIndex];
          context.fillStyle = `rgba(244, 244, 241, ${0.08 + normalized * 0.56})`;
          context.fillText(char, col * stepX, y);
        }
      }
    };

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      draw(performance.now());
    };

    resize();
    window.addEventListener('resize', resize);
    if (!reduceMotion) frameId = window.requestAnimationFrame(function loop(now) {
      draw(now);
      frameId = window.requestAnimationFrame(loop);
    });

    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <div className="relative h-[74vh] min-h-[480px] overflow-hidden rounded-3xl border border-white/10 bg-background">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}

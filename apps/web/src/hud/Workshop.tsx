import { useEffect, useRef } from 'react';

/**
 * Fondo: un taller original fuera de foco (como en cine), dibujado una vez a media resolución.
 * Se mueve apenas con el cursor o al inclinar el iPhone (paralaje).
 * Pieza intercambiable: más adelante puede reemplazarse por una foto generada, sin tocar lo demás.
 */
export function Workshop() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    let t = 0;
    const draw = () => paint(c, innerWidth, innerHeight, innerWidth < 700);
    draw();
    const onResize = () => { clearTimeout(t); t = window.setTimeout(draw, 200); };
    addEventListener('resize', onResize);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const move = (x: number, y: number) => { if (!reduced) c.style.transform = `scale(1.06) translate(${x * -10}px, ${y * -6}px)`; };
    const onPointer = (e: PointerEvent) => move(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5);
    const onTilt = (e: DeviceOrientationEvent) => { if (e.gamma != null && e.beta != null) move(Math.max(-1, Math.min(1, e.gamma / 30)) * 0.5, Math.max(-1, Math.min(1, (e.beta - 45) / 30)) * 0.5); };
    addEventListener('pointermove', onPointer);
    addEventListener('deviceorientation', onTilt);
    return () => { removeEventListener('resize', onResize); removeEventListener('pointermove', onPointer); removeEventListener('deviceorientation', onTilt); };
  }, []);
  return <canvas ref={ref} className="workshop" aria-hidden="true" />;
}

function paint(c: HTMLCanvasElement, W: number, H: number, phone: boolean) {
  const s = 0.5; // media resolución: todo está desenfocado, así que no se nota y es rápido
  c.width = Math.ceil(W * s); c.height = Math.ceil(H * s);
  const b = c.getContext('2d')!; b.setTransform(s, 0, 0, s, 0, 0);
  let seed = 99; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const vpx = W * 0.56, hz = H * (phone ? 0.5 : 0.56);
  let gr = b.createLinearGradient(0, 0, 0, hz); gr.addColorStop(0, '#07090a'); gr.addColorStop(0.55, '#121512'); gr.addColorStop(1, '#0d100f');
  b.fillStyle = gr; b.fillRect(0, 0, W, hz);
  gr = b.createLinearGradient(0, hz, 0, H); gr.addColorStop(0, '#101413'); gr.addColorStop(1, '#030505');
  b.fillStyle = gr; b.fillRect(0, hz, W, H - hz);
  b.globalCompositeOperation = 'lighter';
  b.filter = 'blur(20px)';
  for (const off of [-0.25, 0.1, 0.38]) { b.beginPath(); b.ellipse(vpx + off * W, H * 0.04, W * 0.12, H * 0.05, 0, 0, 6.2832); b.fillStyle = 'rgba(200,225,215,.10)'; b.fill(); }
  b.filter = 'blur(9px)';
  for (let i = 0; i < 3; i++) { const x = W * (0.8 + i * 0.075), w = W * 0.06;
    b.beginPath(); b.moveTo(x, H * 0.12 + i * 6); b.lineTo(x + w, H * 0.10 + i * 6); b.lineTo(x + w, H * 0.27); b.lineTo(x, H * 0.29); b.closePath();
    b.fillStyle = 'rgba(205,220,215,.22)'; b.fill(); }
  b.filter = 'blur(4px)';
  const n = phone ? 6 : 10, x0 = W * (phone ? 0.1 : 0.36), x1 = W * (phone ? 0.9 : 0.78), wy = hz - H * 0.07;
  for (let i = 0; i < n; i++) { const x = x0 + (x1 - x0) * i / (n - 1);
    const cg = b.createLinearGradient(0, wy, 0, wy - H * 0.13); cg.addColorStop(0, 'rgba(225,245,205,.7)'); cg.addColorStop(1, 'rgba(225,245,205,0)');
    b.beginPath(); b.moveTo(x - 9, wy); b.lineTo(x + 9, wy); b.lineTo(x + 26, wy - H * 0.13); b.lineTo(x - 26, wy - H * 0.13); b.closePath(); b.fillStyle = cg; b.fill();
    const rg = b.createLinearGradient(0, hz, 0, hz + H * 0.22); rg.addColorStop(0, 'rgba(210,240,200,.2)'); rg.addColorStop(1, 'rgba(210,240,200,0)');
    const fx = vpx + (x - vpx) * 1.25; b.save(); b.filter = 'blur(8px)'; b.fillStyle = rg; b.fillRect(fx - 14, hz, 28, H * 0.22); b.restore(); }
  b.globalCompositeOperation = 'source-over'; b.filter = 'blur(3px)';
  for (let i = 0; i < 4; i++) { b.fillStyle = `rgba(4,6,7,${0.75 - i * 0.1})`; b.fillRect(W * (0.02 + i * 0.07), H * (0.18 + i * 0.03), W * 0.06, hz - H * (0.18 + i * 0.03)); }
  b.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 26; i++) { b.fillStyle = r() < 0.5 ? 'rgba(110,230,255,.6)' : 'rgba(255,214,150,.45)'; b.fillRect(W * (0.03 + r() * 0.28), H * (0.22 + r() * 0.3), 2.5, 2.5); }
  for (const [cnt, bl, amax] of [[phone ? 10 : 22, 1, 0.1], [phone ? 6 : 12, 4, 0.14]] as const) { b.filter = `blur(${bl}px)`;
    for (let i = 0; i < cnt; i++) { const rr = 2 + r() * (bl > 2 ? 18 : 7); const x = r() * W, y = hz * (0.2 + r() * 0.85);
      b.beginPath(); b.arc(x, y, rr, 0, 6.2832); b.fillStyle = r() < 0.5 ? `rgba(120,225,255,${0.03 + r() * amax})` : `rgba(255,224,170,${0.03 + r() * amax})`; b.fill(); } }
  b.filter = 'none';
  const hzg = b.createRadialGradient(W / 2, hz, 0, W / 2, hz, W * 0.6); hzg.addColorStop(0, 'rgba(60,170,200,.10)'); hzg.addColorStop(1, 'rgba(0,0,0,0)');
  b.fillStyle = hzg; b.fillRect(0, 0, W, H);
  // escritorio curvo de acero desde tu punto de vista
  b.globalCompositeOperation = 'source-over';
  const dy = H * (phone ? 0.9 : 0.82);
  b.beginPath(); b.moveTo(-W * 0.1, H + 10); b.quadraticCurveTo(W / 2, dy - H * 0.06, W * 1.1, H + 10); b.closePath();
  const dg = b.createLinearGradient(0, dy - H * 0.05, 0, H); dg.addColorStop(0, '#2b3437'); dg.addColorStop(0.08, '#1a2124'); dg.addColorStop(1, '#07090a');
  b.fillStyle = dg; b.fill();
  b.globalCompositeOperation = 'lighter';
  const rf = b.createRadialGradient(W / 2, dy, 0, W / 2, dy, W * 0.35); rf.addColorStop(0, 'rgba(110,225,255,.2)'); rf.addColorStop(1, 'rgba(110,225,255,0)');
  b.fillStyle = rf; b.fill();
  b.beginPath(); b.moveTo(-W * 0.1, H + 10); b.quadraticCurveTo(W / 2, dy - H * 0.06, W * 1.1, H + 10);
  b.strokeStyle = 'rgba(190,240,255,.35)'; b.lineWidth = 1.5; b.stroke();
  b.globalCompositeOperation = 'source-over';
}

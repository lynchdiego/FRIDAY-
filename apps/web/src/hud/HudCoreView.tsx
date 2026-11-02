import { useEffect, useRef } from 'react';
import { HudCore, type HudEvent } from './HudCore';
import { presence, syntheticVoice, liveLevel, alertFlash } from '../mobius/presence';
import { chat } from '../state/chat';
import { getTz } from '../state/tz';

/** Presencia de FRIDAY: núcleo de luz conectado al estado, la voz real, tus eventos y las alertas. */
export function HudCoreView({ className, events = [], labels = false }: { className?: string; events?: HudEvent[]; labels?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const core = useRef<HudCore | null>(null);
  useEffect(() => {
    let c: HudCore;
    try { c = new HudCore(ref.current!, { labels, tz: getTz }); } catch { ref.current?.classList.add('core-fallback'); return; }
    core.current = c;
    let raf = 0; const t0 = performance.now();
    const tick = () => {
      const { state, level, auto } = presence.get();
      c.setState(state);
      const active = state === 'listen' || state === 'speak';
      const real = liveLevel.get();
      c.setLevel(active ? (real ?? (auto ? syntheticVoice((performance.now() - t0) / 1000) : level)) : 0);
      c.setAlert(alertFlash.isError() ? 'error' : chat.get().action ? 'confirm' : 'none');
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(raf); c.dispose(); core.current = null; };
  }, [labels]);
  useEffect(() => { core.current?.setEvents(events); }, [events]);
  return <div ref={ref} className={`core ${className ?? ''}`} aria-hidden="true" />;
}

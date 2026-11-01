import { useEffect, useRef } from 'react';
import { Mobius } from './Mobius';
import { presence, syntheticVoice } from './presence';

export function MobiusView({ className, distance }: { className?: string; distance?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const m = new Mobius(ref.current!, { distance });
    let raf = 0;
    const t0 = performance.now();
    const tick = () => {
      const { state, level, auto } = presence.get();
      m.setState(state);
      const active = state === 'listen' || state === 'speak';
      m.setLevel(active ? (auto ? syntheticVoice((performance.now() - t0) / 1000) : level) : 0);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(raf); m.dispose(); };
  }, [distance]);
  return <div ref={ref} className={className} aria-hidden="true" />;
}

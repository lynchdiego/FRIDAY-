// Íconos de línea fina (sin emojis).
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
export const Mic = () => <svg className="icon" viewBox="0 0 24 24" {...S}><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>;
export const Pen = () => <svg className="icon" viewBox="0 0 24 24" {...S}><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/></svg>;
export const Speaker = () => <svg className="icon" viewBox="0 0 24 24" {...S}><path d="M4 9v6h4l5 4V5L8 9H4zM16.5 8.5a5 5 0 0 1 0 7"/></svg>;
export const Mute = () => <svg className="icon" viewBox="0 0 24 24" {...S}><path d="M4 9v6h4l5 4V5L8 9H4zM17 9l4 6M21 9l-4 6"/></svg>;
export const ArrowUp = () => <svg className="icon" viewBox="0 0 24 24" {...S}><path d="M12 19V5M6 11l6-6 6 6"/></svg>;

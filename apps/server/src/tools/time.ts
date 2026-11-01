import { tzOffset } from '../integrations/mock';

/** Si la fecha no trae zona horaria, se interpreta en la zona de Diego. */
export function inTz(iso: string, tz: string) {
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso)) return iso;
  const full = iso.length === 10 ? `${iso}T00:00:00` : iso.length === 16 ? `${iso}:00` : iso;
  return `${full}${tzOffset(tz, new Date(full + 'Z'))}`;
}

export function fmt(iso: string, tz: string) {
  return new Date(iso).toLocaleString('es-MX', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}

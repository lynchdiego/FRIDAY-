/** Zona horaria de Diego (la indica el servidor). Toda fecha y hora en pantalla se muestra en ella. */
let tz = 'America/Cancun';
export const getTz = () => tz;
export const setTz = (v: string) => { tz = v; };

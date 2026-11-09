/**
 * SENTINEL — Utilidades de formato para localización en Español (España - es-ES)
 * Cumple con estándares europeos y convenciones de la RAE / ISO:
 * - Fechas: DD/MM/YYYY o formato natural en español
 * - Hora: Formato 24h (HH:mm / HH:mm:ss) con zona horaria oficial Madrid/CET
 * - Números: Separador de miles punto (.) y separador decimal coma (,)
 */

const LOCALE = 'es-ES';
const TIMEZONE = 'Europe/Madrid';

/**
 * Formatea una fecha en formato conciso DD/MM/YYYY
 */
export function formatearFecha(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return '—';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat(LOCALE, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: TIMEZONE
    }).format(d);
  } catch {
    return '—';
  }
}

/**
 * Formatea una fecha y hora completa en español
 * Ej: "3 de noviembre de 2026, 18:45"
 */
export function formatearFechaCompleta(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return '—';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat(LOCALE, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: TIMEZONE
    }).format(d);
  } catch {
    return '—';
  }
}

/**
 * Formatea únicamente la hora militar 24h
 * Ej: "18:45:10"
 */
export function formatearHora(dateInput: string | number | Date | null | undefined, incluirSegundos = true): string {
  if (!dateInput) return '—';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat(LOCALE, {
      hour: '2-digit',
      minute: '2-digit',
      second: incluirSegundos ? '2-digit' : undefined,
      hour12: false,
      timeZone: TIMEZONE
    }).format(d);
  } catch {
    return '—';
  }
}

/**
 * Devuelve el tiempo transcurrido en español natural
 * Ej: "hace 4 min", "hace 2 h", "hace 3 d"
 */
export function tiempoRelativo(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return '—';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '—';
    const ahora = Date.now();
    const diffMs = ahora - d.getTime();
    
    if (diffMs < 0) return 'en breve';
    
    const diffSeg = Math.floor(diffMs / 1000);
    if (diffSeg < 60) return 'hace un momento';
    
    const diffMin = Math.floor(diffSeg / 60);
    if (diffMin < 60) return `hace ${diffMin} min`;
    
    const diffHoras = Math.floor(diffMin / 60);
    if (diffHoras < 24) return `hace ${diffHoras} ${diffHoras === 1 ? 'hora' : 'horas'}`;
    
    const diffDias = Math.floor(diffHoras / 24);
    if (diffDias < 30) return `hace ${diffDias} ${diffDias === 1 ? 'día' : 'días'}`;
    
    const diffMeses = Math.floor(diffDias / 30);
    return `hace ${diffMeses} ${diffMeses === 1 ? 'mes' : 'meses'}`;
  } catch {
    return '—';
  }
}

/**
 * Formatea un número entero con separador de miles
 * Ej: 1250000 -> "1.250.000"
 */
export function formatearNumero(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return new Intl.NumberFormat(LOCALE, {
    useGrouping: true,
    maximumFractionDigits: 0
  }).format(num);
}

/**
 * Formatea un número decimal con coma
 * Ej: 1250.75 -> "1.250,75"
 */
export function formatearDecimal(num: number | null | undefined, decimales = 2): string {
  if (num === null || num === undefined || isNaN(num)) return '0,00';
  return new Intl.NumberFormat(LOCALE, {
    useGrouping: true,
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales
  }).format(num);
}

/**
 * Formatea un importe monetario
 * Ej: 4500.5, 'EUR' -> "4.500,50 €"
 */
export function formatearMoneda(num: number | null | undefined, moneda = 'EUR'): string {
  if (num === null || num === undefined || isNaN(num)) return '—';
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: moneda,
    useGrouping: true,
    currencyDisplay: 'narrowSymbol'
  }).format(num);
}

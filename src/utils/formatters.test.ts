import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatearFecha,
  formatearFechaCompleta,
  formatearHora,
  tiempoRelativo,
  formatearNumero,
  formatearDecimal,
  formatearMoneda
} from './formatters';

describe('Localización en Español (es-ES) — Utilidades de formato', () => {
  it('formatea fechas al estándar DD/MM/YYYY', () => {
    const fecha = '2026-11-03T12:00:00Z';
    const formateada = formatearFecha(fecha);
    assert.match(formateada, /^\d{2}\/\d{2}\/\d{4}$/);
    assert.equal(formatearFecha(null), '—');
    assert.equal(formatearFecha('fecha-invalida'), '—');
  });

  it('formatea horas en estándar militar 24h', () => {
    const fecha = '2026-11-03T18:45:30Z';
    const hora = formatearHora(fecha, true);
    assert.match(hora, /^\d{2}:\d{2}:\d{2}$/);
    assert.equal(formatearHora(null), '—');
  });

  it('calcula tiempos relativos en español natural', () => {
    const ahora = Date.now();
    assert.equal(tiempoRelativo(new Date(ahora - 10000)), 'hace un momento');
    assert.equal(tiempoRelativo(new Date(ahora - 5 * 60000)), 'hace 5 min');
    assert.equal(tiempoRelativo(new Date(ahora - 2 * 3600000)), 'hace 2 horas');
    assert.equal(tiempoRelativo(new Date(ahora - 3 * 86400000)), 'hace 3 días');
    assert.equal(tiempoRelativo(null), '—');
  });

  it('formatea números con separador de miles español (.)', () => {
    assert.equal(formatearNumero(1000), '1.000');
    assert.equal(formatearNumero(1250000), '1.250.000');
    assert.equal(formatearNumero(0), '0');
    assert.equal(formatearNumero(null), '0');
  });

  it('formatea decimales con coma (,) en español', () => {
    assert.equal(formatearDecimal(12.5), '12,50');
    assert.equal(formatearDecimal(1250.75), '1.250,75');
  });

  it('formatea importes monetarios en formato oficial', () => {
    const resEur = formatearMoneda(1500, 'EUR');
    assert.ok(resEur.includes('1.500') && resEur.includes('€'));
  });
});

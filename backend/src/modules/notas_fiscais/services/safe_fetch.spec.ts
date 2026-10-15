import { describe, it, expect } from 'vitest';
import { hostPermitido, ipPrivado, validarUrl, UrlNaoPermitidaError } from './safe_fetch.js';

describe('ipPrivado', () => {
  it.each([
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.0.10',
    '169.254.169.254', '0.0.0.0', '100.64.0.1', '224.0.0.1',
    '::1', '::', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe',
  ])('bloqueia %s', (ip) => {
    expect(ipPrivado(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '200.201.160.1', '172.32.0.1', '2606:4700:4700::1111'])('libera %s', (ip) => {
    expect(ipPrivado(ip)).toBe(false);
  });
});

describe('hostPermitido', () => {
  it('aceita somente subdomínios de gov.br', () => {
    expect(hostPermitido('www.dfe.ms.gov.br')).toBe(true);
    expect(hostPermitido('nfce.fazenda.sp.gov.br')).toBe(true);
    expect(hostPermitido('gov.br.evil.com')).toBe(false);
    expect(hostPermitido('evilgov.br')).toBe(false);
    expect(hostPermitido('localhost')).toBe(false);
    expect(hostPermitido('169.254.169.254')).toBe(false);
  });
});

describe('validarUrl', () => {
  it('aceita https da SEFAZ e sobe http para https', () => {
    expect(validarUrl('https://www.dfe.ms.gov.br/nfce/qrcode?p=1').protocol).toBe('https:');
    const url = validarUrl('http://www.dfe.ms.gov.br:80/nfce/qrcode?p=1');
    expect(url.protocol).toBe('https:');
    expect(url.port).toBe('');
  });

  it.each([
    'http://169.254.169.254/latest/meta-data/',
    'https://localhost:5432/',
    'https://www.dfe.ms.gov.br@evil.com/',
    'https://user:pass@www.dfe.ms.gov.br/',
    'https://www.dfe.ms.gov.br:8443/',
    'file:///etc/passwd',
    'ftp://www.dfe.ms.gov.br/',
    'não é url',
  ])('rejeita %s', (entrada) => {
    expect(() => validarUrl(entrada)).toThrow(UrlNaoPermitidaError);
  });
});

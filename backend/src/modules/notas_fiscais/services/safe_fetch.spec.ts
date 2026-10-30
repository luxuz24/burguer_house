import dns from 'node:dns';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { hostPermitido, ipPrivado, validarUrl, UrlNaoPermitidaError, buscarPaginaPublica, requisitar } from './safe_fetch.js';

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

  it('aceita domínio apex quando configurado na lista de permitidos', () => {
    expect(hostPermitido('sefaz.sp.gov.br', ['.sefaz.sp.gov.br'])).toBe(true);
    expect(hostPermitido('gov.br', ['.gov.br'])).toBe(true);
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

describe('requisitar e buscarPaginaPublica - timeout total', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('buscarPaginaPublica rejeita imediatamente se o prazo total tiver expirado', async () => {
    await expect(
      buscarPaginaPublica('https://www.dfe.ms.gov.br/nfce/qrcode?p=1', { tempoLimiteTotalMs: -10 })
    ).rejects.toThrow('Tempo limite total da requisição excedido');
  });

  it('buscarPaginaPublica divide o prazo total entre redirecionamentos sucessivos', async () => {
    const chamadasTimeout: number[] = [];
    const requisitarMock = vi.fn().mockImplementation(async (_url: URL, _headers: any, timeoutMs: number) => {
      chamadasTimeout.push(timeoutMs);
      if (chamadasTimeout.length === 1) {
        // Simula latência de 50ms no primeiro salto de redirecionamento
        await new Promise((r) => setTimeout(r, 50));
        return { status: 302, location: 'https://www.dfe.ms.gov.br/nfce/qrcode?p=passo2' };
      }
      return { status: 200, corpo: '<html>ok</html>' };
    });

    const totalBudget = 500;
    const resultado = await buscarPaginaPublica('https://www.dfe.ms.gov.br/nfce/qrcode?p=1', {
      tempoLimiteTotalMs: totalBudget,
      requisitar: requisitarMock,
    });

    expect(resultado).toBe('<html>ok</html>');
    expect(chamadasTimeout.length).toBe(2);
    expect(chamadasTimeout[0]).toBe(totalBudget);
    // O segundo salto deve ter recebido um prazo decrescido pelo tempo gasto no primeiro salto
    expect(chamadasTimeout[1]).toBeLessThan(totalBudget);
    expect(chamadasTimeout[1]).toBeLessThanOrEqual(totalBudget - 40);
  });

  it('buscarPaginaPublica rejeita se saltos anteriores esgotarem o teto de tempo', async () => {
    const requisitarMock = vi.fn().mockImplementation(async () => {
      // Consome 100ms em um orçamento de apenas 80ms
      await new Promise((r) => setTimeout(r, 100));
      return { status: 302, location: 'https://www.dfe.ms.gov.br/nfce/qrcode?p=passo2' };
    });

    await expect(
      buscarPaginaPublica('https://www.dfe.ms.gov.br/nfce/qrcode?p=1', {
        tempoLimiteTotalMs: 80,
        requisitar: requisitarMock,
      })
    ).rejects.toThrow('Tempo limite total da requisição excedido');
  });

  it('requisitar aborta com timeout total sem tráfego real (TEST-NET-2: 198.51.100.1)', async () => {
    // Mocka o dns.lookup para responder imediatamente com IP de documentação/teste (RFC 5737 TEST-NET-2)
    // O pacote não trafega na Internet pública e não atinge servidores reais
    vi.spyOn(dns, 'lookup').mockImplementation((_hostname: any, options: any, callback: any) => {
      const cb = typeof options === 'function' ? options : callback;
      cb(null, [{ address: '198.51.100.1', family: 4 }]);
    });

    // Timeout de 1ms dispara o timer de relógio imediatamente
    await expect(
      requisitar(new URL('https://www.dfe.ms.gov.br/nfce/qrcode?p=1'), {}, 1)
    ).rejects.toThrow(/Tempo limite/);
  });
});

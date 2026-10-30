import dns from 'node:dns';
import https from 'node:https';
import net from 'node:net';

export class UrlNaoPermitidaError extends Error {
  constructor(motivo: string) {
    super(`URL não permitida: ${motivo}`);
    this.name = 'UrlNaoPermitidaError';
  }
}

const MAX_REDIRECTS = 2;
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 8000;

/** Sufixos de host aceitos. Padrão: portais estaduais da SEFAZ (*.gov.br). Sobrescreva com QRCODE_HOSTS_PERMITIDOS="a.gov.br,b.gov.br". */
export function sufixosPermitidos(): string[] {
  const env = process.env.QRCODE_HOSTS_PERMITIDOS;
  const lista = env ? env.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) : ['.gov.br'];
  return lista.map((s) => (s.startsWith('.') ? s : `.${s}`));
}

export function hostPermitido(hostname: string, sufixos = sufixosPermitidos()): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (net.isIP(host)) return false;
  return sufixos.some((s) => host.endsWith(s) || host === s.replace(/^\./, ''));
}

function ipv4Privado(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number) as [number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local / metadata de nuvem
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    a >= 224 // multicast e reservados
  );
}

/** true para loopback, rede privada, link-local, CGNAT, multicast e não especificado (IPv4 e IPv6). */
export function ipPrivado(ip: string): boolean {
  if (net.isIPv4(ip)) return ipv4Privado(ip);
  if (!net.isIPv6(ip)) return true; // formato desconhecido: bloqueia

  const v6 = ip.toLowerCase();
  const mapeado = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapeado?.[1]) return ipv4Privado(mapeado[1]);
  const mapeadoHex = v6.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mapeadoHex?.[1] && mapeadoHex[2]) {
    const hi = parseInt(mapeadoHex[1], 16);
    const lo = parseInt(mapeadoHex[2], 16);
    return ipv4Privado(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }

  return (
    v6 === '::' ||
    v6 === '::1' ||
    /^f[cd]/.test(v6) || // fc00::/7 (unique local)
    /^fe[89ab]/.test(v6) || // fe80::/10 (link-local)
    v6.startsWith('ff') // multicast
  );
}

export function validarUrl(bruto: string, sufixos = sufixosPermitidos()): URL {
  let url: URL;
  try {
    url = new URL(bruto);
  } catch {
    throw new UrlNaoPermitidaError('formato inválido');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new UrlNaoPermitidaError('protocolo não permitido');
  if (url.username || url.password) throw new UrlNaoPermitidaError('credenciais na URL não são aceitas');
  if (!hostPermitido(url.hostname, sufixos)) throw new UrlNaoPermitidaError('domínio fora da lista permitida');
  // QR codes antigos da NFC-e trazem http://; para hosts da SEFAZ sobe para https (nunca faz request em texto puro).
  if (url.protocol === 'http:') {
    url.protocol = 'https:';
    url.port = '';
  }
  if (url.port && url.port !== '443') throw new UrlNaoPermitidaError('porta não permitida');
  return url;
}

/**
 * lookup que valida o IP no momento da conexão (não só antes): impede DNS rebinding,
 * em que o host resolve para um IP público na validação e para um interno ao conectar.
 */
const lookupSeguro: NonNullable<https.RequestOptions['lookup']> = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '', 4);
    const lista = addresses as dns.LookupAddress[];
    const proibido = lista.find((a) => ipPrivado(a.address));
    if (lista.length === 0 || proibido) {
      return callback(new UrlNaoPermitidaError('o host resolve para um endereço interno') as NodeJS.ErrnoException, '', 4);
    }
    if (options.all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, lista);
    return callback(null, lista[0]!.address, lista[0]!.family);
  });
};

export function requisitar(
  url: URL,
  headers: Record<string, string>,
  timeoutMs = TIMEOUT_MS,
): Promise<{ status: number; location?: string; corpo: string }> {
  return new Promise((resolve, reject) => {
    let finalizado = false;
    let timerTotal: NodeJS.Timeout | null = null;

    const limpar = () => {
      finalizado = true;
      if (timerTotal) {
        clearTimeout(timerTotal);
        timerTotal = null;
      }
    };

    const req = https.request(url, { method: 'GET', headers, lookup: lookupSeguro, timeout: timeoutMs }, (res) => {
      const status = res.statusCode ?? 0;
      const location = typeof res.headers.location === 'string' ? res.headers.location : undefined;
      if (status >= 300 && status < 400) {
        res.resume();
        limpar();
        return resolve({ status, ...(location ? { location } : {}), corpo: '' });
      }

      const partes: Buffer[] = [];
      let total = 0;
      res.on('data', (chunk: Buffer) => {
        total += chunk.length;
        if (total > MAX_BYTES) {
          limpar();
          req.destroy(new Error('Resposta maior que o limite permitido'));
          return;
        }
        partes.push(chunk);
      });
      res.on('end', () => {
        limpar();
        resolve({ status, corpo: Buffer.concat(partes).toString('utf8') });
      });
      res.on('error', (err) => {
        limpar();
        reject(err);
      });
    });

    // 1. Timeout de inatividade de socket (idle)
    req.on('timeout', () => {
      limpar();
      req.destroy(new Error('Tempo limite de inatividade excedido'));
    });

    // 2. Timeout de relógio de tempo total da requisição (anti-slowloris)
    timerTotal = setTimeout(() => {
      if (!finalizado) {
        limpar();
        req.destroy(new Error('Tempo limite total da requisição excedido'));
      }
    }, timeoutMs);

    req.on('error', (err) => {
      limpar();
      reject(err);
    });

    req.end();
  });
}

/** GET seguro de página pública da SEFAZ: https + allowlist + IP público + redirects revalidados + limite de tamanho/tempo. */
export async function buscarPaginaPublica(
  urlBruta: string,
  headers: Record<string, string> = {},
  tempoLimiteTotalMs = TIMEOUT_MS,
  funcaoRequisitar = requisitar,
): Promise<string> {
  let url = validarUrl(urlBruta);
  const inicio = Date.now();

  for (let salto = 0; salto <= MAX_REDIRECTS; salto++) {
    const tempoRestante = tempoLimiteTotalMs - (Date.now() - inicio);
    if (tempoRestante <= 0) {
      throw new Error('Tempo limite total da requisição excedido');
    }

    const resposta = await funcaoRequisitar(url, headers, tempoRestante);

    if (resposta.status >= 300 && resposta.status < 400) {
      if (!resposta.location) throw new Error('Redirecionamento sem destino');
      url = validarUrl(new URL(resposta.location, url).toString());
      continue;
    }
    if (resposta.status < 200 || resposta.status >= 300) {
      throw new Error(`SEFAZ respondeu com status ${resposta.status}`);
    }
    return resposta.corpo;
  }
  throw new Error('Redirecionamentos demais');
}

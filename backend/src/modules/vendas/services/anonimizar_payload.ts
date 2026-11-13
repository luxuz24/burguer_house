/**
 * Remove dados pessoais (PII) de payloads brutos de pedidos (ex.: Anota AI)
 * antes de exportar para fixtures de teste ou logs/diagnósticos offline.
 *
 * Preserva integralmente os dados operacionais do pedido (`id`, `externalId`,
 * `check`, `items`, `info.items`, `quantity`, `price`, `subItems`, `observation`).
 */

const CHAVES_PII = new Set([
  'customer',
  'cliente',
  'client',
  'user',
  'usuario',
  'buyer',
  'comprador',
  'merchant',
  'store',
  'loja',
  'customername',
  'nomecliente',
  'clientname',
  'username',
  'phone',
  'telefone',
  'celular',
  'whatsapp',
  'contact',
  'contato',
  'email',
  'e_mail',
  'cpf',
  'cnpj',
  'document',
  'documento',
  'doc',
  'rg',
  'address',
  'endereco',
  'deliveryaddress',
  'entrega',
  'shippingaddress',
  'street',
  'rua',
  'logradouro',
  'number',
  'numero',
  'neighborhood',
  'bairro',
  'complement',
  'complemento',
  'reference',
  'referencia',
  'cep',
  'zipcode',
  'postalcode',
  'latitude',
  'longitude',
  'lat',
  'lng',
  'city',
  'cidade',
  'state',
  'estado',
  'uf',
  'ip',
  'ipaddress',
]);

function ehChavePii(chave: string): boolean {
  return CHAVES_PII.has(chave.trim().toLowerCase());
}

export function anonimizarPayloadVenda(valor: unknown): unknown {
  if (Array.isArray(valor)) {
    return valor.map((item) => anonimizarPayloadVenda(item));
  }
  if (valor !== null && typeof valor === 'object') {
    const entrada = valor as Record<string, unknown>;
    const saida: Record<string, unknown> = {};
    for (const [chave, val] of Object.entries(entrada)) {
      if (ehChavePii(chave)) {
        continue;
      }
      saida[chave] = anonimizarPayloadVenda(val);
    }
    return saida;
  }
  return valor;
}

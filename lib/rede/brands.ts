// Tabela oficial de códigos de bandeira ("Gestão de Vendas") documentada no
// Swagger público da Rede (developer.userede.com.br/dev-portal-swaggers/
// gestao-vendas/swagger.yaml, parâmetro `brands` do endpoint de recebíveis).
// Os 5 primeiros códigos já tinham sido conferidos batendo 100% cruzando
// dados reais de produção com o BIN do cartão — a tabela oficial confirmou
// exatamente esses valores e trouxe os demais. Código não mapeado aqui cai
// no fallback "Bandeira {código}" em vez de quebrar a tela.
const REDE_BRAND_NAMES: Record<number, string> = {
  1: 'Mastercard',
  2: 'Visa',
  3: 'Diners',
  4: 'Cabal',
  5: 'Sicred',
  6: 'Sorocred',
  7: 'Hipercard',
  8: 'Cup',
  9: 'Calcard',
  10: 'Construcard',
  11: 'Avista',
  12: 'Mais!',
  13: 'American Express',
  14: 'Elo',
  15: 'Hiper',
  16: 'Alelo',
  20: 'Sodexo',
  21: 'VR',
  22: 'Greencard',
  23: 'Nutricash',
  24: 'Planvale',
  25: 'Verocheque',
  26: 'Coopercard',
  27: 'Abrapetite',
  28: 'Bamex Benefícios',
  29: 'Biq Benefícios',
  30: 'Bonuscred',
  31: 'Convênios Card',
  32: 'Credialimentação',
  33: 'Eucard',
  34: 'Facecard',
  35: 'Flex',
  36: 'Goodcard',
  37: 'Lecard',
  38: 'Libercard',
  39: 'Maxxcard',
  40: 'Nutricard',
  41: 'Ok Cartões',
  42: 'Onecard',
  43: 'Sindplus',
  44: 'UauhBenefícios',
  45: 'Vale Shop',
  46: 'Vegas Card',
  47: 'Visasoft Pay',
  48: 'Volus',
  49: 'Vscard',
  50: 'Up Brasil',
  51: 'Verocard',
  52: 'Ticket',
  53: 'Van',
  54: 'PLI Itaú FAI',
  55: 'PL Bradesco',
  56: 'PL Banco do Brasil',
  57: 'PL Citibank',
  58: 'PL Credsystem',
  59: 'PL Porto Seguro',
  60: 'Pagamento de Fatura',
  72: 'Nova Bandeira',
  74: 'Banescard',
  76: 'Jcb',
  77: 'Credz',
  999: 'Outros',
}

export function getRedeBrandName(brandCode: number): string {
  return REDE_BRAND_NAMES[brandCode] ?? `Bandeira ${brandCode}`
}

// Usado no parâmetro `brands` (obrigatório) do endpoint de recebíveis —
// enviamos todos os códigos conhecidos pra não deixar nenhuma bandeira de
// fora da consulta.
export const ALL_REDE_BRAND_CODES = Object.keys(REDE_BRAND_NAMES).map(Number)

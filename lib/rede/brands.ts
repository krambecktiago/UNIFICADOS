// A API da Rede retorna a bandeira só como código numérico (`brandCode`),
// sem documentação pública com a tabela de conversão. Esses valores foram
// conferidos cruzando dados reais de produção com o BIN (6 primeiros
// dígitos) de cada cartão contra as faixas oficiais de cada bandeira.
// Código não mapeado aqui ainda não apareceu nas vendas da loja — cai no
// fallback "Bandeira {código}" em vez de quebrar a tela.
const REDE_BRAND_NAMES: Record<number, string> = {
  1: 'Mastercard',
  2: 'Visa',
  4: 'Cabal',
  13: 'American Express',
  14: 'Elo',
}

export function getRedeBrandName(brandCode: number): string {
  return REDE_BRAND_NAMES[brandCode] ?? `Bandeira ${brandCode}`
}

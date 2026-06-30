import Link from 'next/link'

const tools = [
  {
    href: '/dashboard/ferramentas/duplicatas',
    icon: '📊',
    title: 'Conferir Duplicatas',
    description: 'Compara retorno bancário (XLSX) com fluxo de caixa do ERP (TXT)',
    inputs: 'XLSX + TXT',
    color: 'blue',
  },
  {
    href: '/dashboard/ferramentas/seguro-vida',
    icon: '🛡️',
    title: 'Seguro de Vida',
    description: 'Cruza PDF do seguro com planilha de funcionários',
    inputs: 'PDF + XLSX',
    color: 'purple',
  },
  {
    href: '/dashboard/ferramentas/contas-pagar',
    icon: '💼',
    title: 'Contas a Pagar',
    description: 'Envia resumo diário de pagamentos para o Discord via webhook',
    inputs: 'Formulário',
    color: 'green',
  },
  {
    href: '/dashboard/ferramentas/creditos-aberto',
    icon: '🔍',
    title: 'Créditos em Aberto',
    description: 'Cruza créditos em aberto do fornecedor (TXT) com pagamentos do ERP (TXT)',
    inputs: 'TXT + TXT',
    color: 'orange',
  },
  {
    href: '/dashboard/ferramentas/comparador-dda',
    icon: '🏦',
    title: 'Comparador DDA',
    description: 'Cruza boletos DDA (CSV) com duplicatas de Contas a Pagar (TXT)',
    inputs: 'TXT + CSV',
    color: 'indigo',
  },
  {
    href: '/dashboard/ferramentas/conciliacao-cartao',
    icon: '💳',
    title: 'Conciliação Cartão',
    description: 'Cruza vendas no cartão (CSV) com duplicatas em aberto (TXT)',
    inputs: 'CSV + TXT',
    color: 'red',
  },
]

const colorMap: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600 border-blue-100',
  purple: 'bg-purple-50 text-purple-600 border-purple-100',
  green: 'bg-green-50 text-green-600 border-green-100',
  orange: 'bg-orange-50 text-orange-600 border-orange-100',
  indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  red: 'bg-red-50 text-red-600 border-red-100',
}

export default function FerramentasPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Ferramentas</h2>
        <p className="text-sm text-gray-500 mt-1">Selecione uma ferramenta para começar</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="group bg-white border border-gray-200 rounded-xl p-6 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-start gap-4">
              <div className={`text-2xl w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${colorMap[tool.color]}`}>
                {tool.icon}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                  {tool.title}
                </h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{tool.description}</p>
                <span className="inline-block mt-3 text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                  {tool.inputs}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

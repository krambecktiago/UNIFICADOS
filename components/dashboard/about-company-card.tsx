'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'

const VISION = 'Ser a principal referência no fornecimento de produtos automotivos, com qualidade e excelência no atendimento, consolidando nossa presença regional.'

const VALUES = [
  { title: 'Integridade', description: 'Ser ético e transparente em todas as nossas interações e decisões, garantindo a confiança e credibilidade perante nossos clientes, parceiros e colaboradores.' },
  { title: 'Respeito', description: 'Valorização das pessoas, suas ideias, opiniões e contribuições, promovendo um ambiente de trabalho harmonioso.' },
  { title: 'Comprometimento', description: 'Agir como dono, tomar a iniciativa, assumir as responsabilidades, ter dedicação e se comportar de maneira proativa e comprometida.' },
  { title: 'Simplicidade', description: 'Buscar soluções práticas e eficientes, facilitando processos e promovendo a clareza e objetividade em nossas ações.' },
  { title: 'Organização', description: 'Manter um ambiente de trabalho bem estruturado, onde cada detalhe é pensado para otimizar a produtividade, eficácia e o bem-estar.' },
  { title: 'Inconformismo', description: 'Não se contentar com a situação atual, buscando constantemente melhorias e inovações que impulsionem o crescimento e os resultados.' },
]

export function AboutCompanyCard() {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card padding="6" className="border-l-4 border-brand-navy">
      <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 dark:text-gray-500 mb-2">Missão</p>
      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
        Atender as necessidades de nossos clientes, com ampla disponibilidade de produtos automotivos, com qualidade e preço justo, comprometidos com as pessoas, o crescimento e sustentabilidade do negócio.
      </p>

      {expanded && (
        <div className="mt-5 space-y-5">
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 dark:text-gray-500 mb-2">Visão</p>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{VISION}</p>
          </div>

          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 dark:text-gray-500 mb-3">Valores</p>
            <ul className="space-y-3">
              {VALUES.map(value => (
                <li key={value.title}>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{value.title}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mt-0.5">{value.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="mt-4 text-xs font-semibold text-brand-navy dark:text-gray-300 hover:underline"
      >
        {expanded ? 'Ver menos' : 'Ver visão e valores'}
      </button>
    </Card>
  )
}

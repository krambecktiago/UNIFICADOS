export default function FerramentasPage() {
  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Ferramentas</h2>
      <p className="text-sm text-gray-500 mb-8">Suas ferramentas de produtividade</p>

      <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
        <p className="text-3xl mb-3">⚙</p>
        <p className="text-gray-500 text-sm">Nenhuma ferramenta cadastrada ainda.</p>
        <p className="text-gray-400 text-xs mt-1">As ferramentas aparecerão aqui quando forem adicionadas.</p>
      </div>
    </div>
  )
}

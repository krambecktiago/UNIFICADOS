import { NextRequest, NextResponse } from 'next/server'
import { analyzeWithGroq } from '@/lib/groq/client'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { prompt, systemPrompt } = await request.json()

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt é obrigatório' }, { status: 400 })
    }

    const result = await analyzeWithGroq(prompt, systemPrompt)

    return NextResponse.json({ result })
  } catch (error) {
    console.error('Erro na análise GROQ:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

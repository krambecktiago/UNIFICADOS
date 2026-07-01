import Groq from 'groq-sdk'

function getClient() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY })
}

export async function analyzeWithGroq(
  prompt: string,
  systemPrompt = 'Você é um assistente de análise de dados preciso e objetivo. Responda sempre em português brasileiro.'
): Promise<string> {
  const completion = await getClient().chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.3,
    max_tokens: 1024,
  })

  return completion.choices[0]?.message?.content ?? ''
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function chatWithGroq(messages: ChatMessage[], systemPrompt: string): Promise<string> {
  const completion = await getClient().chat.completions.create({
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.4,
    max_tokens: 768,
  })

  return completion.choices[0]?.message?.content ?? ''
}

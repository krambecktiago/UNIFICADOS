import Groq from 'groq-sdk'

function getClient() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY })
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

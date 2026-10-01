import { google } from '@ai-sdk/google'
import { generateText } from 'ai'
import { NextResponse } from 'next/server'

const MODEL = 'gemini-2.5-flash-lite'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    const action = body.action === 'analyze' ? 'analyze' : 'reflect'

    if (text.length < 8) {
      return NextResponse.json({ error: 'Write a little more before asking NeuroMirror to reflect.' }, { status: 400 })
    }

    const prompt = `You are evaluating text pasted into a private journaling app. First classify whether the text is meaningful writing or obvious keyboard noise/gibberish. Treat strings like "liekjevrdbjeejnsnsdnjfjfndjfb", repeated random characters, mostly consonants, or text with no recognizable words as gibberish. Do not pretend to find emotions, themes, intent, or mental-health meaning in gibberish.

If it is gibberish, say plainly: "This looks like random text rather than a journal entry. Try writing a sentence about what you are feeling, noticing, or remembering, and I can help you reflect on it." Do not diagnose, shame, or over-explain. If it is meaningful, answer the requested task below using only the words in the entry. Never invent context, history, facts, or feelings.

Requested task: ${action === 'analyze' ? 'Return three concise, non-clinical observations about themes, language, or emotional tone.' : 'Return two gentle reflection questions that help the writer explore their own meaning.'}

Entry:\n\n${text}`

    const result = await generateText({
      model: google(MODEL),
      system: 'You are NeuroMirror, a warm, grounded journaling companion powered by Gemini. Protect user agency and privacy. Keep responses under 120 words. Never diagnose, label, or provide medical advice.',
      prompt,
    })

    return NextResponse.json({ text: result.text, model: MODEL })
  } catch (error) {
    console.error('[v0] Gemini request failed', error)
    return NextResponse.json({ error: 'NeuroMirror could not connect right now. Your entry is still safe.' }, { status: 500 })
  }
}

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

    const prompt = action === 'analyze'
      ? `Read this private journal entry and return three concise, non-clinical observations about themes, language, or emotional tone. Never diagnose, label, or infer a medical condition. Be gentle and explainable. Entry:\n\n${text}`
      : `Read this private journal entry and return two gentle reflection questions that help the writer explore their own meaning. Do not diagnose, give medical advice, or make assumptions. Entry:\n\n${text}`

    const result = await generateText({
      model: google(MODEL),
      system: 'You are NeuroMirror, a warm journaling companion. Protect user agency and privacy. Keep responses under 120 words.',
      prompt,
    })

    return NextResponse.json({ text: result.text, model: MODEL })
  } catch (error) {
    console.error('[v0] Gemini request failed', error)
    return NextResponse.json({ error: 'NeuroMirror could not connect right now. Your entry is still safe.' }, { status: 500 })
  }
}

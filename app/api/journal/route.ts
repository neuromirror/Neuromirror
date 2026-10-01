import postgres from 'postgres'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const sql = postgres(process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || '', { prepare: false, max: 1 })

async function ensureTable() {
  await sql`
    create table if not exists journal_entries (
      id uuid primary key,
      owner_id text not null,
      title text not null,
      body text not null,
      tags jsonb not null default '[]'::jsonb,
      mood text not null default 'Unrated',
      pinned boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz
    )
  `
  await sql`create index if not exists journal_entries_owner_created_idx on journal_entries (owner_id, created_at desc)`
}

function ownerId(request: Request) {
  const cookie = request.headers.get('cookie')?.match(/nm_owner=([^;]+)/)?.[1]
  return cookie || crypto.randomUUID()
}

function response(data: unknown, owner: string, status = 200) {
  const result = NextResponse.json(data, { status })
  result.cookies.set('nm_owner', owner, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 365 })
  return result
}

export async function GET(request: Request) {
  const owner = ownerId(request)
  await ensureTable()
  const rows = await sql`select id, title, body, tags, mood, pinned, created_at as "createdAt", updated_at as "updatedAt" from journal_entries where owner_id = ${owner} order by pinned desc, created_at desc`
  return response(rows, owner)
}

export async function POST(request: Request) {
  const owner = ownerId(request)
  const entry = await request.json()
  if (typeof entry.body !== 'string' || !entry.body.trim()) return response({ error: 'Entry body is required.' }, owner, 400)
  await ensureTable()
  const id = entry.id || crypto.randomUUID()
  const tags = Array.isArray(entry.tags) ? entry.tags.slice(0, 8) : []
  const rows = await sql`insert into journal_entries (id, owner_id, title, body, tags, mood, pinned) values (${id}, ${owner}, ${String(entry.title || 'Untitled entry').slice(0, 120)}, ${entry.body.trim()}, ${JSON.stringify(tags)}, ${String(entry.mood || 'Unrated')}, ${Boolean(entry.pinned)}) returning id, title, body, tags, mood, pinned, created_at as "createdAt", updated_at as "updatedAt"`
  return response(rows[0], owner, 201)
}

export async function PATCH(request: Request) {
  const owner = ownerId(request)
  const entry = await request.json()
  await ensureTable()
  const rows = await sql`update journal_entries set title = ${String(entry.title || 'Untitled entry').slice(0, 120)}, body = ${String(entry.body || '').trim()}, tags = ${JSON.stringify(Array.isArray(entry.tags) ? entry.tags.slice(0, 8) : [])}, mood = ${String(entry.mood || 'Unrated')}, pinned = ${Boolean(entry.pinned)}, updated_at = now() where id = ${entry.id} and owner_id = ${owner} returning id, title, body, tags, mood, pinned, created_at as "createdAt", updated_at as "updatedAt"`
  return response(rows[0] || { error: 'Entry not found.' }, owner, rows[0] ? 200 : 404)
}

export async function DELETE(request: Request) {
  const owner = ownerId(request)
  const id = new URL(request.url).searchParams.get('id')
  await ensureTable()
  await sql`delete from journal_entries where id = ${id} and owner_id = ${owner}`
  return response({ ok: true }, owner)
}

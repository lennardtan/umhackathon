// server/supabase.js — Supabase client for chat history, reports, and UM Hackathon transactions
import { createClient } from '@supabase/supabase-js';

// Lazy client — created on first use so dotenv has already run by then
let _client = null;
function getSupabase() {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.warn('[SUPABASE] URL or KEY not configured — chat history and reports will not persist.');
    return null;
  }
  _client = createClient(url, key);
  console.log('[SUPABASE] Client initialised with', process.env.SUPABASE_SERVICE_KEY ? 'service role key' : 'publishable key');
  return _client;
}

// ── Chat history ──────────────────────────────────────────────────────────────

export async function loadChatHistory(sessionId, limit = 10) {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('chat_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) { console.error('[SUPABASE] loadChatHistory error:', error.message); return []; }
  return data ?? [];
}

export async function saveChatMessages(sessionId, messages) {
  const sb = getSupabase();
  if (!sb) return;
  const rows = messages.map(m => ({ session_id: sessionId, role: m.role, content: m.content }));
  const { error } = await sb.from('chat_messages').insert(rows);
  if (error) console.error('[SUPABASE] saveChatMessages error:', error.message);
}

// ── Reports ───────────────────────────────────────────────────────────────────

export async function loadLatestReport() {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) { console.error('[SUPABASE] loadLatestReport error:', error.message); return null; }
  return data ?? null;
}

export async function saveReport(report) {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from('reports').insert([{
    summary: report.summary,
    issues: report.issues,
    recommendations: report.recommendations,
    outcomes: report.outcomes,
  }]);
  if (error) console.error('[SUPABASE] saveReport error:', error.message);
}

// ── UM Hackathon transactions (Supabase — read-only revenue source) ────────────

export async function loadSupabaseTransactions() {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('UM Hackathon')
    .select('Order_ID, Order_Date, Sales, Category, Sub_Category, Product_Name');
  if (error) { console.error('[SUPABASE] loadSupabaseTransactions error:', error.message); return []; }
  return data ?? [];
}

// Isi dengan data dari Supabase Dashboard > Project Settings > API
// Pakai "anon" / "publishable" key saja. JANGAN pernah pakai service_role key di sini.
const SUPABASE_URL = "https://pwxzqckruttjxujtaydt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_p7Jp4ZQTEIFZspObVzESXg_mvPt5BWG";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

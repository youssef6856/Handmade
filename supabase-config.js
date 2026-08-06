/* ===================== SUPABASE CONFIG ===================== */
/* الـ anon key ده آمن إنه يكون ظاهر في كود المتصفح، مصمم عشان كده */
const SUPABASE_URL = "https://lfrnqlutoftjtbxjdhhw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxmcm5xbHV0b2Z0anRieGpkaGh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2MTk5NjUsImV4cCI6MjEwMTE5NTk2NX0.1e2YZF2aZoe_EzlW5f-BQ1AGQ2tKfKcdBnncpcf-HRw";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

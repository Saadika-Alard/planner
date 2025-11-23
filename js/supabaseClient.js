const SUPABASE_URL = "https://ksmndnpljjwbjtutubbe.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzbW5kbnBsamp3Ymp0dXR1YmJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MTU2MTcsImV4cCI6MjA3OTM5MTYxN30.zexCAQ9zP67OsvEfpwO44qCKjWUDVbk-Ww9PWZXW1Wc";

// Singleton Supabase client
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.getSupabase = () => window.supabaseClient;

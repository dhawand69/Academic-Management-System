// config.js - Supabase Configuration

const SUPABASE_URL = "https://titxyzeysnmzptmidinn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdHh5emV5c25tenB0bWlkaW5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzMjg5MDIsImV4cCI6MjA4MTkwNDkwMn0.RnvpRUtihR-ahnKhDuoJgOdWss_CA9Rsg6ln5_3zV-Q";

const ADMIN_PASSWORD = "GecKaimur@148";

const branchMap = {
  101: "Civil",
  102: "Mechanical",
  103: "Electrical",
  104: "ECE",
  152: "CSE(Cyber Security)",
  156: "CSE(Networks)",
};

let supabaseClient;

async function initSupabase() {
  const { createClient } = window.supabase;
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabaseClient;
}

let currentUser = null;
let activeStudentFilter = {
  year: "all",
  semester: null,
  branch: "all",
};

let activeClassFilter = {
  year: "all",
  semester: null,
};

let displayedStudents = [];
let selectedStudentIds = new Set();
let pendingAction = null;
let parsedBatchClasses = [];

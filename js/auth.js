const supa = getSupabase();
const AUTH_PROFILE_KEY = "hp_auth_profile";

function setLoggedIn(profile) {
  localStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(profile || {}));
}

function clearProfile() {
  localStorage.removeItem(AUTH_PROFILE_KEY);
}

async function logout() {
  clearProfile();
  await supa.auth.signOut();
  window.location.href = "login.html";
}

async function requireAuth() {
  const { data } = await supa.auth.getSession();
  if (!data.session) {
    window.location.href = "login.html";
    throw new Error("No session");
  }
  return data.session;
}

async function getProfile() {
  const { data } = await supa.auth.getUser();
  return data.user;
}

async function getProfileRow() {
  const user = await getProfile();
  if (!user) return null;
  const { data, error } = await supa
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .limit(1);
  if (error) {
    console.error("Profile row fetch failed", error);
    return null;
  }
  return data && data[0];
}

async function ensureProfileRecord() {
  const { data: userRes } = await supa.auth.getUser();
  const user = userRes.user;
  if (!user) return null;

  const { data: profs, error } = await supa
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .limit(1);

  if (error) {
    console.error("Profile fetch failed", error);
    return null;
  }

  if (profs && profs.length) return profs[0];

  const { data: created, error: createErr } = await supa
    .from("profiles")
    .insert({ id: user.id, onboarding_complete: false })
    .select()
    .single();

  if (createErr) {
    console.error("Profile create failed", createErr);
    return null;
  }

  return created;
}

window.authHelpers = { requireAuth, getProfile, getProfileRow, logout, setLoggedIn, ensureProfileRecord };

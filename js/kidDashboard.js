const supaKid = getSupabase();

async function loadKidView() {
  const params = new URLSearchParams(window.location.search);
  const childId = params.get("childId");
  const childNameParam = params.get("child");
  if (!childId && !childNameParam) {
    window.location.href = "index.html";
    return;
  }

  const nameHeading = document.getElementById("kidNameHeading");
  const gradeHeading = document.getElementById("kidGradeHeading");
  const todayLabel = document.getElementById("kidTodayLabel");
  const list = document.getElementById("kidEventsList");

  await requireAuth();
  showLoader();

  const { data: userRes } = await supaKid.auth.getUser();
  const userId = userRes.user.id;

  const { data: kids } = await supaKid
    .from("children")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  const child =
    (kids || []).find(c => childId && c.id === childId) ||
    (kids || []).find(c => !childId && childNameParam && c.name === childNameParam);
  const childName = child?.name || childNameParam || "";
  if (nameHeading) nameHeading.textContent = childName || "Child";
  if (gradeHeading) gradeHeading.textContent = child?.grade ? `Grade: ${child.grade}` : "";

  const todayIso = new Date().toISOString().slice(0, 10);

  let eventsQuery = supaKid
    .from("events")
    .select("*")
    .eq("user_id", userId)
    .gte("date", todayIso)
    .order("date", { ascending: true });

  if (child && child.id) {
    eventsQuery = eventsQuery.eq("child_id", child.id);
  } else if (childName) {
    eventsQuery = eventsQuery.eq("child", childName);
  }

  const { data: events } = await eventsQuery;

  const { data: resources } = await supaKid
    .from("resources")
    .select("id,title,subject,exercise_pack_url,grade");

  hideLoader();

  const evs = (events || []).filter(e => {
    if (!e.child || !childName) return false;
    return e.child.toString().trim().toLowerCase() === childName.toString().trim().toLowerCase();
  });
  if (todayLabel) {
    todayLabel.textContent = `From ${new Date(todayIso).toLocaleDateString()}`;
  }

  if (!evs.length) {
    list.innerHTML = "<p class='muted'>No upcoming work yet.</p>";
    return;
  }

  list.innerHTML = "";

  evs.forEach(ev => {
    const res = (resources || []).find(r => r.id === ev.resource_id);
    if (!res || !res.exercise_pack_url) return; // only show exercise packs

    const item = document.createElement("div");
    item.className = "resource";
    const dateLabel = new Date(ev.date).toLocaleDateString();
    item.innerHTML = `
      <h4>${dateLabel} — ${res.title}</h4>
      <div class="resource-meta">
        ${res.subject ? `<span class="pill soft" style="background:${window.getSubjectColor ? window.getSubjectColor(res.subject) : ''};">${res.subject}</span>` : ""}
      </div>
      <div class="resource-links">
        <a class="assign-btn" href="${res.exercise_pack_url}" target="_blank">Open exercise pack</a>
      </div>
    `;
    list.appendChild(item);
  });
}

document.addEventListener("DOMContentLoaded", loadKidView);

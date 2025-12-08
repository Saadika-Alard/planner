const supaClient = getSupabase();

const childNameInput = document.getElementById("childName");
const childGradeInput = document.getElementById("childGrade");
const addChildBtn = document.getElementById("addChild");
const childList = document.getElementById("childList");

const newSubjectInput = document.getElementById("newSubject");
const addSubjectBtn = document.getElementById("addSubject");
const activeSubjectsEl = document.getElementById("activeSubjects");
const inactiveSubjectsEl = document.getElementById("inactiveSubjects");

const statKids = document.getElementById("statKids");
const statSubjects = document.getElementById("statSubjects");
const saveBtn = document.getElementById("saveSetup");

const heroEyebrow = document.getElementById("heroEyebrow");
const heroTitle = document.getElementById("heroTitle");
const heroLede = document.getElementById("heroLede");
const step1Hint = document.getElementById("step1Hint");
const parentPinInput = document.getElementById("parentPin");

let currentUser = null;
let children = [];
let subjects = [];

const defaultSubjects = [
  "English", "Afrikaans", "Mathematics", "Natural Sciences", "Life Orientation",
  "Social Sciences", "Technology", "Creative Arts", "Economic Management Sciences",
  "History", "Geography", "Physical Sciences", "Life Sciences", "Accounting",
  "Business Studies", "Information Technology", "Computer Applications Technology"
];

function renderChildren() {
  if (!childList) return;
  childList.innerHTML = "";
  children.forEach((c, idx) => {
    const card = document.createElement("div");
    card.className = "resource";
    card.innerHTML = `
      <button class="delete-btn" data-idx="${idx}">✕</button>
      <div class="resource-header">
        <div>
          <input
            type="text"
            class="child-name-edit"
            data-idx="${idx}"
            value="${c.name}"
            style="width:100%; margin-bottom:0.35rem; padding:0.3rem 0.4rem; border-radius:8px; border:1px solid #dfe6d4; background:#fbfdf8;"
          />
          <select
            class="child-grade-edit"
            data-idx="${idx}"
            style="width:100%; padding:0.3rem 0.4rem; border-radius:8px; border:1px solid #dfe6d4; background:#fbfdf8;"
          >
            <option value="">Select grade</option>
            <option ${c.grade === "Pre-K" ? "selected" : ""}>Pre-K</option>
            <option ${c.grade === "Grade R (Reception)" ? "selected" : ""}>Grade R (Reception)</option>
            <option ${c.grade === "Grade 1" ? "selected" : ""}>Grade 1</option>
            <option ${c.grade === "Grade 2" ? "selected" : ""}>Grade 2</option>
            <option ${c.grade === "Grade 3" ? "selected" : ""}>Grade 3</option>
            <option ${c.grade === "Grade 4" ? "selected" : ""}>Grade 4</option>
            <option ${c.grade === "Grade 5" ? "selected" : ""}>Grade 5</option>
            <option ${c.grade === "Grade 6" ? "selected" : ""}>Grade 6</option>
            <option ${c.grade === "Grade 7" ? "selected" : ""}>Grade 7</option>
            <option ${c.grade === "Grade 8" ? "selected" : ""}>Grade 8</option>
            <option ${c.grade === "Grade 9" ? "selected" : ""}>Grade 9</option>
            <option ${c.grade === "Grade 10" ? "selected" : ""}>Grade 10</option>
            <option ${c.grade === "Grade 11" ? "selected" : ""}>Grade 11</option>
            <option ${c.grade === "Grade 12" ? "selected" : ""}>Grade 12</option>
          </select>
        </div>
      </div>
    `;
    childList.appendChild(card);
  });
  statKids.textContent = children.length;
}

function renderSubjects() {
  activeSubjectsEl.innerHTML = "";
  inactiveSubjectsEl.innerHTML = "";

  subjects.filter(s => s.active).forEach((s) => {
    const chip = document.createElement("span");
    chip.className = "pill";
    chip.textContent = s.name;
    chip.style.cursor = "pointer";
    chip.onclick = () => toggleSubject(s.name, false);
    activeSubjectsEl.appendChild(chip);
  });

  subjects.filter(s => !s.active).forEach((s) => {
    const chip = document.createElement("span");
    chip.className = "pill soft";
    chip.textContent = s.name;
    chip.style.cursor = "pointer";
    chip.onclick = () => toggleSubject(s.name, true);
    inactiveSubjectsEl.appendChild(chip);
  });

  statSubjects.textContent = subjects.filter(s => s.active).length;
}

function toggleSubject(name, toActive) {
  const targetName = name;
  subjects = subjects.map(s =>
    s.name === targetName ? { ...s, active: toActive } : s
  );
  renderSubjects();
}

function addChild() {
  const name = childNameInput.value.trim();
  const grade = childGradeInput.value;
  if (!name || !grade) {
    alert("Add a name and select a grade");
    return;
  }
  children.push({ name, grade });
  childNameInput.value = "";
  childGradeInput.value = "";
  renderChildren();
}

function addSubject(custom = false) {
  const name = custom ? newSubjectInput.value.trim() : "";
  if (custom && !name) return;
  if (subjects.some(s => s.name.toLowerCase() === name.toLowerCase())) {
    newSubjectInput.value = "";
    return;
  }
  subjects.push({ name: custom ? name : "New Subject", active: true });
  if (custom) newSubjectInput.value = "";
  renderSubjects();
}

async function loadExisting() {
  showLoader();
  const { data: userRes } = await supaClient.auth.getUser();
  currentUser = userRes.user;

  const { data: kidsData } = await supaClient
    .from("children")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: true });
  children = kidsData || [];

  const { data: subjData } = await supaClient
    .from("subjects")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("name", { ascending: true });
  subjects = subjData && subjData.length
    ? subjData
    : defaultSubjects.map(n => ({ name: n, active: true }));

  // Load parent PIN from profile if present
  const { data: profileRows } = await supaClient
    .from("profiles")
    .select("parent_pin")
    .eq("id", currentUser.id)
    .limit(1);
  const profile = profileRows && profileRows[0];
  if (parentPinInput) {
    parentPinInput.value = profile?.parent_pin || "";
  }

  renderChildren();
  renderSubjects();
  hideLoader();

  // Adjust hero text depending on whether this is first-time setup or managing
  if (children.length > 0) {
    if (heroEyebrow) heroEyebrow.textContent = "Classroom settings";
    if (heroTitle) heroTitle.textContent = "Manage kids & subjects";
    if (heroLede) heroLede.textContent = "Update your kids, grades, and subjects at any time. Changes sync across your planner and lesson packs.";
    if (step1Hint) step1Hint.textContent = "Edit names or grades, or add another child.";
  } else {
    if (heroEyebrow) heroEyebrow.textContent = "Welcome";
    if (heroTitle) heroTitle.textContent = "Set up your classroom";
    if (heroLede) heroLede.textContent = "Add your kids, pick grades, and choose the subjects you teach. This keeps your planner tailored to your family.";
    if (step1Hint) step1Hint.textContent = "Add at least one child to continue";
  }
}

async function saveAll() {
  if (!children.length) {
    alert("Add at least one child");
    return;
  }

  showLoader();
  // reset user data then insert fresh sets
  await supaClient.from("children").delete().eq("user_id", currentUser.id);
  await supaClient.from("subjects").delete().eq("user_id", currentUser.id);

  const childrenRows = children.map(c => ({
    user_id: currentUser.id,
    name: c.name,
    grade: c.grade
  }));
  const subjectRows = subjects.map(s => ({
    user_id: currentUser.id,
    name: s.name,
    active: s.active
  }));

  const rawPin = parentPinInput ? parentPinInput.value.trim() : "";
  if (rawPin && !/^\d{4,6}$/.test(rawPin)) {
    hideLoader();
    alert("Parent PIN must be 4–6 digits, or leave it blank.");
    return;
  }

  const { error: childErr } = await supaClient.from("children").insert(childrenRows);
  const { error: subjErr } = await supaClient.from("subjects").insert(subjectRows);
  const { error: profErr } = await supaClient
    .from("profiles")
    .upsert({
      id: currentUser.id,
      onboarding_complete: true,
      parent_pin: rawPin || null
    });

  hideLoader();

  if (childErr || subjErr || profErr) {
    console.error(childErr || subjErr || profErr);
    alert("Save failed. Please try again.");
    return;
  }

  window.location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", async () => {
  await requireAuth();
  await ensureProfileRecord();
  await loadExisting();

  addChildBtn.onclick = addChild;
  addSubjectBtn.onclick = () => addSubject(true);

  childList.addEventListener("click", (e) => {
    const btn = e.target.closest(".delete-btn");
    if (btn) {
      const idx = +btn.dataset.idx;
      const name = children[idx]?.name || "this child";
      const ok = window.confirm(`Remove ${name} from your classroom? Their events and records will remain but won't be linked in filters.`);
      if (!ok) return;
      children.splice(idx, 1);
      renderChildren();
    }
  });

  childList.addEventListener("input", (e) => {
    const nameInput = e.target.closest(".child-name-edit");
    if (nameInput) {
      const idx = +nameInput.dataset.idx;
      children[idx].name = nameInput.value;
      return;
    }
  });

  childList.addEventListener("change", (e) => {
    const gradeSelect = e.target.closest(".child-grade-edit");
    if (gradeSelect) {
      const idx = +gradeSelect.dataset.idx;
      children[idx].grade = gradeSelect.value;
      return;
    }
  });

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.onclick = logout;

  saveBtn.onclick = saveAll;
});

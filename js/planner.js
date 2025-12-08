document.addEventListener("DOMContentLoaded", async () => {

  const supa = getSupabase();
  let currentUser = null;
  let eventsData = [];
  let resourcesData = [];
  let childrenData = [];
  let subjectsData = [];
  let selectedChildFilter = "all";
  let selectedChildIdFilter = null;

  const calendar = document.getElementById("calendar");
  const monthYear = document.getElementById("monthYear");
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");
  const addEventBtn = document.getElementById("addEventBtn");

  const eventModal = document.getElementById("eventModal");
  const saveEventBtn = document.getElementById("saveEvent");
  const closeEventModalBtn = document.getElementById("closeModal");

  const lessonModal = document.getElementById("lessonModal");
  const closeLessonModal = document.getElementById("closeLessonModal");
  const deleteEventBtn = document.getElementById("deleteEvent");

  const eventList = document.getElementById("eventList");
  const childFilterChips = document.getElementById("childFilterChips");
  const kidViewBtn = document.getElementById("kidViewBtn");
  const kidPinModal = document.getElementById("kidPinModal");
  const kidPinInput = document.getElementById("kidPinInput");
  const kidPinConfirm = document.getElementById("kidPinConfirm");
  const kidPinCancel = document.getElementById("kidPinCancel");
  const parentPinLink = document.getElementById("parentPinLink");

  let currentDate = new Date();
  let currentLessonEvent = null;
  let kidViewMode = false;
  let originalHeaderTitle = null;
  // let parentPin = ""; // Removed: PIN is no longer stored in client memory
  let kidPinAttempts = 0;

  async function loadDataFromSupabase() {
    showLoader();
    const { data: resUser } = await supa.auth.getUser();
    currentUser = resUser.user;

    const { data: evs } = await supa
      .from("events")
      .select("*")
      .order("date", { ascending: true });
    eventsData = evs || [];

    const { data: res } = await supa
      .from("resources")
      .select("*");
    resourcesData = res || [];

    const { data: kids } = await supa
      .from("children")
      .select("*")
      .order("name", { ascending: true });
    childrenData = kids || [];

    const { data: subj } = await supa
      .from("subjects")
      .select("*")
      .order("name", { ascending: true });
    subjectsData = subj || [];

    // Securely: Do NOT fetch parent_pin here.
    // It is verified via backend endpoint only.

    hideLoader();
  }

  function applyKidViewVisuals() {
    const headerTitleEl = document.querySelector(".planner header h1");
    if (!headerTitleEl) return;
    if (!originalHeaderTitle) originalHeaderTitle = headerTitleEl.textContent;

    if (kidViewMode && selectedChildFilter !== "all") {
      headerTitleEl.textContent = `👦 Kid view — ${selectedChildFilter}`;
      document.body.classList.add("kid-view-mode");
    } else {
      headerTitleEl.textContent = originalHeaderTitle || "🏡 Homeschool Planner";
      document.body.classList.remove("kid-view-mode");
    }
  }

  function updateKidViewButton() {
    if (!kidViewBtn) return;
    if (selectedChildFilter === "all") {
      kidViewBtn.disabled = true;
      kidViewBtn.textContent = "Kid view";
      return;
    }

    kidViewBtn.disabled = false;
    kidViewBtn.textContent = kidViewMode ? "Exit kid view" : "Kid view";
    kidViewBtn.onclick = () => {
      if (!kidViewMode) {
        // enter kid view immediately
        kidViewMode = true;
        applyKidViewVisuals();
        renderCalendar();
        updateKidViewButton();
      } else {
        // exiting kid view – require parent PIN
        // We always show the modal. The user can leave it blank if they have no PIN (and verification will handle it,
        // effectively meaning 'no protection' if they set valid pin to empty string?
        // Actually, if they have NO pin set, verify-pin should probably accept empty string or we need a way to check 'hasPin'.
        // For security, let's assume they MUST enter a PIN to unlock.

        if (kidPinModal) {
          kidPinAttempts = 0;
          kidPinModal.classList.remove("hidden");
          kidPinModal.dataset.mode = "unlock";
          const titleEl = kidPinModal.querySelector("h2");
          const noteEl = kidPinModal.querySelector(".dashboard-note");
          if (titleEl && noteEl) {
            titleEl.textContent = "Exit Kid View";
            noteEl.textContent = "Parent PIN is required to return to the full planner.";
          }
          if (kidPinInput) kidPinInput.value = "";
        }
      }
    };
  }

  function syncEventFormOptions() {
    const childSelect = document.getElementById("eventChild");
    const subjectSelect = document.getElementById("eventSubject");

    if (childSelect) {
      childSelect.innerHTML = `<option value="">Select child</option>`;
      childrenData.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name;
        childSelect.appendChild(opt);
      });
    }

    if (subjectSelect) {
      subjectSelect.innerHTML = `<option value="">Select subject</option>`;
      subjectsData.filter(s => s.active !== false).forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.name;
        opt.textContent = s.name;
        subjectSelect.appendChild(opt);
      });
    }
  }

  function renderChildFilter() {
    if (!childFilterChips) return;
    childFilterChips.innerHTML = "";

    // If many kids, use a dropdown to keep layout tidy
    if (childrenData.length > 3) {
      const select = document.createElement("select");
      select.className = "child-filter-select";

      const allOpt = document.createElement("option");
      allOpt.value = "all";
      allOpt.textContent = "All kids";
      select.appendChild(allOpt);

      childrenData.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name;
        select.appendChild(opt);
      });

      select.value = selectedChildIdFilter || "all";
      select.onchange = () => {
        if (select.value === "all") {
          selectedChildFilter = "all";
          selectedChildIdFilter = null;
        } else {
          selectedChildIdFilter = select.value;
          const match = childrenData.find(c => c.id === select.value);
          selectedChildFilter = match ? match.name : "all";
        }
        renderCalendar();
      };

      childFilterChips.appendChild(select);
      updateKidViewButton();
      return;
    }

    const makeChip = (label, id) => {
      const span = document.createElement("button");
      span.type = "button";
      const isActive =
        (id === "all" && selectedChildFilter === "all") ||
        (id !== "all" && selectedChildIdFilter === id);
      span.className = "child-chip" + (isActive ? " active" : "");
      const initial = label === "All kids" ? "★" : label.charAt(0).toUpperCase();
      span.innerHTML = `
        <span class="child-chip-dot">${initial}</span>
        <span class="child-chip-label">${label}</span>
      `;
      span.onclick = () => {
        if (kidViewMode) return; // locked in kid view
        if (id === "all") {
          selectedChildFilter = "all";
          selectedChildIdFilter = null;
        } else {
          selectedChildFilter = label;
          selectedChildIdFilter = id;
        }
        renderChildFilter();
        renderCalendar();
      };
      return span;
    };

    childFilterChips.appendChild(makeChip("All kids", "all"));

    childrenData.forEach(c => {
      childFilterChips.appendChild(makeChip(c.name, c.id));
    });

    updateKidViewButton();
  }

  /* ---------------------------------------------------------
     Render calendar
  --------------------------------------------------------- */
  function renderCalendar() {

    calendar.innerHTML = "";

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);

    monthYear.textContent =
      first.toLocaleString("default", { month: "long" }) + " " + year;

    const startDay = first.getDay();

    for (let i = 0; i < startDay; i++) {
      calendar.innerHTML += `<div class="day empty"></div>`;
    }

    for (let d = 1; d <= last.getDate(); d++) {
      const cell = document.createElement("div");
      cell.className = "day";

      // Build ISO date string without timezone issues
      const iso =
        year +
        "-" +
        String(month + 1).padStart(2, "0") +
        "-" +
        String(d).padStart(2, "0");

      /* ---------------------
         Make Drop Zone
      --------------------- */
      cell.ondragover = (e) => {
        e.preventDefault(); // Necessary to allow dropping
        cell.classList.add("drag-over");
      };

      cell.ondragleave = () => {
        cell.classList.remove("drag-over");
      };

      cell.ondrop = async (e) => {
        e.preventDefault();
        cell.classList.remove("drag-over");
        const eventId = e.dataTransfer.getData("text/plain");

        if (!eventId) return;

        // Optimistic UI update could go here, but for safety let's just await DB
        // Fetch event to check if we need to preserve time? for now just update date.
        // Actually, let's just update the date.

        const { error } = await supa
          .from("events")
          .update({ date: iso })
          .eq("id", eventId);

        if (error) {
          console.error("Drop update failed", error);
          alert("Failed to move event");
          return;
        }

        await loadDataFromSupabase();
        renderCalendar();
      };

      cell.innerHTML = `<span class="date-num">${d}</span>`;

      const todays = eventsData.filter(e => {
        const evDate = String(e.date).slice(0, 10);
        return (
          evDate === iso &&
          (selectedChildFilter === "all" ||
            e.child_id === selectedChildIdFilter ||
            e.child === selectedChildFilter)
        );
      });

      if (todays.length) {
        const container = document.createElement("div");
        container.classList.add("day-events");

        todays.forEach(ev => {

          const chip = document.createElement("div");
          chip.draggable = true; // Enable drag
          chip.ondragstart = (e) => {
            e.dataTransfer.setData("text/plain", ev.id);
            e.dataTransfer.effectAllowed = "move";
          };
          const slug = (ev.child || "default")
            .toString()
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "-");
          chip.className = `calendar-event child-${slug}`;

          const subjectColor = window.getSubjectColor
            ? window.getSubjectColor(ev.subject)
            : "#e5e7eb";
          const childColor = window.getChildColor
            ? window.getChildColor(ev.child)
            : "#9ca3af";

          chip.style.background = subjectColor || "#e5e7eb";
          chip.style.borderLeftColor = childColor || "#9ca3af";
          const timeLabel =
            ev.start_time ||
            ev.startTime ||
            "";

          // Use secure DOM creation
          const mainDiv = document.createElement("div");
          mainDiv.className = "calendar-event-main";

          const titleEl = document.createElement("small");
          titleEl.textContent = ev.title; // Secure: textContent escapes HTML
          mainDiv.appendChild(titleEl);

          if (timeLabel) {
            const timeSpan = document.createElement("span");
            timeSpan.className = "time";
            timeSpan.textContent = timeLabel;
            mainDiv.appendChild(timeSpan);
          }

          const dotSpan = document.createElement("span");
          dotSpan.className = "event-child-dot";
          dotSpan.style.background = childColor;

          chip.appendChild(mainDiv);
          chip.appendChild(dotSpan);

          chip.onclick = e => {
            e.stopPropagation();
            openLessonModal(ev);
          };

          container.appendChild(chip);
        });

        cell.appendChild(container);
      }

      cell.onclick = () => openEventModal(iso);
      calendar.appendChild(cell);
    }

    renderSidebar();
  }

  /* ---------------------------------------------------------
     Sidebar
  --------------------------------------------------------- */
  function renderSidebar() {
    eventList.innerHTML = "";

    const filtered = (eventsData || []).filter(e =>
      selectedChildFilter === "all" ||
      e.child_id === selectedChildIdFilter ||
      e.child === selectedChildFilter
    );

    if (!filtered.length) {
      eventList.innerHTML = "<li>No scheduled lessons.</li>";
      return;
    }

    filtered
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .forEach(ev => {
        const childColor = window.getChildColor
          ? window.getChildColor(ev.child)
          : "#9ca3af";

        const li = document.createElement("li");

        const dot = document.createElement("span");
        dot.className = "event-child-dot";
        dot.style.background = childColor;
        li.appendChild(dot);

        const bTag = document.createElement("b");
        bTag.textContent = new Date(ev.date).toLocaleDateString();
        li.appendChild(bTag);

        const textNode = document.createTextNode(
          ` — ${ev.title} (${ev.child}${ev.grade ? ` • ${ev.grade}` : ""})`
        );
        li.appendChild(textNode);

        eventList.appendChild(li);
      });
  }

  /* ---------------------------------------------------------
     Add Event Modal (manual events)
  --------------------------------------------------------- */
  function openEventModal(date) {
    eventModal.classList.remove("hidden");
    document.getElementById("eventDate").value = date;
    document.getElementById("eventGrade").value = "";
    const dur = document.getElementById("eventDuration");
    if (dur) dur.value = "60";
  }

  saveEventBtn.onclick = () => {
    const title = document.getElementById("eventTitle").value.trim();
    const date = document.getElementById("eventDate").value;
    const childId = document.getElementById("eventChild").value;
    const subject = document.getElementById("eventSubject").value;
    const grade = document.getElementById("eventGrade").value;
    const startTime = document.getElementById("eventStartTime").value;
    const endTime = document.getElementById("eventEndTime").value;
    const duration = document.getElementById("eventDuration")
      ? parseInt(document.getElementById("eventDuration").value, 10)
      : 60;
    const repeatMode = document.getElementById("eventRepeat").value;
    const repeatCount = parseInt(document.getElementById("eventRepeatCount").value, 10) || 1;

    if (!title || !date || !childId || !subject || !grade) {
      alert("All fields required");
      return;
    }

    const childRow = childrenData.find(c => c.id === childId);
    const childName = childRow ? childRow.name : "";

    // Helper to add days
    const addDays = (dStr, days) => {
      const d = new Date(dStr);
      d.setDate(d.getDate() + days);
      return d.toISOString().split("T")[0];
    };

    // Helper to add months
    const addMonths = (dStr, months) => {
      const d = new Date(dStr);
      d.setMonth(d.getMonth() + months);
      return d.toISOString().split("T")[0];
    };

    const eventsToCreate = [];
    let currentDateStr = date;

    // Default 1 event if repeat is 'none' (or count is 1)
    const totalEvents = repeatMode === "none" ? 1 : repeatCount;

    for (let i = 0; i < totalEvents; i++) {
      eventsToCreate.push({
        user_id: currentUser.id,
        title,
        date: currentDateStr,
        child: childName,
        child_id: childId,
        subject,
        grade,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: isNaN(duration) ? 60 : duration,
        resource_id: null
      });

      // Calculate next date
      if (repeatMode === "weekly") {
        currentDateStr = addDays(currentDateStr, 7);
      } else if (repeatMode === "biweekly") {
        currentDateStr = addDays(currentDateStr, 14);
      } else if (repeatMode === "monthly") {
        currentDateStr = addMonths(currentDateStr, 1);
      }
    }

    // Insert all events
    Promise.all(eventsToCreate.map(ev => supa.from("events").insert(ev)))
      .then(async (results) => {
        const error = results.find(r => r.error);
        if (error) {
          alert("Failed to save some events");
          console.error(error);
          return;
        }
        await loadDataFromSupabase();
        eventModal.classList.add("hidden");
        renderCalendar();
      });
  };

  // Toggle repeat inputs
  const repeatSelect = document.getElementById("eventRepeat");
  const repeatCountContainer = document.getElementById("repeatCountContainer");
  if (repeatSelect && repeatCountContainer) {
    repeatSelect.onchange = () => {
      if (repeatSelect.value === "none") {
        repeatCountContainer.classList.add("hidden");
      } else {
        repeatCountContainer.classList.remove("hidden");
      }
    };
  }

  closeEventModalBtn.onclick = () =>
    eventModal.classList.add("hidden");


  /* ---------------------------------------------------------
     Lesson viewer modal
  --------------------------------------------------------- */
  function openLessonModal(ev) {
    currentLessonEvent = ev;
    const res = resourcesData.find(r => r.id === ev.resource_id || r.id === ev.resourceId);

    lessonModal.classList.remove("hidden");
    document.getElementById("lessonTitle").textContent = ev.title;
    document.getElementById("lessonChild").textContent = ev.child;
    document.getElementById("lessonSubject").textContent = ev.subject;
    document.getElementById("lessonGrade").textContent = ev.grade || "Not specified";

    document.getElementById("lessonTime").textContent =
      ev.start_time && ev.end_time
        ? `${ev.start_time} – ${ev.end_time}`
        : "Not specified";

    const links = document.getElementById("lessonLinks");
    links.innerHTML = "";

    if (!res) {
      links.innerHTML = "<p>No lesson pack attached.</p>";
      return;
    }

    if (res.teaching_pack_url) {
      links.innerHTML += `
        <a class="lesson-link" href="${res.teaching_pack_url}" target="_blank">
          <span class="lesson-link-label">
            📘 Teaching pack
          </span>
          <span class="lesson-link-tag">${res.subject || "Teaching"}</span>
        </a>
      `;
    }

    if (res.exercise_pack_url) {
      links.innerHTML += `
        <a class="lesson-link" href="${res.exercise_pack_url}" target="_blank">
          <span class="lesson-link-label">
            ✏️ Exercise pack
          </span>
          <span class="lesson-link-tag">${res.subject || "Exercises"}</span>
        </a>
      `;
    }
  }

  closeLessonModal.onclick = () => {
    lessonModal.classList.add("hidden");
    currentLessonEvent = null;
  };

  deleteEventBtn.onclick = () => {
    if (!currentLessonEvent || !currentLessonEvent.id) {
      alert("Unable to delete this event.");
      return;
    }
    if (!confirm("Delete this event from the calendar?")) return;

    supa.from("events")
      .delete()
      .eq("id", currentLessonEvent.id)
      .then(async ({ error }) => {
        if (error) {
          console.error(error);
          alert("Failed to delete event.");
          return;
        }
        currentLessonEvent = null;
        lessonModal.classList.add("hidden");
        await loadDataFromSupabase();
        renderCalendar();
      });
  };

  if (kidPinCancel) {
    kidPinCancel.onclick = () => {
      kidPinModal.classList.add("hidden");
      if (kidPinInput) kidPinInput.value = "";
      kidPinModal.dataset.mode = "";
      const titleEl = kidPinModal.querySelector("h2");
      const noteEl = kidPinModal.querySelector(".dashboard-note");
      if (titleEl && noteEl) {
        titleEl.textContent = "Exit Kid View";
        noteEl.textContent = "Parent PIN is required to return to the full planner.";
      }
    };
  }

  // Helper to call backend verification
  async function verifyPinWithBackend(pin) {
    try {
      const sess = await supa.auth.getSession();
      const token = sess.data.session?.access_token;
      if (!token) return false;

      const res = await fetch("http://localhost:4000/api/auth/verify-pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ pin })
      });
      if (!res.ok) return false;
      const json = await res.json();
      return json.success === true;
    } catch (err) {
      console.error("Backend PIN verification failed", err);
      return false;
    }
  }

  if (kidPinConfirm) {
    kidPinConfirm.onclick = async () => {
      kidPinConfirm.disabled = true;
      const entered = kidPinInput ? kidPinInput.value.trim() : "";

      if (kidPinModal.dataset.mode === "unlock") {
        if (!entered) {
          alert("Enter the parent PIN to exit kid view.");
          kidPinConfirm.disabled = false;
          return;
        }

        const isValid = await verifyPinWithBackend(entered);

        if (!isValid) {
          kidPinAttempts += 1;
          if (kidPinAttempts >= 3) {
            alert("PIN incorrect. Ask a parent to enter the correct PIN.");
          } else {
            alert("Incorrect parent PIN.");
          }
          kidPinConfirm.disabled = false;
          return;
        }

        // Success
        kidPinAttempts = 0;
        kidPinModal.classList.add("hidden");
        kidViewMode = false;
        selectedChildFilter = "all";
        selectedChildIdFilter = null;
        renderChildFilter();
        applyKidViewVisuals();
        renderCalendar();
        updateKidViewButton();
      } else {
        // setup mode – set or clear PIN
        // For setup, we still use Supabase directly for now as we don't have a backend endpoint for setting it yet,
        // and RLS allows users to update their own profile.
        // However, we should be careful. Ideally all PIN ops go through backend.
        // For this task, we focus on the SECURITY of the verification (reading).
        // Writing is less of a read-vector risk, but for consistency let's leave the write as direct Supabase update
        // since the user is authenticated as themselves.

        if (entered && !/^\d{4,6}$/.test(entered)) {
          alert("Parent PIN must be 4–6 digits, or leave blank to clear it.");
          kidPinConfirm.disabled = false;
          return;
        }
        supa.from("profiles")
          .upsert({ id: currentUser.id, parent_pin: entered || null })
          .then(({ error }) => {
            if (error) {
              console.error(error);
              alert("Failed to save parent PIN.");
              return;
            }
            // parentPin = entered || ""; // local variable no longer tracked for security
            kidPinModal.classList.add("hidden");
            if (kidPinInput) kidPinInput.value = "";
          })
          .finally(() => {
            kidPinConfirm.disabled = false;
          });
      }
      kidPinConfirm.disabled = false;
    };
  }

  if (parentPinLink) {
    parentPinLink.onclick = async () => {
      // ensure we have user loaded
      if (!currentUser) {
        const { data: resUser } = await supa.auth.getUser();
        currentUser = resUser.user;
      }
      if (kidPinModal) {
        kidPinModal.classList.remove("hidden");
        kidPinModal.querySelector("h2").textContent = "Parent PIN";
        kidPinModal.querySelector(".dashboard-note").textContent =
          "Set or clear the parent PIN (4–6 digits). Leave blank to remove the PIN.";
        kidPinModal.dataset.mode = "setup";
        if (kidPinInput) kidPinInput.value = ""; // Don't prefill existing PIN for security!
      }
    };
  }


  /* ---------------------------------------------------------
     Calendar navigation
  --------------------------------------------------------- */
  prevBtn.onclick = () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  };

  nextBtn.onclick = () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  };

  addEventBtn.onclick = () =>
    openEventModal(new Date().toISOString().split("T")[0]);

  await loadDataFromSupabase();
  syncEventFormOptions();
  renderChildFilter();
  renderCalendar();
});

(() => {
  const CATEGORIES = ["Technology", "Music", "Sports", "Art", "Gaming", "Food", "Books", "Travel"];
  const VIEWS = ["discover", "communities", "events", "discussions", "profile"];

  const $ = (sel) => document.querySelector(sel);
  const shell = $("#shell");
  const sidebar = $("#sidebar");
  const grid = $("#grid");
  const myGrid = $("#my-grid");
  const chipsEl = $("#chips");
  const searchEl = $("#search");

  let user = null;
  let communities = [];
  let loaded = false;
  let activeCategory = "All";
  let query = "";

  /* ---------- Helper umum ---------- */
  function setError(input, message) {
    const field = input.closest(".field");
    const span = field.querySelector(".error span");
    if (message) {
      span.textContent = message;
      field.classList.add("has-error");
    } else {
      // teks sengaja tidak dihapus supaya animasi keluar tetap halus
      field.classList.remove("has-error");
    }
  }

  function pulse(el) {
    el.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.04)" }, { transform: "scale(1)" }],
      { duration: 400, easing: "ease-in-out" }
    );
  }

  function showSkeleton(container, count) {
    container.replaceChildren();
    for (let i = 0; i < count; i++) {
      const sk = document.createElement("div");
      sk.className = "card skeleton";
      container.append(sk);
    }
  }

  function showState(container, message, cta) {
    container.replaceChildren();
    const box = document.createElement("div");
    box.className = "state";
    box.textContent = message;
    if (cta) {
      box.append(document.createElement("br"));
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-primary";
      btn.textContent = cta.label;
      btn.addEventListener("click", cta.onClick);
      box.append(btn);
    }
    container.append(box);
  }

  function makeCard(c, index, animate) {
    const card = document.createElement("article");
    card.className = animate ? "card stagger" : "card";
    card.style.setProperty("--i", Math.min(index, 8));

    const cat = document.createElement("p");
    cat.className = "eyebrow";
    cat.textContent = c.category;

    const title = document.createElement("h3");
    title.textContent = c.name;

    card.append(cat, title);

    if (c.description) {
      const desc = document.createElement("p");
      desc.className = "desc";
      desc.textContent = c.description;
      card.append(desc);
    }
    return card;
  }

  /* ---------- Init + guard sesi ---------- */
  async function init() {
    let session = null;
    try {
      const { data } = await supabaseClient.auth.getSession();
      session = data.session;
    } catch (err) {
      console.error(err);
    }

    if (!session) {
      window.location.replace("login.html");
      return;
    }

    user = session.user;
    setupUser();
    $("#year").textContent = new Date().getFullYear();

    buildChips();
    buildCategorySelect();
    setView(viewFromHash(), false);
    shell.classList.add("is-ready");

    positionIndicator(false);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => positionIndicator(false));
    }
    new ResizeObserver(() => positionIndicator(false)).observe(chipsEl);

    loadCommunities();
  }

  function setupUser() {
    const meta = user.user_metadata || {};
    const fullName = (meta.full_name || "").trim();
    const first = fullName ? fullName.split(/\s+/)[0] : (user.email || "").split("@")[0];

    const hour = new Date().getHours();
    const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
    const letter = (fullName || user.email || "?").charAt(0).toUpperCase();

    $("#greeting").textContent = first ? `Good ${part}, ${first}.` : `Good ${part}.`;
    $("#avatar").textContent = letter;
    $("#p-avatar").textContent = letter;
    $("#p-name").value = fullName;
    $("#p-email").value = user.email || "";
  }

  /* ---------- Pindah view tanpa reload ---------- */
  let currentView = null;
  let visibleView = null;
  let swapTimer = null;

  function viewFromHash() {
    const h = window.location.hash.slice(1);
    return VIEWS.includes(h) ? h : "discover";
  }

  const viewEl = (key) => document.querySelector(`.view[data-view="${key}"]`);

  function updateNav(key, animate) {
    document.querySelectorAll(".side-link[data-view]").forEach((link) => {
      const on = link.dataset.view === key;
      link.classList.toggle("is-active", on);
      if (on) {
        link.setAttribute("aria-current", "page");
        // Di HP, geser tab aktif ke tengah
        const nav = link.parentElement;
        nav.scrollTo({
          left: link.offsetLeft - (nav.clientWidth - link.offsetWidth) / 2,
          behavior: animate ? "smooth" : "auto",
        });
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function setView(key, animate = true) {
    clearTimeout(swapTimer);
    const next = viewEl(key);
    currentView = key;
    updateNav(key, animate);
    document.title = `${next.dataset.title} | Nestly.`;

    // Balik ke view yang sedang keluar: batalkan saja
    if (next === visibleView) {
      next.classList.remove("is-leaving");
      return;
    }

    const reveal = () => {
      if (visibleView) {
        visibleView.hidden = true;
        visibleView.classList.remove("is-leaving");
      }
      next.hidden = false; // animasi stagger isinya otomatis mulai lagi
      visibleView = next;
      window.scrollTo(0, 0);
      if (key === "discover") positionIndicator(false);
      if (key === "communities") renderMine(true);
    };

    if (visibleView && animate) {
      // Exit 160ms: lebih singkat dari entrance
      visibleView.classList.add("is-leaving");
      swapTimer = setTimeout(reveal, 160);
    } else {
      reveal();
    }
  }

  window.addEventListener("hashchange", () => setView(viewFromHash()));

  // Garis tipis di bawah navbar saat di-scroll (HP)
  function onScroll() {
    sidebar.classList.toggle("is-scrolled", window.scrollY > 4);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  $("#logout").addEventListener("click", async () => {
    try {
      await supabaseClient.auth.signOut();
    } catch (err) {
      console.error(err);
    }
    navigate("login.html");
  });

  /* ---------- Chips + indikator geser ---------- */
  const indicator = document.createElement("span");
  indicator.className = "chip-indicator";
  chipsEl.append(indicator);

  function buildChips() {
    ["All", ...CATEGORIES].forEach((cat) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip" + (cat === activeCategory ? " is-active" : "");
      btn.textContent = cat;
      btn.dataset.cat = cat;
      btn.setAttribute("aria-pressed", String(cat === activeCategory));
      btn.addEventListener("click", () => setCategory(cat, btn));
      chipsEl.append(btn);
    });
  }

  function setCategory(cat, chip) {
    activeCategory = cat;
    chipsEl.querySelectorAll(".chip").forEach((c) => {
      const on = c.dataset.cat === cat;
      c.classList.toggle("is-active", on);
      c.setAttribute("aria-pressed", String(on));
    });
    positionIndicator(true);
    const target = chip || chipsEl.querySelector(".chip.is-active");
    if (target) target.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
    render(true);
  }

  function positionIndicator(animate) {
    const active = chipsEl.querySelector(".chip.is-active");
    if (!active || !active.offsetWidth) return; // view Discover sedang tersembunyi

    if (!animate) indicator.style.transition = "none";
    indicator.style.width = active.offsetWidth + "px";
    indicator.style.height = active.offsetHeight + "px";
    indicator.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
    if (!animate) {
      void indicator.offsetWidth; // paksa reflow
      indicator.style.transition = "";
    }
  }

  function buildCategorySelect() {
    const select = $("#c-category");
    CATEGORIES.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      select.append(opt);
    });
  }

  /* ---------- Data komunitas ---------- */
  async function loadCommunities() {
    showSkeleton(grid, 4);
    showSkeleton(myGrid, 2);

    const { data, error } = await supabaseClient
      .from("communities")
      .select("id, name, category, description, created_by, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      const msg = "Couldn't load communities. Make sure you ran schema.sql in your Supabase project.";
      showState(grid, msg);
      showState(myGrid, msg);
      return;
    }

    communities = data;
    loaded = true;
    render(true);
    renderMine(currentView === "communities");
  }

  function render(animate) {
    if (!loaded) return;
    const q = query.trim().toLowerCase();
    const list = communities.filter((c) => {
      const inCategory = activeCategory === "All" || c.category === activeCategory;
      const inSearch =
        !q || c.name.toLowerCase().includes(q) || (c.description || "").toLowerCase().includes(q);
      return inCategory && inSearch;
    });

    if (!list.length) {
      showState(
        grid,
        communities.length
          ? "No communities match your search."
          : "No communities yet. Be the first to add one."
      );
      return;
    }

    grid.replaceChildren(...list.map((c, i) => makeCard(c, i, animate)));
  }

  function renderMine(animate) {
    if (!loaded) return;
    const mine = communities.filter((c) => c.created_by === user.id);

    if (!mine.length) {
      showState(myGrid, "You haven't created any communities yet.", {
        label: "Discover communities",
        onClick: () => {
          window.location.hash = "discover";
        },
      });
      return;
    }

    myGrid.replaceChildren(...mine.map((c, i) => makeCard(c, i, animate)));
  }

  searchEl.addEventListener("input", () => {
    query = searchEl.value;
    render(false); // tanpa animasi supaya tidak berkedip saat mengetik
  });

  /* ---------- Modal Add Community ---------- */
  const modal = $("#modal");
  const panel = modal.querySelector(".modal-panel");
  const addBtn = $("#add-btn");
  const addForm = $("#add-form");
  const addSubmit = $("#add-submit");
  const addLabel = addSubmit.querySelector(".btn-label");
  const nameInput = $("#c-name");
  const catSelect = $("#c-category");
  const descInput = $("#c-desc");
  let lastTrigger = null;

  function openModal(trigger) {
    lastTrigger = trigger;

    // Titik asal animasi = tengah tombol pemicu
    const t = trigger.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    panel.style.setProperty("--ox", `${t.left + t.width / 2 - p.left}px`);
    panel.style.setProperty("--oy", `${t.top + t.height / 2 - p.top}px`);

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    setTimeout(() => nameInput.focus({ preventScroll: true }), 60);
  }

  function closeModal() {
    if (!modal.classList.contains("is-open")) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    if (lastTrigger) lastTrigger.focus({ preventScroll: true });

    setTimeout(() => {
      addForm.reset();
      setError(nameInput, null);
      setError(descInput, null);
    }, 220);
  }

  addBtn.addEventListener("click", () => openModal(addBtn));
  modal.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", closeModal));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  nameInput.addEventListener("input", () => {
    if (nameInput.value.trim().length >= 2) setError(nameInput, null);
  });
  descInput.addEventListener("input", () => {
    if (descInput.value.length <= 280) setError(descInput, null);
  });

  function resetAddButton() {
    addSubmit.classList.remove("is-success");
    addSubmit.disabled = false;
    addLabel.textContent = "Add Community";
  }

  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = nameInput.value.trim();
    const category = catSelect.value;
    const description = descInput.value.trim();

    let valid = true;
    if (name.length < 2) {
      setError(nameInput, "Give your community a name.");
      valid = false;
    }
    if (description.length > 280) {
      setError(descInput, "Keep the description under 280 characters.");
      valid = false;
    }
    if (!valid) {
      (name.length < 2 ? nameInput : descInput).focus();
      return;
    }

    addSubmit.disabled = true;
    addLabel.textContent = "Adding…";

    const { data, error } = await supabaseClient
      .from("communities")
      .insert({ name, category, description })
      .select("id, name, category, description, created_by, created_at")
      .single();

    if (error) {
      console.error(error);
      setError(nameInput, error.message);
      resetAddButton();
      return;
    }

    communities.unshift(data);
    addLabel.textContent = "Added";
    addSubmit.classList.add("is-success");
    pulse(addSubmit);

    setTimeout(() => {
      closeModal();
      // Pastikan komunitas baru terlihat
      query = "";
      searchEl.value = "";
      const allChip = chipsEl.querySelector('.chip[data-cat="All"]');
      setCategory("All", allChip);
      renderMine(false);
      setTimeout(resetAddButton, 250);
    }, 600);
  });

  /* ---------- Profile ---------- */
  const profileForm = $("#profile-form");
  const pName = $("#p-name");
  const saveBtn = $("#save-btn");
  const saveLabel = saveBtn.querySelector(".btn-label");
  const saveIdle = saveLabel.textContent;

  pName.addEventListener("input", () => {
    if (pName.value.trim().length >= 2) setError(pName, null);
  });

  function resetSaveButton() {
    saveBtn.classList.remove("is-success");
    saveBtn.disabled = false;
    saveLabel.textContent = saveIdle;
  }

  profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = pName.value.trim();
    if (name.length < 2) {
      setError(pName, "Please enter your name.");
      pName.focus();
      return;
    }

    saveBtn.disabled = true;
    saveLabel.textContent = "Saving…";

    const { data, error } = await supabaseClient.auth.updateUser({ data: { full_name: name } });

    if (error) {
      console.error(error);
      setError(pName, error.message);
      resetSaveButton();
      return;
    }

    user = data.user;
    setupUser(); // greeting dan avatar ikut berubah
    saveLabel.textContent = "Saved";
    saveBtn.classList.add("is-success");
    pulse(saveBtn);
    setTimeout(resetSaveButton, 1600);
  });

  init();
})();


    // =========================================================================
    // 1. MOCK STATE & PHASE 0 DATA REGISTRY
    // =========================================================================
    var APP_STATE = {
      currentScreen: "landing",
      dashboardFilter: "all",
      priceConfig: {
        version: 1,
        baseRateBdt: 25,
        smoothRateBdt: 11,
        cinematicEnabled: false,
        quoteTtlHours: 24
      },
      activeProject: {
        id: "proj_bd_fintech_01",
        title: "Q4 Bangladesh Fintech Expansion",
        languageMode: "bilingual",
        designFamily: "corporate_slate",
        slideCount: 8,
        motionTierRequested: "smooth",
        transitionId: "fade",
        intensity: "standard",
        overrideEntranceId: "fade",
        state: "design_approved",
        revisionsUsed: 0,
        revisionsMax: 2,
        freeMotionSwapUsed: false,
        entitlementTier: null
      },
      activeQuote: null,
      quoteHistory: [],
      auditLogs: [
        {
          timestamp: "2026-10-26 04:00:00 UTC",
          actor: "system.seed",
          action: "INIT_PRICE_CONFIG v1",
          detail: "base_rate_bdt=25, smooth_rate_bdt=11, cinematic_enabled=false"
        }
      ],
      selectedPhase0Slide: 2,
      qaChecklist: [
        { id: "qa1", label: "Open all 5 generated .pptx decks on Windows 11 PowerPoint (M365) without 'Requires Repair' modal", checked: false },
        { id: "qa2", label: "Open all 5 generated .pptx decks on macOS Sonoma PowerPoint (M365) without repair or layout shift", checked: false },
        { id: "qa3", label: "Verify Bengali conjuncts (প্রজেক্টের, ট্রানজিশন, যুক্তাক্ষর) on Slides 2, 4, 7 during Fade/Wipe/Zoom/Slide_In", checked: false },
        { id: "qa4", label: "Confirm Smooth entrances trigger automatically (afterPrevious) without presenter clicks on all 8 slides", checked: false },
        { id: "qa5", label: "Verify Slide 5 (>6 bullets) suppresses image/quote animations and Slide 6 caps entrances at 5", checked: false },
        { id: "qa6", label: "Record genuine 3-second 1080p 60fps desktop slide-show clips for fade, wipe, push, and zoom", checked: false }
      ]
    };

    var SCREENS = [
      { id: "phase0", num: "P0", label: "Phase 0 Spike Workbench" },
      { id: "landing", num: "01", label: "Public Landing & Pricing" },
      { id: "dashboard", num: "02", label: "Dashboard & Projects" },
      { id: "intake", num: "03", label: "New Presentation Intake" },
      { id: "preview", num: "04", label: "Static Preview Approval" },
      { id: "motion", num: "05", label: "Motion & Sample Clips" },
      { id: "comparison", num: "06", label: "Static vs Smooth Compare" },
      { id: "quote", num: "07", label: "Itemized Server Quote" },
      { id: "checkout", num: "08", label: "Checkout & Webhook Sim" },
      { id: "production", num: "09", label: "Worker & Validation Gate" },
      { id: "download", num: "10", label: "Download & Motion Swap" },
      { id: "account", num: "11", label: "Account & Order History" },
      { id: "admin", num: "12", label: "Admin Pricing & Audit" }
    ];

    var PROJECTS_SEED = [
      {
        id: "proj_bd_fintech_01",
        title: "Q4 Bangladesh Fintech Expansion",
        designFamily: "corporate_slate",
        slides: 8,
        tier: "smooth",
        state: "design_approved",
        totalBdt: 288
      },
      {
        id: "proj_dhaka_logistics_02",
        title: "Dhaka Cold-Chain Logistics Pitch (বাংলা ও English)",
        designFamily: "startup_pulse",
        slides: 15,
        tier: "smooth",
        state: "delivered",
        totalBdt: 540
      },
      {
        id: "proj_nbr_compliance_03",
        title: "Annual Board Handout & Print Brief",
        designFamily: "editorial_bengali",
        slides: 10,
        tier: "static",
        state: "delivered",
        totalBdt: 250
      }
    ];

    var TRANSITION_LIBRARY = [
      { id: "fade", name: "Fade (ফেড)", recommendedFor: ["corporate_slate", "editorial_bengali"], desc: "Smooth cross-dissolve between slides (<p:fade thruBlk='0'/>)." },
      { id: "push", name: "Push (পুশ)", recommendedFor: ["corporate_slate"], desc: "Directional slide push from right to left (<p:push dir='l'/>)." },
      { id: "wipe", name: "Wipe (ওয়াইপ)", recommendedFor: ["startup_pulse", "editorial_bengali"], desc: "Clean directional reveal across the slide (<p:wipe dir='l'/>)." },
      { id: "zoom", name: "Zoom (জুম)", recommendedFor: ["startup_pulse"], desc: "Subtle depth scale transition (<p:zoom dir='in'/> — high priority QA)." }
    ];

    var INTENSITY_LIBRARY = [
      { id: "subtle", name: "Subtle (0.8x)", durMs: 400, staggerMs: 80, desc: "Restrained, formal corporate motion." },
      { id: "standard", name: "Standard (1.0x)", durMs: 500, staggerMs: 150, desc: "Balanced default for most presentations." },
      { id: "dynamic", name: "Dynamic (1.2x)", durMs: 600, staggerMs: 220, desc: "Expressive timing for startup pitches." }
    ];

    var PHASE0_SLIDES = [
      { num: 1, lang: "bn-BD / en-US", title: "AI Presentation Platform / এআই প্রেজেন্টেশন প্ল্যাটফর্ম", roles: ["title", "quote"], bullets: 0, note: "Cover slide: 2 automatic Smooth entrances (title, quote)." },
      { num: 2, lang: "bn-BD", title: "প্রজেক্টের মূল লক্ষ্য ও সুবিধা (Executive Summary)", roles: ["title", "bullets", "image"], bullets: 4, note: "Bengali summary: title & image animate; 4 bullets stay static." },
      { num: 3, lang: "en-US", title: "Mock Per-Slide Pricing Model", roles: ["title", "chart", "bullets"], bullets: 3, note: "Pricing matrix: title animates; chart & bullets remain static in Smooth." },
      { num: 4, lang: "bn-BD", title: "মোশন টিয়ার এবং অ্যানিমেশন নীতিমালা", roles: ["title", "quote", "image"], bullets: 0, note: "Policy overview: title, quote, and image animate (3/5 cap)." },
      { num: 5, lang: "bn-BD / en-US", title: "High-Density Slide (>6 Bullets Policy Test)", roles: ["title", "bullets", "image", "quote"], bullets: 8, note: "8 bullets (>6 threshold): suppresses image & quote animations; ONLY title animates." },
      { num: 6, lang: "en-US", title: "5-Animation Cap Stress Test (7 Visual Shapes)", roles: ["title", "image", "image", "image", "image", "quote", "quote"], bullets: 0, note: "7 animatable roles present: strictly truncated at 5 animations." },
      { num: 7, lang: "bn-BD", title: "বাংলা যুক্তাক্ষর ও ফন্ট রেন্ডারিং পরীক্ষা", roles: ["title", "bullets", "quote"], bullets: 5, note: "Tests Bengali conjuncts (প্রজেক্ট, ট্রানজিশন, যুক্তাক্ষর) with Nirmala UI." },
      { num: 8, lang: "bn-BD / en-US", title: "Thank You / ধন্যবাদ — Ready for Desktop QA", roles: ["title", "closing"], bullets: 0, note: "Closing slide: title & closing roles animate automatically." }
    ];

    var PHASE0_EXPERIMENTS = [
      { id: "P0-01", file: "phase0_static_bilingual.pptx", tier: "static", trans: "none", entr: "none", intensity: "N/A", xmlPass: null, desktopStatus: "UNVERIFIED_EXTERNAL", clipStatus: "N/A (Static)" },
      { id: "P0-02", file: "phase0_smooth_fade_standard.pptx", tier: "smooth", trans: "fade", entr: "fade", intensity: "standard (1.0x)", xmlPass: null, desktopStatus: "UNVERIFIED_EXTERNAL", clipStatus: "PENDING_DESKTOP_CAPTURE" },
      { id: "P0-03", file: "phase0_smooth_wipe_subtle.pptx", tier: "smooth", trans: "wipe", entr: "fade, wipe", intensity: "subtle (0.8x)", xmlPass: null, desktopStatus: "UNVERIFIED_EXTERNAL", clipStatus: "PENDING_DESKTOP_CAPTURE" },
      { id: "P0-04", file: "phase0_smooth_push_dynamic.pptx", tier: "smooth", trans: "push", entr: "fade, slide_in", intensity: "dynamic (1.2x)", xmlPass: null, desktopStatus: "UNVERIFIED_EXTERNAL", clipStatus: "PENDING_DESKTOP_CAPTURE" },
      { id: "P0-05", file: "phase0_smooth_zoom_standard.pptx", tier: "smooth", trans: "zoom", entr: "fade, zoom", intensity: "standard (1.0x)", xmlPass: null, desktopStatus: "UNVERIFIED_EXTERNAL (High Priority)", clipStatus: "PENDING_DESKTOP_CAPTURE" }
    ];

    // =========================================================================
    // 2. NAVIGATION & UI INITIALIZATION
    // =========================================================================
    function renderSidebarNav() {
      var nav = document.getElementById("screenNavList");
      if (!nav) return;
      var html = [];
      for (var i = 0; i < SCREENS.length; i++) {
        var s = SCREENS[i];
        var active = APP_STATE.currentScreen === s.id;
        var btnCls = active
          ? "bg-blue-600 text-white shadow-sm"
          : "text-gray-400 hover:text-gray-100 hover:bg-[#14171f]";
        var badgeCls = active ? "bg-blue-700 text-white" : "bg-[#161922] text-gray-400";
        html.push(
          '<button type="button" onclick="navigateScreen(\'' + s.id + '\')" ' +
          'class="w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 flex-shrink-0 transition-colors ' + btnCls + '">' +
          '<span class="font-mono text-[10px] px-1.5 py-0.5 rounded ' + badgeCls + '">' + s.num + '</span>' +
          '<span class="truncate">' + s.label + '</span>' +
          '</button>'
        );
      }
      nav.innerHTML = html.join("");
    }

    function navigateScreen(screenId) {
      if (!SCREENS.some(function(s) { return s.id === screenId; })) screenId = "landing";
      APP_STATE.currentScreen = screenId;
      if (location.hash.slice(1) !== screenId) history.replaceState(null, "", "#" + screenId);
      var sections = document.querySelectorAll(".screen-section");
      for (var i = 0; i < sections.length; i++) {
        sections[i].classList.add("hidden");
      }
      var target = document.getElementById("screen-" + screenId);
      if (target) {
        target.classList.remove("hidden");
      }
      renderSidebarNav();
      syncAllViews();
      var heading = target && target.querySelector("h1,h2"); if (heading) { heading.tabIndex = -1; heading.focus({preventScroll:true}); }
      window.scrollTo({ top: 0, behavior: "auto" });
    }

    function showToast(msg) {
      var el = document.getElementById("toastBanner");
      if (!el) return;
      el.textContent = msg;
      el.classList.remove("hidden");
      clearTimeout(window.__toastTimer);
      window.__toastTimer = setTimeout(function () {
        el.classList.add("hidden");
      }, 3600);
    }

    // =========================================================================
    // 3. MOCK QUOTE ENGINE (Immutable Snapshots)
    // =========================================================================
    function computeLiveEstimate(slideCount, tier) {
      var b = APP_STATE.priceConfig.baseRateBdt;
      var s = tier === "smooth" ? APP_STATE.priceConfig.smoothRateBdt : 0;
      return slideCount * (b + s);
    }

    function generateImmutableServerQuote() {
      var p = APP_STATE.activeProject;
      var cfg = APP_STATE.priceConfig;
      var tier = p.motionTierRequested;
      var baseRate = cfg.baseRateBdt;
      var motionRate = tier === "smooth" ? cfg.smoothRateBdt : 0;
      var baseSubtotal = p.slideCount * baseRate;
      var motionSubtotal = p.slideCount * motionRate;
      var totalBdt = baseSubtotal + motionSubtotal;

      var now = new Date();
      var exp = new Date(now.getTime() + cfg.quoteTtlHours * 3600 * 1000);

      var snapshot = {
        quoteId: "qt_" + Math.random().toString(36).substring(2, 10),
        projectId: p.id,
        projectTitle: p.title,
        slideCount: p.slideCount,
        tier: tier,
        baseRateBdt: baseRate,
        motionRateBdt: motionRate,
        baseSubtotalBdt: baseSubtotal,
        motionSubtotalBdt: motionSubtotal,
        totalBdt: totalBdt,
        totalPaisa: totalBdt * 100,
        pricingVersion: cfg.version,
        status: "active",
        createdAt: now.toISOString(),
        expiresAt: exp.toISOString(),
        specJson: {
          motion_tier: tier,
          intensity: tier === "smooth" ? p.intensity : null,
          transition_id: tier === "smooth" ? p.transitionId : null,
          animation_policy: "1.0.0-phase0",
          design_family: p.designFamily,
          slide_count: p.slideCount
        }
      };

      APP_STATE.activeQuote = snapshot;
      APP_STATE.quoteHistory.unshift(snapshot);
      p.state = "quoted";
      return snapshot;
    }

    // =========================================================================
    // 4. SCREEN CONTROLLERS & INTERACTIONS
    // =========================================================================
    function updateLandingEstimator(slides) {
      var n = parseInt(slides, 10) || 20;
      document.getElementById("landingSlideVal").textContent = String(n);
      var spans = document.querySelectorAll(".landing-n");
      for (var i = 0; i < spans.length; i++) {
        spans[i].textContent = String(n);
      }
      var b = APP_STATE.priceConfig.baseRateBdt;
      var s = APP_STATE.priceConfig.smoothRateBdt;
      document.getElementById("landingStaticTotal").textContent = "BDT " + (n * b).toLocaleString();
      document.getElementById("landingSmoothTotal").textContent = "BDT " + (n * (b + s)).toLocaleString();
    }

    function setDashboardFilter(filter) {
      APP_STATE.dashboardFilter = filter;
      var btns = document.querySelectorAll(".dash-filter-btn");
      for (var i = 0; i < btns.length; i++) {
        var btn = btns[i];
        var active = btn.getAttribute("data-filter") === filter;
        btn.className = "dash-filter-btn px-3 py-1.5 rounded-lg text-xs font-medium " +
          (active ? "bg-blue-600 text-white" : "bg-[#161920] text-gray-300 hover:text-white");
      }
      renderDashboardProjects();
    }

    function renderDashboardProjects() {
      var searchEl = document.getElementById("dashboardSearchInput");
      var q = searchEl ? searchEl.value.toLowerCase() : "";
      var f = APP_STATE.dashboardFilter;

      var filtered = [];
      for (var i = 0; i < PROJECTS_SEED.length; i++) {
        var item = PROJECTS_SEED[i];
        var matchesFilter =
          (f === "shortlisted" && APP_STATE.shortlist.indexOf(item.id) !== -1) ||
          f === "all" ||
          (f === "smooth" && item.tier === "smooth") ||
          (f === "static" && item.tier === "static") ||
          (f === "delivered" && item.state === "delivered");
        var matchesQuery =
          !q ||
          item.title.toLowerCase().indexOf(q) !== -1 ||
          item.designFamily.toLowerCase().indexOf(q) !== -1;
        if (matchesFilter && matchesQuery) {
          filtered.push(item);
        }
      }

      var grid = document.getElementById("dashboardProjectGrid");
      if (!grid) return;
      if (!filtered.length) {
        grid.innerHTML = '<div class="col-span-full p-8 rounded-2xl htkis-panel text-center text-xs text-gray-400">No presentation projects match your current filter.</div>';
        return;
      }

      var cards = [];
      for (var j = 0; j < filtered.length; j++) {
        var p = filtered[j];
        var badgeStyle = p.tier === "smooth" ? "bg-blue-500/15 text-blue-300" : "bg-gray-800 text-gray-300";
        cards.push(
          '<div class="htkis-card rounded-2xl p-5 flex flex-col justify-between space-y-4">' +
            '<div class="space-y-2">' +
              '<div class="flex items-center justify-between">' +
                '<span class="text-[10px] font-mono uppercase px-2 py-0.5 rounded ' + badgeStyle + '">' + p.tier + '</span>' +
                '<span class="text-[11px] font-mono text-gray-400">state: ' + p.state + '</span>' +
              '</div>' +
              '<button type="button" class="text-xs text-blue-300" onclick="toggleShortlist(\'' + p.id + '\')">' + (APP_STATE.shortlist.indexOf(p.id) === -1 ? 'Save to shortlist' : 'Remove from shortlist') + '</button><h3 class="text-sm font-bold text-white">' + escapeHtml(p.title) + '</h3>' +
              '<div class="text-xs text-gray-400 font-mono">' + p.slides + ' slides • ' + p.designFamily + '</div>' +
            '</div>' +
            '<div class="pt-3 border-t border-[#222631] flex items-center justify-between">' +
              '<span class="font-mono text-xs font-semibold text-emerald-400">BDT ' + p.totalBdt + '</span>' +
              '<button type="button" onclick="openProject(\'' + p.id + '\')" class="px-3 py-1.5 rounded-lg bg-[#111317] hover:bg-blue-600 text-xs text-gray-200 hover:text-white border border-[#2a3040] transition-colors">' +
                'Open Project →' +
              '</button>' +
            '</div>' +
          '</div>'
        );
      }
      grid.innerHTML = cards.join("");
    }

    function setIntakeMotionTier(tier) {
      APP_STATE.activeProject.motionTierRequested = tier;
      updateIntakeMotionPreview();
    }

    function updateIntakeMotionPreview() {
      var inputEl = document.getElementById("intakeSlideCount");
      var slides = parseInt(inputEl ? inputEl.value : "8", 10) || 8;
      APP_STATE.activeProject.slideCount = slides;
      var tier = APP_STATE.activeProject.motionTierRequested;
      var est = computeLiveEstimate(slides, tier);
      var rate = tier === "smooth"
        ? APP_STATE.priceConfig.baseRateBdt + APP_STATE.priceConfig.smoothRateBdt
        : APP_STATE.priceConfig.baseRateBdt;
      var hintEl = document.getElementById("intakePriceHint");
      if (hintEl) {
        hintEl.textContent = "Estimated: BDT " + est + " (" + slides + " slides × BDT " + rate + ")";
      }
    }

    function handleIntakeSubmit(e) {
      e.preventDefault();
      var p = APP_STATE.activeProject;
      var title = document.getElementById("intakeTitle").value.trim();
      var count = Number(document.getElementById("intakeSlideCount").value);
      if (!title || title.length > 120 || !Number.isInteger(count) || count < 4 || count > 50) { showToast("Enter a title (1–120 characters) and 4–50 whole slides."); return; }
      if (APP_STATE.previewProjectsUsed >= 2) { showToast("Demo quota reached: two free preview projects. Reload to reset this session."); return; }
      APP_STATE.previewProjectsUsed++;
      document.getElementById("previewQuota").textContent = "Demo preview quota: " + (2 - APP_STATE.previewProjectsUsed) + " of 2 remaining";
      p.id = "demo_" + Date.now();
      p.title = title;
      p.languageMode = document.getElementById("intakeLanguage").value;
      p.revisionsUsed = 0;
      p.entitlementTier = null;
      APP_STATE.activeQuote = null;
      p.designFamily = document.getElementById("intakeDesignFamily").value;
      p.slideCount = parseInt(document.getElementById("intakeSlideCount").value, 10) || 8;
      p.state = "preview_ready";
      showToast("Fixed sample preview loaded. No AI generation occurred.");
      navigateScreen("preview");
    }

    function renderStaticPreviewGrid() {
      var grid = document.getElementById("staticPreviewGrid");
      if (!grid) return;
      var out = [];
      for (var i = 0; i < PHASE0_SLIDES.length; i++) {
        var s = PHASE0_SLIDES[i];
        var roleChips = [];
        for (var r = 0; r < s.roles.length; r++) {
          roleChips.push('<span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">role:' + s.roles[r] + '</span>');
        }
        out.push(
          '<button type="button" onclick="inspectSlide(' + s.num + ')" class="text-left htkis-card rounded-xl p-4 flex flex-col justify-between space-y-3">' +
            '<div class="space-y-2">' +
              '<div class="flex items-center justify-between text-[10px] font-mono text-gray-400">' +
                '<span>Slide 0' + s.num + '</span>' +
                '<span class="px-1.5 py-0.5 rounded bg-[#111317] border border-[#222631]">' + s.lang + '</span>' +
              '</div>' +
              '<div class="aspect-video rounded-lg bg-[#090a0c] border border-[#222631] p-3 flex flex-col justify-between">' +
                '<div class="text-xs font-bold text-gray-100 leading-snug">' + s.title + '</div>' +
                '<div class="flex flex-wrap gap-1">' + roleChips.join("") + '</div>' +
              '</div>' +
            '</div>' +
            '<p class="text-[11px] text-gray-400 leading-relaxed">' + s.note + '</p>' +
          '</button>'
        );
      }
      grid.innerHTML = out.join("");
    }

    function requestPreviewRevision() {
      var p = APP_STATE.activeProject;
      if (p.revisionsUsed >= p.revisionsMax) {
        showToast("Demo Quota Limit (FR-05): Maximum 2 free preview revision rounds reached.");
        return;
      }
      p.revisionsUsed += 1;
      syncAllViews();
      showToast("Demo sample revision #" + p.revisionsUsed + " regenerated.");
    }

    function approveStaticDesign() {
      var p = APP_STATE.activeProject;
      p.state = "design_approved";
      if (p.motionTierRequested === "static") {
        generateImmutableServerQuote();
        showToast("Static design approved. Skipping motion step and generating BDT 25/slide quote.");
        navigateScreen("quote");
      } else {
        showToast("Static design approved! Now configure your deck-wide transition and intensity.");
        navigateScreen("motion");
      }
    }

    function renderMotionControls() {
      var p = APP_STATE.activeProject;
      var isStatic = p.motionTierRequested === "static";
      var banner = document.getElementById("staticSkipBanner");
      if (banner) banner.classList.toggle("hidden", !isStatic);
      var famLabel = document.getElementById("motionFamilyLabel");
      if (famLabel) famLabel.textContent = p.designFamily;

      var tContainer = document.getElementById("transitionCardsContainer");
      if (tContainer) {
        var tCards = [];
        for (var i = 0; i < TRANSITION_LIBRARY.length; i++) {
          var t = TRANSITION_LIBRARY[i];
          var selected = p.transitionId === t.id && !isStatic;
          var rec = t.recommendedFor.indexOf(p.designFamily) !== -1;
          var cls = selected ? "bg-blue-600/15 border-blue-500" : "bg-[#161920] border-[#222631] hover:border-[#33394a]";
          tCards.push(
            '<button type="button" onclick="selectTransition(\'' + t.id + '\')" ' + (isStatic ? "disabled " : "") +
              'class="text-left p-4 rounded-xl border transition-all ' + cls + (isStatic ? " opacity-40 cursor-not-allowed" : "") + '">' +
              '<div class="flex items-center justify-between">' +
                '<span class="text-xs font-bold text-white">' + t.name + '</span>' +
                (rec ? '<span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">AI Recommended</span>' : '') +
              '</div>' +
              '<p class="text-[11px] text-gray-400 mt-1.5">' + t.desc + '</p>' +
            '</button>'
          );
        }
        tContainer.innerHTML = tCards.join("");
      }

      var iContainer = document.getElementById("intensityCardsContainer");
      if (iContainer) {
        var iCards = [];
        for (var j = 0; j < INTENSITY_LIBRARY.length; j++) {
          var item = INTENSITY_LIBRARY[j];
          var iSel = p.intensity === item.id && !isStatic;
          var iCls = iSel ? "bg-blue-600/15 border-blue-500" : "bg-[#161920] border-[#222631] hover:border-[#33394a]";
          iCards.push(
            '<button type="button" onclick="selectIntensity(\'' + item.id + '\')" ' + (isStatic ? "disabled " : "") +
              'class="text-left p-3.5 rounded-xl border transition-all ' + iCls + (isStatic ? " opacity-40 cursor-not-allowed" : "") + '">' +
              '<div class="text-xs font-bold text-white">' + item.name + '</div>' +
              '<div class="text-[10px] font-mono text-blue-300 mt-0.5">dur: ' + item.durMs + 'ms</div>' +
              '<p class="text-[11px] text-gray-400 mt-1">' + item.desc + '</p>' +
            '</button>'
          );
        }
        iContainer.innerHTML = iCards.join("");
      }
    }

    function selectTransition(id) {
      APP_STATE.activeProject.transitionId = id;
      var sel = document.getElementById("p0TransSelect");
      if (sel) sel.value = id;
      renderMotionControls();
      replaySampleStage();
      syncAllViews();
    }

    function selectIntensity(id) {
      APP_STATE.activeProject.intensity = id;
      renderMotionControls();
      replaySampleStage();
      syncAllViews();
    }

    function switchTierFromMotionScreen(tier) {
      APP_STATE.activeProject.motionTierRequested = tier;
      renderMotionControls();
      syncAllViews();
    }

    function replaySampleStage() {
      var p = APP_STATE.activeProject;
      var iObj = INTENSITY_LIBRARY[1];
      for (var i = 0; i < INTENSITY_LIBRARY.length; i++) {
        if (INTENSITY_LIBRARY[i].id === p.intensity) {
          iObj = INTENSITY_LIBRARY[i];
        }
      }
      var lbl = document.getElementById("stageClipLabel");
      if (lbl) {
        lbl.textContent = "Transition: " + p.transitionId + " • Intensity: " + p.intensity + " (" + iObj.durMs + "ms)";
      }
      var body = document.getElementById("stageSlideBody");
      if (body) {
        body.style.setProperty("--anim-dur", iObj.durMs + "ms");
        body.className = "my-auto space-y-2.5";
        void body.offsetWidth;
        body.classList.add("anim-" + p.transitionId);
      }
    }

    function selectTierFromComparison(tier) {
      APP_STATE.activeProject.motionTierRequested = tier;
      if (tier === "static") {
        generateImmutableServerQuote();
        navigateScreen("quote");
      } else {
        navigateScreen("motion");
      }
    }

    function saveMotionAndGenerateQuote() {
      APP_STATE.activeProject.state = "motion_configured";
      generateImmutableServerQuote();
      showToast("Motion settings saved & immutable mock quote generated.");
      navigateScreen("quote");
    }

    function simulateQuoteExpiry() {
      if (!APP_STATE.activeQuote) generateImmutableServerQuote();
      APP_STATE.activeQuote.status = "expired";
      APP_STATE.activeQuote.expiresAt = "2026-10-25 00:00:00 UTC (EXPIRED)";
      syncAllViews();
      showToast("Quote marked expired. Checkout will now block payment until re-quoted.");
    }

    function proceedToCheckout() {
      if (!APP_STATE.activeQuote) generateImmutableServerQuote();
      if (quoteIsExpired(APP_STATE.activeQuote)) {
        showToast("Blocked (FR-16): Expired quote cannot be paid. Generating fresh quote snapshot...");
        generateImmutableServerQuote();
        syncAllViews();
        return;
      }
      APP_STATE.activeProject.state = "payment_pending";
      navigateScreen("checkout");
    }

    // =========================================================================
    // 5. PAYMENT WEBHOOK & PRODUCTION WORKER SIMULATION
    // =========================================================================
    function appendWebhookLog(line, color) {
      var box = document.getElementById("webhookConsoleLog");
      if (!box) return;
      var div = document.createElement("div");
      div.className = color || "text-gray-300";
      div.textContent = "[" + new Date().toISOString().substring(11, 19) + "] " + line;
      box.appendChild(div);
      box.scrollTop = box.scrollHeight;
    }

    function simulateBrowserRedirectTamper() {
      appendWebhookLog("GET /checkout/success?paid=true&tier=cinematic received from browser.", "text-amber-300");
      appendWebhookLog("REJECTED (FR-17/18): Browser redirects never grant entitlement. Waiting for signed IPN webhook.", "text-rose-400");
      showToast("Security Check Passed: Unverified browser redirect rejected.");
    }

    function simulateClientPriceTamper() {
      appendWebhookLog("POST /checkout/session payload contained client_price=10 BDT.", "text-amber-300");
      var amt = APP_STATE.activeQuote ? APP_STATE.activeQuote.totalBdt : 288;
      appendWebhookLog("IGNORED (FR-13): Using stored mock quote snapshot (" + amt + " BDT).", "text-emerald-400");
      showToast("Security Check Passed: Client-supplied price ignored.");
    }

    function simulateVerifiedWebhookPayment() {
      if (!APP_STATE.activeQuote) generateImmutableServerQuote();
      var q = APP_STATE.activeQuote;
      if(quoteIsExpired(q) || !quoteMatchesProject(q)) { showToast("Blocked: quote expired or project changed. Create a fresh quote."); return; }
      appendWebhookLog("SIMULATED /webhooks/sslcommerz received (val_id=val_bd_99481, amount=" + q.totalBdt + " BDT).", "text-blue-300");
      appendWebhookLog("SIMULATION ONLY: no signature checked and no gateway API called.", "text-gray-300");
      appendWebhookLog("DEMO amount read from quote " + q.quoteId + " (" + q.totalPaisa + " paisa).", "text-emerald-400");
      appendWebhookLog("Demo entitlement: entitlements.motion_tier = '" + q.tier + "'.", "text-emerald-300 font-bold");

      q.status = "paid";
      APP_STATE.activeProject.entitlementTier = q.tier;
      APP_STATE.activeProject.state = "paid";
      document.getElementById("entitlementBadge").textContent = "entitlement: " + q.tier.toUpperCase();
      document.getElementById("btnStartProductionAfterPay").disabled = false;
      syncAllViews();
      showToast("Demo payment accepted. No real webhook or payment was processed.");
    }

    function startProductionJob() {
      if (!APP_STATE.activeProject.entitlementTier || APP_STATE.activeProject.entitlementTier !== APP_STATE.activeProject.motionTierRequested || !APP_STATE.activeQuote || APP_STATE.activeQuote.status !== "paid" || !quoteMatchesProject(APP_STATE.activeQuote)) {
        showToast("Blocked: matching paid demo quote and entitlement required.");
        return;
      }
      APP_STATE.activeProject.state = "producing";
      navigateScreen("production");
      runProductionPipelineSimulation();
    }

    function runProductionPipelineSimulation() {
      var failBox = document.getElementById("workerFailureBox");
      if (failBox) failBox.classList.add("hidden");
      var statusTxt = document.getElementById("jobCurrentStatusText");
      if (statusTxt) statusTxt.textContent = "status: simulated_complete";

      var p = APP_STATE.activeProject;
      var stages = [
        { title: "1. Entitlement & Locked Design Spec Verification", detail: "Verified entitlements.motion_tier === '" + p.motionTierRequested + "'", status: "SIMULATED" },
        { title: "2. Static Slide Geometry Generation (8 Bilingual Slides)", detail: "Rendered Bengali (Nirmala UI) & English text runs", status: "SIMULATED" },
        { title: "3. Controlled Open XML Template Patcher", detail: p.motionTierRequested === "smooth" ? "Injected <p:transition spd='med'><p:" + p.transitionId + "/> and <p:timing> fragments" : "Static tier: zero motion XML injected", status: "SIMULATED" },
        { title: "4. Automated OPC & Policy Validation Worker (FR-20)", detail: "Verified ZIP integrity, XML parseability, max 5 animations/slide, and >6 bullets suppression on Slide 5", status: "SIMULATED" }
      ];

      var stageHtml = [];
      for (var i = 0; i < stages.length; i++) {
        var s = stages[i];
        stageHtml.push(
          '<div class="p-3.5 rounded-xl bg-[#090a0c] border border-[#1d212b] flex items-center justify-between">' +
            '<div>' +
              '<div class="text-xs font-semibold text-white">' + s.title + '</div>' +
              '<div class="text-[11px] text-gray-400 font-mono mt-0.5">' + s.detail + '</div>' +
            '</div>' +
            '<span class="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">' + s.status + '</span>' +
          '</div>'
        );
      }
      var listEl = document.getElementById("workerStagesList");
      if (listEl) listEl.innerHTML = stageHtml.join("");

      var auditChoice = {
        generator_version: "0.1.0-opc-patcher",
        template_version: "2026.10.26-rev1",
        policy_version: "1.0.0-phase0",
        tier: p.motionTierRequested,
        deck_transition: p.motionTierRequested === "smooth" ? p.transitionId : null,
        intensity: p.motionTierRequested === "smooth" ? p.intensity : null,
        slide_5_bullet_suppression_applied: true,
        slide_6_cap_truncation_applied: true
      };
      var preEl = document.getElementById("jobAnimationChoicesPre");
      if (preEl) preEl.textContent = JSON.stringify(auditChoice, null, 2);
      p.state = "demo_delivery";
      syncAllViews();
    }

    function simulateWorkerFailure() {
      document.getElementById("jobCurrentStatusText").textContent = "status: quarantined (delivery blocked)";
      document.getElementById("workerFailureBox").classList.remove("hidden");
      showToast("Simulated XML validation failure: Download blocked & file quarantined.");
    }

    function fallbackToStaticDelivery() {
      APP_STATE.activeProject.motionTierRequested = "static";
      runProductionPipelineSimulation();
      showToast("Simulated Static fallback screen. No deck was produced.");
      navigateScreen("download");
    }

    function triggerFreeMotionSwap() {
      var p = APP_STATE.activeProject;
      if (p.freeMotionSwapUsed) {
        showToast("Policy FR-22: Your 1 included free motion swap has already been used.");
        return;
      }
      p.freeMotionSwapUsed = true;
      syncAllViews();
      showToast("Free motion swap activated! Choose your new transition and re-render for BDT 0.");
      navigateScreen("motion");
    }

    // =========================================================================
    // 6. ADMIN PRICING & PHASE 0 OPEN XML INSPECTOR
    // =========================================================================
    function handleAdminPriceUpdate(e) {
      e.preventDefault();
      var oldBase = APP_STATE.priceConfig.baseRateBdt;
      var oldSmooth = APP_STATE.priceConfig.smoothRateBdt;
      var newBase = Number(document.getElementById("adminBaseRateInput").value);
      var newSmooth = Number(document.getElementById("adminSmoothRateInput").value);
      if (!Number.isInteger(newBase) || newBase < 1 || !Number.isInteger(newSmooth) || newSmooth < 0 || newBase > 100000 || newSmooth > 100000) { showToast("Enter valid non-negative integer rates; base must be positive."); return; }

      APP_STATE.priceConfig.version += 1;
      APP_STATE.priceConfig.baseRateBdt = newBase;
      APP_STATE.priceConfig.smoothRateBdt = newSmooth;

      APP_STATE.auditLogs.unshift({
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC",
        actor: "lead.architect@dhaka-enterprise.bd",
        action: "UPDATE_PRICE_CONFIG v" + APP_STATE.priceConfig.version,
        detail: "base: " + oldBase + "->" + newBase + " BDT, smooth: " + oldSmooth + "->" + newSmooth + " BDT (Existing quotes unchanged)"
      });

      updateLandingEstimator(document.getElementById("landingSlideSlider").value);
      syncAllViews();
      showToast("Pricing updated to v" + APP_STATE.priceConfig.version + ". Existing quotes remain immutable!");
    }

    function updatePhase0InspectorConfig() {
      var tierSel = document.getElementById("p0TierSelect");
      var transSel = document.getElementById("p0TransSelect");
      var entrSel = document.getElementById("p0EntrSelect");
      if (tierSel) APP_STATE.activeProject.motionTierRequested = tierSel.value;
      if (transSel) APP_STATE.activeProject.transitionId = transSel.value;
      if (entrSel) APP_STATE.activeProject.overrideEntranceId = entrSel.value;
      syncAllViews();
    }

    function buildSampleSlideXmlString(slideNum) {
      var s = PHASE0_SLIDES[1];
      for (var i = 0; i < PHASE0_SLIDES.length; i++) {
        if (PHASE0_SLIDES[i].num === slideNum) {
          s = PHASE0_SLIDES[i];
          break;
        }
      }
      var p = APP_STATE.activeProject;
      var isSmooth = p.motionTierRequested === "smooth";
      var suppressed = s.bullets > 6;

      var animRoles = [];
      if (isSmooth) {
        for (var r = 0; r < s.roles.length; r++) {
          var roleName = s.roles[r];
          if (roleName === "title" || roleName === "image" || roleName === "quote" || roleName === "closing") {
            if (!suppressed || roleName === "title") {
              animRoles.push(roleName);
            }
          }
        }
      }
      var capped = animRoles.length > 5;
      animRoles = animRoles.slice(0, 5);

      var transAttr = p.transitionId === "fade" ? 'thruBlk="0"' : (p.transitionId === "zoom" ? 'dir="in"' : 'dir="l"');
      var transLines = isSmooth
        ? [
            '  <!-- Controlled Template Patch: Deck-Wide Transition (' + p.transitionId + ') -->',
            '  <p:transition spd="med" advClick="1">',
            '    <p:' + p.transitionId + ' ' + transAttr + '/>',
            '  </p:transition>'
          ]
        : [
            '  <!-- Static Tier: Zero <p:transition> injected -->'
          ];

      var filterMap = {
        fade: "fade",
        wipe: "wipe(right)",
        zoom: "box(out)",
        slide_in: "slide(fromBottom)"
      };
      var chosenEntrance = p.overrideEntranceId || "fade";
      var timingChildLines = [];

      for (var idx = 0; idx < animRoles.length; idx++) {
        var rName = animRoles[idx];
        var effId = rName === "title" ? "fade" : chosenEntrance;
        var filterVal = filterMap[effId] || "fade";
        var nodeType = idx === 0 ? "withEffect" : "afterEffect";
        timingChildLines.push(
          '          <p:par>',
          '            <p:cTn id="' + (idx + 10) + '" presetID="10" presetClass="entr" fill="hold" nodeType="' + nodeType + '" evtFilter="' + effId + '">',
          '              <p:childTnLst>',
          '                <p:animEffect transition="in" filter="' + filterVal + '">',
          '                  <p:cBhvr>',
          '                    <p:cTn id="' + (idx + 20) + '" dur="500"/>',
          '                    <p:tgtEl><p:spTgt spid="' + (idx + 2) + '" role="' + rName + '"/></p:tgtEl>',
          '                  </p:cBhvr>',
          '                </p:animEffect>',
          '              </p:childTnLst>',
          '            </p:cTn>',
          '          </p:par>'
        );
      }

      var timingLines = (isSmooth && animRoles.length > 0)
        ? [
            '  <!-- Controlled Template Patch: Role-Based Automatic Entrances (' + animRoles.length + '/5 cap' + (suppressed ? ', >6 bullets suppression active' : '') + (capped ? ', truncated from 7 to 5' : '') + ') -->',
            '  <p:timing>',
            '    <p:tnLst>',
            '      <p:par>',
            '        <p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot">',
            '          <p:childTnLst>',
            timingChildLines.join("\n"),
            '          </p:childTnLst>',
            '        </p:cTn>',
            '      </p:par>',
            '    </p:tnLst>',
            '  </p:timing>'
          ]
        : [
            '  <!-- Zero <p:timing> entrance nodes on this slide -->'
          ];

      var xmlLines = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
        '       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
        '       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">',
        '  <p:cSld>',
        '    <p:spTree>',
        '      <p:sp>',
        '        <p:nvSpPr><p:cNvPr id="2" name="Slide_Title" descr="role:title"/></p:nvSpPr>',
        '        <p:txBody>',
        '          <a:p><a:r><a:rPr lang="bn-BD" altLang="en-US" sz="2400" b="1"><a:latin typeface="Inter"/><a:cs typeface="Nirmala UI"/></a:rPr><a:t>' + s.title + '</a:t></a:r></a:p>',
        '        </p:txBody>',
        '      </p:sp>',
        '    </p:spTree>',
        '  </p:cSld>',
        '  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>',
        transLines.join("\n"),
        timingLines.join("\n"),
        '</p:sld>'
      ];
      return {
        xml: xmlLines.join("\n"),
        animCount: animRoles.length,
        suppressed: suppressed,
        capped: capped
      };
    }

    function selectPhase0Slide(num) {
      APP_STATE.selectedPhase0Slide = num;
      renderPhase0Lab();
    }

    function toggleQaCheck(id) {
      for (var i = 0; i < APP_STATE.qaChecklist.length; i++) {
        if (APP_STATE.qaChecklist[i].id === id) {
          APP_STATE.qaChecklist[i].checked = !APP_STATE.qaChecklist[i].checked;
        }
      }
      renderPhase0Lab();
    }

    function renderPhase0Lab() {
      var btnContainer = document.getElementById("phase0SlideButtons");
      if (btnContainer) {
        var btns = [];
        for (var i = 0; i < PHASE0_SLIDES.length; i++) {
          var s = PHASE0_SLIDES[i];
          var active = APP_STATE.selectedPhase0Slide === s.num;
          var cls = active
            ? "bg-blue-600/15 border-blue-500 text-white"
            : "bg-[#161920] border-[#222631] text-gray-300 hover:text-white";
          btns.push(
            '<button type="button" onclick="selectPhase0Slide(' + s.num + ')" ' +
              'class="w-full text-left px-3 py-2 rounded-xl text-xs border transition-colors ' + cls + '">' +
              '<div class="flex items-center justify-between font-mono text-[10px] text-gray-400">' +
                '<span>Slide 0' + s.num + ' (' + s.lang + ')</span>' +
                '<span>bullets: ' + s.bullets + '</span>' +
              '</div>' +
              '<div class="font-medium truncate mt-0.5">' + s.title + '</div>' +
            '</button>'
          );
        }
        btnContainer.innerHTML = btns.join("");
      }

      var currentSlide = PHASE0_SLIDES[1];
      for (var j = 0; j < PHASE0_SLIDES.length; j++) {
        if (PHASE0_SLIDES[j].num === APP_STATE.selectedPhase0Slide) {
          currentSlide = PHASE0_SLIDES[j];
          break;
        }
      }

      var patchResult = buildSampleSlideXmlString(currentSlide.num);
      document.getElementById("xmlLabSlideHeader").textContent = "Slide " + currentSlide.num + ": " + currentSlide.title;
      document.getElementById("xmlLabPolicySummary").textContent = currentSlide.note;
      document.getElementById("xmlLabCodeView").textContent = patchResult.xml;

      var pillBar = document.getElementById("xmlValidationPillBar");
      if (pillBar) {
        var p = APP_STATE.activeProject;
        pillBar.innerHTML =
          '<div class="p-2 rounded-lg bg-[#090a0c] border border-emerald-500/30 text-emerald-300">Illustrative XML — not validated</div>' +
          '<div class="p-2 rounded-lg bg-[#090a0c] border border-blue-500/30 text-blue-300">Entrances: ' + patchResult.animCount + ' / 5 max</div>' +
          '<div class="p-2 rounded-lg bg-[#090a0c] border border-[#222631] text-gray-300">Transition: ' + (p.motionTierRequested === "smooth" ? p.transitionId : "none") + '</div>' +
          '<div class="p-2 rounded-lg bg-[#090a0c] border border-amber-500/30 text-amber-300">Rule Guard: ' + (patchResult.suppressed ? ">6 Bullets Suppressed" : (patchResult.capped ? "5-Cap Truncated" : "Standard Role Policy")) + '</div>';
      }

      // Render Phase 0 Matrix Table
      var matrixBody = document.getElementById("phase0MatrixTableBody");
      if (matrixBody) {
        var rows = [];
        for (var k = 0; k < PHASE0_EXPERIMENTS.length; k++) {
          var ex = PHASE0_EXPERIMENTS[k];
          rows.push(
            '<tr>' +
              '<td class="py-2 pr-2 text-blue-300 font-semibold">' + ex.file + '</td>' +
              '<td class="py-2 px-2 text-gray-200">' + ex.trans + '</td>' +
              '<td class="py-2 px-2 text-gray-300">' + ex.entr + '</td>' +
              '<td class="py-2 px-2"><span class="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">NOT_RUN_IN_BROWSER</span></td>' +
              '<td class="py-2 px-2"><span class="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">' + ex.desktopStatus + '</span></td>' +
              '<td class="py-2 pl-2 text-gray-400">' + ex.clipStatus + '</td>' +
            '</tr>'
          );
        }
        matrixBody.innerHTML = rows.join("");
      }

      // Render Manual QA Checklist
      var qaBox = document.getElementById("qaChecklistContainer");
      if (qaBox) {
        var doneCount = 0;
        var qaHtml = [];
        for (var m = 0; m < APP_STATE.qaChecklist.length; m++) {
          var item = APP_STATE.qaChecklist[m];
          if (item.checked) doneCount++;
          qaHtml.push(
            '<label class="p-3 rounded-xl bg-[#090a0c] border border-[#1d212b] flex items-start gap-2.5 cursor-pointer hover:border-[#33394a]">' +
              '<input type="checkbox" ' + (item.checked ? "checked " : "") + 'onchange="toggleQaCheck(\'' + item.id + '\')" class="mt-0.5 accent-emerald-500" />' +
              '<span class="text-gray-300 leading-snug">' + item.label + '</span>' +
            '</label>'
          );
        }
        qaBox.innerHTML = qaHtml.join("");
        var counterEl = document.getElementById("qaChecklistCounter");
        if (counterEl) {
          counterEl.textContent = doneCount + " / " + APP_STATE.qaChecklist.length + " Manual checklist items checked — not external verification";
        }
      }
    }

    function runPhase0AllExperiments() {
      renderPhase0Lab();
      showToast("Recorded evidence: 6 specimens passed package/policy checks. This button does not run the Python engine. Desktop playback remains unverified.");
    }

    function downloadPhase0ValidationReport() {
      var report = window.PHASE0_EVIDENCE || {status:"EVIDENCE_NOT_LOADED"};
      var blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "phase0_validation_report.json";
      a.click();
      URL.revokeObjectURL(url);
      showToast("Downloaded phase0_validation_report.json");
    }

    function downloadCurrentSlideXml() {
      var res = buildSampleSlideXmlString(APP_STATE.selectedPhase0Slide);
      var blob = new Blob([res.xml], { type: "application/xml" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "slide" + APP_STATE.selectedPhase0Slide + "_patched.xml";
      a.click();
      URL.revokeObjectURL(url);
      showToast("Downloaded slide" + APP_STATE.selectedPhase0Slide + "_patched.xml");
    }

    function downloadSlideXmlBundle() {
      downloadCurrentSlideXml();
    }

    function openPwaInstallModal() {
      document.getElementById("pwaInstallModal").classList.remove("hidden");
    }

    function closePwaInstallModal() {
      document.getElementById("pwaInstallModal").classList.add("hidden");
    }

    // =========================================================================
    // 7. MASTER VIEW SYNCHRONIZATION
    // =========================================================================
    function syncAllViews() {
      var p = APP_STATE.activeProject;
      var cfg = APP_STATE.priceConfig;
      if (!APP_STATE.activeQuote) generateImmutableServerQuote();
      var q = APP_STATE.activeQuote;

      document.getElementById("headerRateBadge").textContent =
        "Static BDT " + cfg.baseRateBdt + "/slide • Smooth BDT " + (cfg.baseRateBdt + cfg.smoothRateBdt) + "/slide";
      document.getElementById("activeStatePill").textContent = "state: " + p.state;
      document.getElementById("sidebarTierBadge").textContent = p.motionTierRequested.toUpperCase();
      document.getElementById("sidebarProjectTitle").textContent = p.title;
      document.getElementById("sidebarSlideCount").textContent = p.slideCount + " slides";
      document.getElementById("sidebarQuoteTotal").textContent = "BDT " + computeLiveEstimate(p.slideCount,p.motionTierRequested) + " estimate";
      document.getElementById("sidebarTransition").textContent =
        p.motionTierRequested === "smooth" ? p.transitionId : "none";
      document.getElementById("sidebarIntensity").textContent =
        p.motionTierRequested === "smooth" ? p.intensity : "none";

      var revLeft = Math.max(0, p.revisionsMax - p.revisionsUsed);
      document.getElementById("revisionQuotaText").textContent = revLeft + " of " + p.revisionsMax + " free left";
      document.getElementById("accountRevisionStat").textContent = p.revisionsUsed + " / " + p.revisionsMax + " Used";

      var baseTxts = document.querySelectorAll(".rate-base-txt");
      for (var i = 0; i < baseTxts.length; i++) baseTxts[i].textContent = String(cfg.baseRateBdt);
      var smoothTxts = document.querySelectorAll(".rate-smooth-txt");
      for (var j = 0; j < smoothTxts.length; j++) smoothTxts[j].textContent = String(cfg.smoothRateBdt);
      var totalTxts = document.querySelectorAll(".rate-smooth-total-txt");
      for (var k = 0; k < totalTxts.length; k++) totalTxts[k].textContent = String(cfg.baseRateBdt + cfg.smoothRateBdt);

      document.getElementById("quoteIdDisplay").textContent = "Quote ID: " + q.quoteId + " (Pricing Config v" + q.pricingVersion + ")";
      document.getElementById("quoteProjectTitle").textContent = q.projectTitle + " (" + q.slideCount + " Slides)";
      document.getElementById("quoteExpiryDisplay").textContent = q.expiresAt;
      document.getElementById("quoteStatusBadge").textContent = "status: " + q.status;
      document.getElementById("quoteSlideCountA").textContent = String(q.slideCount);
      document.getElementById("quoteSlideCountB").textContent = String(q.slideCount);
      document.getElementById("quoteBaseRate").textContent = String(q.baseRateBdt);
      document.getElementById("quoteMotionRate").textContent = String(q.motionRateBdt);
      document.getElementById("quoteBaseSubtotal").textContent = "BDT " + q.baseSubtotalBdt;
      document.getElementById("quoteMotionSubtotal").textContent = "BDT " + q.motionSubtotalBdt;
      document.getElementById("quoteTierName").textContent = q.tier.toUpperCase();
      document.getElementById("quoteTotalDisplay").textContent = "BDT " + q.totalBdt;
      document.getElementById("quotePaisaDisplay").textContent = "Integer Minor Units: " + q.totalPaisa.toLocaleString() + " paisa";
      document.getElementById("quoteSpecJsonPre").textContent = JSON.stringify(q.specJson, null, 2);
      document.getElementById("checkoutAmountLabel").textContent = "BDT " + q.totalBdt;

      document.getElementById("downloadFilenameDisplay").textContent =
        p.motionTierRequested === "smooth"
          ? "phase0_smooth_" + p.transitionId + "_" + p.intensity + ".pptx"
          : "phase0_static_bilingual.pptx";
      document.getElementById("freeSwapBadge").textContent =
        p.freeMotionSwapUsed ? "0 Free Swaps Left" : "1 Free Swap Available";

      var tbody = document.getElementById("orderHistoryTableBody");
      if (tbody) {
        var rows = [];
        for (var m = 0; m < APP_STATE.quoteHistory.length; m++) {
          var item = APP_STATE.quoteHistory[m];
          rows.push(
            '<tr>' +
              '<td class="py-2.5 text-blue-300">' + item.quoteId + '</td>' +
              '<td class="py-2.5 text-gray-200">' + escapeHtml(item.projectTitle) + ' (' + item.slideCount + 's)</td>' +
              '<td class="py-2.5 uppercase">' + item.tier + '</td>' +
              '<td class="py-2.5 text-gray-400">BDT ' + item.baseRateBdt + ' + BDT ' + item.motionRateBdt + '/slide (v' + item.pricingVersion + ')</td>' +
              '<td class="py-2.5 text-emerald-400 font-semibold">BDT ' + item.totalBdt + '</td>' +
              '<td class="py-2.5"><span class="px-2 py-0.5 rounded bg-gray-800 text-gray-300">' + item.status + '</span></td>' +
            '</tr>'
          );
        }
        tbody.innerHTML = rows.join("");
      }

      var auditBox = document.getElementById("adminAuditLogContainer");
      if (auditBox) {
        var logs = [];
        for (var n = 0; n < APP_STATE.auditLogs.length; n++) {
          var log = APP_STATE.auditLogs[n];
          logs.push(
            '<div class="p-2.5 rounded-lg bg-[#090a0c] border border-[#1d212b]">' +
              '<div class="flex justify-between text-gray-400 text-[10px]">' +
                '<span>' + log.action + '</span>' +
                '<span>' + log.timestamp + '</span>' +
              '</div>' +
              '<div class="text-gray-200 mt-1">' + log.detail + '</div>' +
            '</div>'
          );
        }
        auditBox.innerHTML = logs.join("");
      }

      renderDashboardProjects();
      renderStaticPreviewGrid();
      renderMotionControls();
      renderPhase0Lab();
    }

    window.addEventListener("DOMContentLoaded", function () {
      generateImmutableServerQuote();
      renderSidebarNav();
      syncAllViews();
      navigateScreen(location.hash.slice(1) || "landing");
    });
  
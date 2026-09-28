(function () {
  var doc = document.documentElement;
  doc.classList.add("js");

  // --- Ouvert / fermé (heure de Propriano, Europe/Paris) ---
  var HOURS = window.__HOURS__ || [];
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var FR = { Sunday: "dimanche", Monday: "lundi", Tuesday: "mardi", Wednesday: "mercredi", Thursday: "jeudi", Friday: "vendredi", Saturday: "samedi" };

  function nowInParis() {
    try {
      var parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
      var o = {};
      parts.forEach(function (p) { o[p.type] = p.value; });
      return { day: o.weekday, minutes: parseInt(o.hour, 10) * 60 + parseInt(o.minute, 10) };
    } catch (e) { return null; }
  }
  function toMin(t) { var p = t.split(":"); return +p[0] * 60 + +p[1]; }
  function fmt(t) { var p = t.split(":"); return +p[0] + "h" + (p[1] === "00" ? "" : p[1]); }
  function byDay(d) { for (var i = 0; i < HOURS.length; i++) if (HOURS[i].schema === d) return HOURS[i]; return null; }

  var now = nowInParis();
  if (now && HOURS.length) {
    var today = byDay(now.day);
    var text, open = false;
    if (today && now.minutes >= toMin(today.open) && now.minutes < toMin(today.close)) {
      open = true;
      text = "Ouvert maintenant · jusqu’à " + fmt(today.close);
    } else if (today && now.minutes < toMin(today.open)) {
      text = "Fermé · ouvre aujourd’hui à " + fmt(today.open);
    } else {
      var idx = DAYS.indexOf(now.day);
      for (var k = 1; k <= 7; k++) {
        var d = DAYS[(idx + k) % 7], h = byDay(d);
        if (h) { text = "Fermé · ouvre " + (k === 1 ? "demain" : FR[d]) + " à " + fmt(h.open); break; }
      }
    }
    document.querySelectorAll("[data-status]").forEach(function (el) {
      el.textContent = text || "";
      el.classList.toggle("is-open", open);
    });
    var li = document.querySelector('.hours li[data-day="' + now.day + '"]');
    if (li) li.classList.add("is-today");
  }

  // --- Google Maps chargé au clic (rapidité + vie privée) ---
  var facade = document.querySelector("[data-map]");
  if (facade) {
    facade.addEventListener("click", function () {
      var f = document.createElement("iframe");
      f.src = facade.getAttribute("data-map");
      f.title = facade.getAttribute("data-title") || "Plan Google Maps";
      f.loading = "lazy";
      f.referrerPolicy = "no-referrer-when-downgrade";
      f.allowFullscreen = true;
      facade.replaceWith(f);
    });
  }

  // --- Bouton retour en haut ---
  var up = document.querySelector("[data-to-top]");
  if (up) {
    var ticking = false;
    var check = function () { up.classList.toggle("is-visible", window.scrollY > window.innerHeight * 0.9); ticking = false; };
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(check); } }, { passive: true });
    check();
    up.addEventListener("click", function (e) {
      e.preventDefault();
      var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      if (history.replaceState) history.replaceState(null, "", location.pathname + location.search);
      var brand = document.querySelector(".brand");
      if (brand) brand.focus({ preventScroll: true });
    });
  }

  // --- Apparition légère au scroll ---
  var els = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    els.forEach(function (el) { io.observe(el); });
  } else {
    els.forEach(function (el) { el.classList.add("is-in"); });
  }
})();

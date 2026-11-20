(() => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    api = "https://brezza-backend-production.up.railway.app";
  const parts = location.pathname.split("/").filter(Boolean),
    kind = parts[0];
  const id = parts[1] || new URLSearchParams(location.search).get("slug");
  const el = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  const number = (v, digits = 0) =>
    Number(v).toLocaleString(undefined, { maximumFractionDigits: digits });
  const direction = (v) =>
    ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(v / 45) % 8];
  let plan,
    conditions,
    map,
    marker,
    rows = [],
    cursors = [];
  const time = (v) =>
    new Intl.DateTimeFormat(undefined, {
      timeZone: plan.timezone,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(v));
  const date = (v) =>
    new Intl.DateTimeFormat(undefined, {
      timeZone: plan.timezone,
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(v));
  function decode(s) {
    let i = 0,
      lat = 0,
      lng = 0,
      result = [];
    while (i < s.length) {
      const part = () => {
        let value = 0,
          shift = 0,
          b;
        do {
          if (i >= s.length || shift > 30)
            throw Error("Invalid route geometry");
          b = s.charCodeAt(i++) - 63;
          if (b < 0 || b > 63) throw Error("Invalid route geometry");
          value |= (b & 31) << shift;
          shift += 5;
        } while (b >= 32);
        return value & 1 ? ~(value >> 1) : value >> 1;
      };
      lat += part();
      lng += part();
      result.push([lat / 1e5, lng / 1e5]);
    }
    return result;
  }
  function mapRoute(polyline) {
    if (!window.L) {
      $("map").textContent =
        "The map could not load. Forecast details are available below.";
      return;
    }
    map = L.map("map", { scrollWheelZoom: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
      crossOrigin: true,
    }).addTo(map);
    const coords = decode(polyline);
    if (coords.length < 2) throw Error("Route geometry is unavailable");
    const line = L.polyline(coords, { color: "#ef476f", weight: 5 }).addTo(map);
    map.fitBounds(line.getBounds(), { padding: [28, 28], maxZoom: 15 });
    new ResizeObserver(() => map.invalidateSize({ pan: false })).observe($("map"));
  }
  function cell(parent, label, value) {
    const c = el("div");
    c.append(el("small", label), el("strong", value));
    parent.append(c);
  }
  function select(i) {
    i = Math.max(0, Math.min(conditions.length - 1, i));
    const s = plan.segments[i],
      w = conditions[i];
    $("sample").value = i;
    $("sample-label").textContent =
      number(s.distance_km, 1) + " km · " + time(s.at);
    $("selected-point").replaceChildren(
      el("strong", time(s.at) + " · " + number(s.distance_km, 1) + " km"),
    );
    $("sample").setAttribute("aria-valuetext", date(s.at) + " · " + time(s.at) + " · " + number(s.distance_km, 1) + " km");
    const panel = $("point");
    panel.replaceChildren(
      el(
        "div",
        i === 0
          ? "START"
          : i === conditions.length - 1
            ? "FINISH"
            : "ON THE ROUTE",
        "eyebrow",
      ),
      el("h2", time(s.at)),
      el(
        "p",
        date(s.at) + " · " + number(s.distance_km, 1) + " km",
        "point-distance",
      ),
    );
    const grid = el("div", undefined, "point-grid");
    cell(grid, "Temperature", number(w.temperature_c, 1) + "°C");
    cell(grid, "Feels like", number(w.feels_like_c, 1) + "°C");
    cell(grid, "Rain chance", number(w.rain_chance_pct) + "%");
    cell(grid, "Rain / hour", number(w.rain_mm, 1) + " mm");
    cell(
      grid,
      "Wind from " + direction(w.wind_from_deg),
      number(w.wind_kph) + " km/h",
    );
    cell(grid, "Gusts", number(w.gust_kph) + " km/h");
    cell(grid, "Elevation", number(s.elevation_m) + " m");
    cell(grid, "Humidity", number(w.humidity_pct) + "%");
    cell(grid, "Cloud", number(w.cloud_pct) + "%");
    cell(grid, "Visibility", number(w.visibility_m / 1000, 1) + " km");
    cell(grid, "UV index", number(w.uv));
    if (w.snow_cm > 0) cell(grid, "Snow / hour", number(w.snow_cm, 1) + " cm");
    panel.append(grid);
    if (map) {
      const at = [s.latitude, s.longitude];
      if (marker) marker.setLatLng(at);
      else
        marker = L.marker(at, {
          icon: L.divIcon({
            className: "",
            html: '<div class="map-marker"><span></span></div>',
            iconSize: [28, 36],
            iconAnchor: [14, 36],
            tooltipAnchor: [0, -36],
          }),
          zIndexOffset: 1000,
          title: "Selected forecast point",
        }).addTo(map);
    }
    rows.forEach((row, j) => row.classList.toggle("selected", j === i));
    cursors.forEach((c) => {
      const x = c.x(new Date(s.at).getTime());
      c.line.setAttribute("x1", x);
      c.line.setAttribute("x2", x);
      c.readout.textContent = time(s.at) + " · " + c.describe(s, w);
    });
  }
  const ns = "http://www.w3.org/2000/svg";
  function svgNode(tag, attrs) {
    const n = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (tag === "text") {
      n.setAttribute("fill", "#a4b1b7");
      n.setAttribute("font-family", "system-ui, sans-serif");
      n.setAttribute("font-size", "14");
    }
    return n;
  }
  function chart(title, keys, unit, colors, labels, secondaryKey, target = "charts") {
    const card = el("section", undefined, "chart-card");
    card.append(el("h2", title));
    const legend = el("div", undefined, "chart-legend");
    labels.forEach((label, j) => {
      const item = el("span"), swatch = el("i");
      swatch.style.borderColor = colors[j];
      if (j && !secondaryKey) swatch.style.borderTopStyle = "dashed";
      item.append(swatch, document.createTextNode(label + (secondaryKey ? (j ? " · mm/h" : " · %") : "")));
      legend.append(item);
    });
    card.append(legend);
    const svg = svgNode("svg", {
      viewBox: "0 0 440 220",
      role: "img",
      "aria-label":
        title +
        " by arrival time; select a point with the slider or route table",
    });
    const values = keys.flatMap((k) =>
      k === "elevation_m"
        ? plan.segments.map((s) => s[k])
        : conditions.map((w) => w[k]),
    );
    let lo = Math.min(...values),
      hi = Math.max(...values);
    if (keys.includes("rain_chance_pct")) {
      lo = 0;
      hi = 100;
    } else {
      const pad = Math.max(1, (hi - lo) * 0.15);
      lo -= pad;
      hi += pad;
      if (["Wind & gusts", "Rainfall", "Snowfall"].includes(title)) lo = 0;
    }
    const start = new Date(plan.segments[0].at).getTime(),
      total = Math.max(1, new Date(plan.segments.at(-1).at).getTime() - start);
    const x = (v) => 48 + ((v - start) / total) * 332,
      y = (v) => 180 - ((v - lo) / (hi - lo)) * 155;
    for (let j = 0; j < 4; j++) {
      const v = lo + ((hi - lo) * j) / 3,
        yy = y(v);
      svg.append(
        svgNode("line", {
          x1: 48,
          x2: 380,
          y1: yy,
          y2: yy,
          stroke: "#ffffff18",
        }),
      );
      const t = svgNode("text", { x: 40, y: yy + 4, "text-anchor": "end" });
      t.textContent = number(v, ["°C", "mm/h", "cm/h"].includes(unit) ? 1 : 0);
      svg.append(t);
    }
    for (const d of [0, total / 2, total]) {
      const t = svgNode("text", {
        x: x(start + d),
        y: 211,
        "text-anchor": d === 0 ? "start" : d === total ? "end" : "middle",
      });
      t.textContent = time(start + d);
      svg.append(t);
    }
    const axisUnit = svgNode("text", { x: 48, y: 16 });
    axisUnit.textContent = unit;
    svg.append(axisUnit);
    if (secondaryKey) {
      const rightUnit = svgNode("text", { x: 380, y: 16, "text-anchor": "end" });
      rightUnit.textContent = "mm/h";
      svg.append(rightUnit);
    }
    const rainMax = secondaryKey
      ? Math.max(0.5, ...conditions.map((w) => w[secondaryKey])) * 1.1
      : 0;
    if (secondaryKey) {
      for (let j = 0; j < 4; j++) {
        const t = svgNode("text", { x: 387, y: 184 - j * 155 / 3 });
        t.textContent = number(rainMax * j / 3, 1);
        svg.append(t);
      }
    }
    [...keys, ...(secondaryKey ? [secondaryKey] : [])].forEach((k, j) => {
      if (k === secondaryKey) {
        const barWidth = Math.max(1, Math.min(12, 350 / plan.segments.length));
        plan.segments.forEach((segment, i) => {
          const height = conditions[i][k] / rainMax * 155;
          svg.append(svgNode("rect", {
            x: x(new Date(segment.at).getTime()) - barWidth / 2,
            y: 180 - height, width: barWidth, height,
            fill: colors[j], opacity: 0.65, rx: 1,
          }));
        });
        return;
      }
      const points = plan.segments
        .map(
          (s, i) =>
            x(new Date(s.at).getTime()) +
            "," +
            y(k === "elevation_m" ? s[k] : conditions[i][k]),
        )
        .join(" ");
      svg.append(
        svgNode("polyline", {
          points,
          fill: "none",
          stroke: colors[j],
          "stroke-width": 2.5,
          "stroke-linejoin": "round",
          ...(j ? { "stroke-dasharray": "5 4" } : {}),
        }),
      );
    });
    const cursor = svgNode("line", {
      x1: 48,
      x2: 48,
      y1: 25,
      y2: 180,
      class: "cursor",
      stroke: "#ff7492",
      "stroke-width": 1.5,
    });
    svg.append(cursor);
    const readout = el("p", undefined, "chart-selection");
    const describe = (segment, weather) => [...keys, ...(secondaryKey ? [secondaryKey] : [])]
      .map((key, j) => labels[j] + " " + number(key === "elevation_m" ? segment[key] : weather[key], 1) + " " + (key === secondaryKey ? "mm/h" : unit)).join(" · ");
    cursors.push({ line: cursor, x, readout, describe });
    svg.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const rect = svg.getBoundingClientRect(),
        d = Math.max(
          0,
          Math.min(
            total,
            ((((e.clientX - rect.left) / rect.width) * 440 - 48) / 332) * total,
          ),
        );
      let best = 0;
      plan.segments.forEach((s, i) => {
        if (
          Math.abs(new Date(s.at).getTime() - start - d) <
          Math.abs(new Date(plan.segments[best].at).getTime() - start - d)
        )
          best = i;
      });
      select(best);
    });
    card.append(svg, readout);
    $(target).append(card);
  }
  function journeyNotes() {
    const peak = (key) => conditions.reduce(
      (best, w, i) => w[key] > conditions[best][key] ? i : best, 0,
    );
    const cold = conditions.reduce(
      (best, w, i) => w.feels_like_c < conditions[best].feels_like_c ? i : best, 0,
    );
    const note = (title, value, text, i) => {
      const card = el("button", undefined, "journey-note");
      card.type = "button";
      card.append(el("small", title), el("strong", value), el("p", text));
      card.append(el("span", time(plan.segments[i].at) + " · " + number(plan.segments[i].distance_km, 1) + " km ↗"));
      card.addEventListener("click", () => {
        select(i);
        $("map").scrollIntoView({ behavior: "smooth", block: "center" });
      });
      $("extra-notes").append(card);
    };
    const gust = peak("gust_kph"), steadyWind = peak("wind_kph"), rain = peak("rain_chance_pct");
    const windKey = conditions[gust].gust_kph >= conditions[steadyWind].wind_kph ? "gust_kph" : "wind_kph";
    const wind = windKey === "gust_kph" ? gust : steadyWind;
    note(windKey === "gust_kph" ? "Peak gust" : "Strongest wind", number(conditions[wind][windKey]) + " km/h",
      conditions[wind][windKey] >= 25
        ? "Expect gusts here. Leave space between riders."
        : "Check the arrows for wind direction along the route.", wind);
    note("Highest rain chance", number(conditions[rain].rain_chance_pct) + "%",
      conditions[rain].rain_chance_pct >= 40 || conditions.some((w) => w.rain_mm >= 0.1)
        ? "Keep a rain layer within reach. Check rainfall below."
        : "Little rain is forecast. Check again before you leave.", rain);
    const hot = peak("feels_like_c");
    if (conditions[hot].feels_like_c >= 28 && conditions[cold].feels_like_c >= 12) {
      note("Hottest feels like", number(conditions[hot].feels_like_c, 1) + "°C",
        "Keep water within reach. Plan a shaded stop.", hot);
    } else {
      note("Coldest feels like", number(conditions[cold].feels_like_c, 1) + "°C",
        conditions[cold].feels_like_c < 12
          ? "Bring a layer for stops and descents."
          : "Use layers you can adjust as conditions change.", cold);
    }
    let highlight = wind;
    let headline = "Strongest wind: " + number(conditions[wind][windKey]) + " km/h";
    if (windKey === "gust_kph") headline = "Peak gusts: " + number(conditions[wind].gust_kph) + " km/h";
    if (conditions[wind][windKey] >= 45) {
      headline += ". Take care on exposed sections";
    } else if (conditions[rain].rain_chance_pct >= 40 || conditions.some(w => w.rain_mm >= 0.1)) {
      highlight = rain;
      headline = "Rain possible. Keep a rain layer within reach";
    } else if (conditions[hot].feels_like_c >= 28) {
      highlight = hot;
      headline = "Feels like " + number(conditions[hot].feels_like_c, 1) + "°C. Plan a water stop";
    } else if (conditions[cold].feels_like_c < 12) {
      highlight = cold;
      headline = "Feels like " + number(conditions[cold].feels_like_c, 1) + "°C. Bring a layer";
    }
    const jump = el("button", headline + " · " + time(plan.segments[highlight].at), "journey-note");
    jump.type = "button";
    jump.addEventListener("click", () => select(highlight));
    $("summary").append(jump);

  }
  function showForecast(data) {
    plan = data.plan;
    conditions = data.conditions;
    if (
      !plan ||
      !Array.isArray(conditions) ||
      conditions.length !== plan.segments?.length ||
      conditions.length < 2
    )
      throw Error("Forecast data is unavailable.");
    $("name").textContent = plan.name;
    document.title = plan.name + " · Brezza forecast";
    $("departure").textContent =
      date(plan.departure_at) +
      " · " +
      time(plan.departure_at) +
      " departure";
    const stopMinutes = (plan.stops || []).reduce((n, s) => n + s.minutes, 0);
    $("plan-meta").textContent =
      number(plan.segments.at(-1).distance_km, 1) +
      " km · " +
      (plan.mode === "pace"
        ? number(plan.value, 2) + " min/km"
        : number(plan.value, 1) + " km/h") +
      " · Finish " +
      date(plan.segments.at(-1).at) +
      " at " +
      time(plan.segments.at(-1).at) +
      (stopMinutes ? " · " + number(stopMinutes) + " min of stops" : "");
    $("update").textContent =
      (data.status === "past"
        ? "Forecast for a past departure. Not observed weather. "
        : data.status === "stale"
          ? "Weather update is delayed. "
          : "Weather updates before departure. ") +
      "Updated " +
      date(data.generated_at) +
      " at " +
      time(data.generated_at) +
      ".";
    journeyNotes();
    $("forecast").hidden = false;
    mapRoute(plan.polyline);
    $("sample").max = conditions.length - 1;
    $("sample").addEventListener("input", (e) =>
      select(Number(e.target.value)),
    );
    if (map)
      plan.segments.forEach((s, i) => {
        const w = conditions[i];
        if (w.wind_kph < 1) return;
        // Fixed scale across routes: larger arrows mean stronger sustained wind.
        const size = Math.round(14 + Math.min(w.wind_kph, 50) * 0.52);
        const arrow = L.divIcon({
          className: "wind-marker",
          html:
            '<svg viewBox="0 0 32 32" style="transform:rotate(' +
            ((w.wind_from_deg + 180) % 360) +
            'deg)" aria-hidden="true"><path fill="none" stroke="#193c2f" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" d="M16 29V4M5 15L16 4l11 11"/></svg>',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
        L.marker([s.latitude, s.longitude], {
          icon: arrow,
          title:
            "Wind from " +
            direction(w.wind_from_deg) +
            " · " +
            number(w.wind_kph) +
            " km/h",
        })
          .addTo(map)
          .bindTooltip(
            "Wind from " +
              direction(w.wind_from_deg) +
              " · " +
              number(w.wind_kph) +
              " km/h",
          )
          .on("click", () => select(i));
      });
    chart(
      "Wind & gusts",
      ["wind_kph", "gust_kph"],
      "km/h",
      ["#00c4ce", "#9ed6ff"],
      ["Wind", "Gusts"],
    );
    chart(
      "Temperature",
      ["temperature_c", "feels_like_c"],
      "°C",
      ["#ff797c", "#00c4ce"],
      ["Temperature", "Feels like"],
    );
    chart(
      "Rain",
      ["rain_chance_pct"],
      "%",
      ["#00c4ce", "#429bf5"],
      ["Chance", "Rainfall"],
      "rain_mm",
    );
    if (conditions.some((w) => w.snow_cm > 0))
      chart(
        "Snowfall",
        ["snow_cm"],
        "cm/h",
        ["#e0eaff"],
        ["Snowfall"],
        undefined,
        "extra-charts",
      );
    chart(
      "Elevation",
      ["elevation_m"],
      "m",
      ["#9ed2b1"],
      ["Elevation"],
      undefined,
      "extra-charts",
    );
    plan.segments.forEach((s, i) => {
      const w = conditions[i],
        tr = el("tr"),
        td = el("td"),
        b = el("button", date(s.at) + " · " + time(s.at));
      b.type = "button";
      b.setAttribute(
        "aria-label",
        "Select " +
          date(s.at) +
          " " +
          time(s.at) +
          " at " +
          number(s.distance_km, 1) +
          " km",
      );
      b.addEventListener("click", () => select(i));
      td.append(b);
      tr.append(td);
      [
        number(s.distance_km, 1) + " km",
        number(w.temperature_c, 1) + "°C",
        number(w.rain_chance_pct) + "%",
        number(w.wind_kph) + " / " + number(w.gust_kph) + " km/h",
        direction(w.wind_from_deg),
      ].forEach((v) => tr.append(el("td", v)));
      rows.push(tr);
      $("samples").append(tr);
    });
    select(0);
    $("save-image").addEventListener("click", saveImage);
    $("share-link")?.addEventListener("click", async () => {
      const button = $("share-link"), url = location.origin + "/f/" + id;
      try {
        if (navigator.share) await navigator.share({ title: document.title, url });
        else {
          await navigator.clipboard.writeText(url);
          button.textContent = "Link copied";
        }
      } catch (error) {
        if (error.name !== "AbortError") button.textContent = "Copy the link from your address bar";
      }
    });
  }
  async function saveImage() {
    const button = $("save-image"), status = $("export-message");
    button.disabled = true;
    button.textContent = "Saving…";
    status.hidden = true;
    try {
      if (!window.html2canvas) throw Error("Image export could not load. Reload the page and try again.");
      if (!map) throw Error("Wait for the map to load before saving the image.");
      await document.fonts.ready;
      const tiles = [...$("map").querySelectorAll(".leaflet-tile")];
      if (!tiles.length) throw Error("Wait for the map to load before saving the image.");
      await Promise.all(tiles.map(tile => tile.decode()));
      const mapRect = $("map").getBoundingClientRect();
      const mapLayers = [".leaflet-tile", ".leaflet-overlay-pane > svg", ".leaflet-marker-icon"].map(selector => ({
        selector,
        bounds: [...$("map").querySelectorAll(selector)].map(node => {
          const rect = node.getBoundingClientRect();
          return { left: rect.left - mapRect.left, top: rect.top - mapRect.top, width: rect.width, height: rect.height };
        }),
      }));
      const canvas = await html2canvas($("report"), {
        backgroundColor: "#10181d", scale: 2, useCORS: true,
        logging: false, imageTimeout: 15000,
        ignoreElements: node => node.classList.contains("leaflet-control-zoom") || node.classList.contains("leaflet-tooltip-pane"),
        onclone: doc => {
          // Flatten Leaflet's translated panes only in the exported copy.
          // The live map and its zoom/selection remain untouched.
          const clonedMap = doc.getElementById("map");
          clonedMap.style.width = mapRect.width + "px";
          clonedMap.style.height = mapRect.height + "px";
          clonedMap.style.flex = "none";
          clonedMap.querySelectorAll(".leaflet-pane, .leaflet-tile-container").forEach(node => {
            node.style.transform = "none";
            node.style.left = "0";
            node.style.top = "0";
          });
          mapLayers.forEach(({ selector, bounds }) => {
            clonedMap.querySelectorAll(selector).forEach((node, i) => {
              const rect = bounds[i];
              Object.assign(node.style, {
                transform: "none", position: "absolute", margin: "0",
                left: rect.left + "px", top: rect.top + "px",
                width: rect.width + "px", height: rect.height + "px",
              });
            });
          });
          // SVG images must carry their own text styles during raster export.
          doc.querySelectorAll(".chart-card svg text").forEach(node => {
            node.style.fill = "#a4b1b7";
            node.style.fontFamily = "system-ui, sans-serif";
            node.style.fontSize = window.innerWidth <= 700 ? "16px" : "14px";
          });
        },
      });
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw Error("The image could not be saved. Please try again.");
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url;
      link.download = (plan.name.replace(/[^a-z0-9-]+/gi, "-").slice(0, 80) || "route") + "-brezza-forecast.png";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      status.textContent = error.message || "The image could not be saved. Please try again.";
      status.hidden = false;
    } finally {
      button.disabled = false;
      button.textContent = "Save image";
    }
  }
  function showRoute(data) {
    const r = data.route;
    if (!r?.polyline) throw Error("This route is unavailable.");
    $("page-kind").textContent = "Shared route";
    $("name").textContent = r.name;
    document.title = r.name + " · Brezza";
    $("departure").textContent =
      number(r.distance_m / 1000, 1) +
      " km · " +
      number(r.elevation_gain_m) +
      " m climbing";
    $("plan-meta").textContent = "A route shared from Brezza.";
    [
      "summary",
      "point",
      "selected-point",
      "more-details",
      "report-actions",
      "map-legend",
      "sample-control",
      "table-section",
      "weather-attribution",
      "share-link",
    ].forEach((id) => {
      const node = $(id);
      if (node) node.hidden = true;
    });
    $("forecast").classList.add("route-only");
    $("forecast").hidden = false;
    mapRoute(r.polyline);
  }
  async function load() {
    try {
      if (!["f", "r"].includes(kind) || !id || !/^[0-9a-f-]{36}$/i.test(id))
        throw Error(
          "This link is incomplete. Ask the sender for the full route link.",
        );
      const controller = new AbortController(),
        timer = setTimeout(() => controller.abort(), 45000);
      let response;
      try {
        response = await fetch(
          api + "/" + kind + "/" + encodeURIComponent(id),
          { signal: controller.signal, cache: "no-store" },
        );
      } finally {
        clearTimeout(timer);
      }
      if (!response.ok)
        throw Error(
          response.status === 404 || response.status === 410
            ? "This link is no longer available. Ask the sender for a new link."
            : "The forecast could not load. Please try again shortly.",
        );
      const data = await response.json();
      kind === "f" ? showForecast(data) : showRoute(data);
      $("message").hidden = true;
    } catch (error) {
      $("forecast").hidden = true;
      $("message").textContent =
        error.name === "AbortError"
          ? "The forecast took too long to load. Please reload this page."
          : error.message;
    }
  }
  load();
})();

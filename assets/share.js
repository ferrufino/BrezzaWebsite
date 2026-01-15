(() => {
  const card = document.getElementById("share-card");
  if (!card) return;

  const routeName = document.getElementById("route-name");
  const routeOwner = document.getElementById("route-owner");
  const routeDistance = document.getElementById("route-distance");
  const routeElevation = document.getElementById("route-elevation");
  const routeSport = document.getElementById("route-sport");
  const routeMeta = document.getElementById("share-meta");
  const routeSvg = document.getElementById("route-svg");
  const routeMapEmpty = document.getElementById("route-map-empty");
  const copyLink = document.getElementById("copy-link");
  const errorBox = document.getElementById("share-error");
  const errorBody = document.getElementById("share-error-body");

  const slug = resolveSlug();
  if (!slug) {
    setError("Missing share link.");
    return;
  }

  const shareUrl = `https://brezza.cc/r/${encodeURIComponent(slug)}`;
  if (copyLink) {
    copyLink.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(shareUrl);
        routeMeta.textContent = "Link copied to clipboard.";
      } catch {
        routeMeta.textContent = "Unable to copy. You can still share the link.";
      }
    });
  }

  loadShare(slug);

  function resolveSlug() {
    const path = window.location.pathname.replace(/\/+$/, "");
    const parts = path.split("/").filter(Boolean);
    if (parts[0] === "r" && parts[1]) {
      return parts[1];
    }
    const params = new URLSearchParams(window.location.search);
    return params.get("slug");
  }

  async function loadShare(routeSlug) {
    const apiBase = "https://brezza-backend-production.up.railway.app";
    const url = `${apiBase}/r/${encodeURIComponent(routeSlug)}`;

    try {
      const response = await fetch(url, { method: "GET" });
      const bodyText = await response.text();
      if (!response.ok) {
        let message = "This link is unavailable.";
        try {
          const data = JSON.parse(bodyText);
          message = data.detail || message;
        } catch {
          // noop
        }
        setError(message);
        return;
      }

      const data = JSON.parse(bodyText);
      renderRoute(data);
      card.dataset.state = "ready";
    } catch (error) {
      setError(error?.message || "Unable to load this route.");
    }
  }

  function renderRoute(data) {
    const route = data.route || {};
    const ownerName = data.owner_name || "Anonymous rider";

    routeName.textContent = route.name || "Shared route";
    routeOwner.textContent = `Shared by ${ownerName}`;
    routeDistance.textContent = formatDistance(route.distance_m);
    routeElevation.textContent = formatElevation(route.elevation_gain_m);
    routeSport.textContent = formatSport(route.sport_type);
    routeMeta.textContent = "Copy the link to share this route.";

    if (route.polyline) {
      const coords = decodePolyline(route.polyline);
      if (coords.length > 1) {
        drawPolyline(coords);
        routeMapEmpty.style.display = "none";
      } else {
        routeMapEmpty.textContent = "Route preview unavailable.";
      }
    } else {
      routeMapEmpty.textContent = "Route preview unavailable.";
    }
  }

  function setError(message) {
    card.dataset.state = "error";
    if (errorBody) errorBody.textContent = message;
    if (errorBox) errorBox.style.display = "block";
  }

  function formatDistance(distanceM) {
    if (!distanceM || distanceM <= 0) return "—";
    const km = distanceM / 1000;
    return `${km.toFixed(1)} km`;
  }

  function formatElevation(elevationM) {
    if (!elevationM || elevationM <= 0) return "—";
    return `${Math.round(elevationM)} m`;
  }

  function formatSport(sportType) {
    const map = {
      "figure.outdoor.cycle": "Cycling",
      "figure.run": "Run",
      "figure.hiking": "Hike",
      "figure.walk": "Walk",
      "figure.swim": "Swim",
      "figure.skiing.downhill": "Ski",
      "figure.snowboarding": "Snowboard",
      "figure.snowshoeing": "Snowshoe",
      "figure.dance": "Dance"
    };
    return map[sportType] || "Route";
  }

  function drawPolyline(coords) {
    const width = 600;
    const height = 360;
    const pad = 18;

    const lats = coords.map((c) => c[0]);
    const lngs = coords.map((c) => c[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latSpan = maxLat - minLat || 1e-6;
    const lngSpan = maxLng - minLng || 1e-6;
    const scale = Math.min((width - pad * 2) / lngSpan, (height - pad * 2) / latSpan);

    const points = coords.map(([lat, lng]) => {
      const x = pad + (lng - minLng) * scale;
      const y = height - (pad + (lat - minLat) * scale);
      return [x, y];
    });

    const path = points
      .map((point, index) => `${index === 0 ? "M" : "L"}${point[0].toFixed(2)} ${point[1].toFixed(2)}`)
      .join(" ");

    routeSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    routeSvg.innerHTML = `
      <path d="${path}" fill="none" stroke="rgba(255,255,255,0.95)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${points[0][0].toFixed(2)}" cy="${points[0][1].toFixed(2)}" r="4" fill="#8be9ff"/>
      <circle cx="${points[points.length - 1][0].toFixed(2)}" cy="${points[points.length - 1][1].toFixed(2)}" r="4" fill="#ffd27c"/>
    `;
  }

  function decodePolyline(str) {
    let index = 0;
    const coordinates = [];
    let lat = 0;
    let lng = 0;

    while (index < str.length) {
      let shift = 0;
      let result = 0;
      let byte = null;

      do {
        byte = str.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const deltaLat = (result & 1) ? ~(result >> 1) : result >> 1;
      lat += deltaLat;

      shift = 0;
      result = 0;
      do {
        byte = str.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const deltaLng = (result & 1) ? ~(result >> 1) : result >> 1;
      lng += deltaLng;

      coordinates.push([lat / 1e5, lng / 1e5]);
    }

    return coordinates;
  }
})();

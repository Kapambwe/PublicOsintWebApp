const mapRegistry = new Map();

const LEAFLET_JS = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js";
const LEAFLET_CSS = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css";
const MARKER_CLUSTER_JS = "https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js";
const MARKER_CLUSTER_CSS = "https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/MarkerCluster.css";
const MARKER_CLUSTER_DEFAULT_CSS = "https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css";
const HTML_TO_IMAGE_JS = "https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/dist/html-to-image.js";

const JURISDICTION_CENTROIDS = {
    "zambia": [-13.1339, 27.8493],
    "south africa": [-30.5595, 22.9375],
    "kenya": [0.0236, 37.9062],
    "nigeria": [9.0820, 8.6753],
    "ghana": [7.9465, -1.0232],
    "zimbabwe": [-19.0154, 29.1549],
    "malawi": [-13.2543, 34.3015],
    "botswana": [-22.3285, 24.6849],
    "tanzania": [-6.3690, 34.8888],
    "uganda": [1.3733, 32.2903],
    "rwanda": [-1.9403, 29.8739],
    "ethiopia": [9.1450, 40.4897],
    "egypt": [26.8206, 30.8025],
    "angola": [-11.2027, 17.8739],
    "mozambique": [-18.6657, 35.5295],
    "namibia": [-22.9576, 18.4904],
    "senegal": [14.4974, -14.4524],
    "ivory coast": [7.5400, -5.5471],
    "dr congo": [-4.0383, 21.7587],
    "cameroon": [7.3697, 12.3547],
    "regional / sadc": [-19.0154, 29.1549],
    "regional sadc": [-19.0154, 29.1549],
    "regional": [-19.0154, 29.1549],
    "africa": [1.6508, 10.2679]
};

let leafletLoadPromise = null;
let htmlToImageLoadPromise = null;

function normalizeText(value) {
    return String(value ?? "").trim();
}

function normalizeKey(value) {
    return normalizeText(value).toLowerCase().replaceAll(/\s+/g, " ");
}

function loadStylesheet(href) {
    if (document.querySelector(`link[href="${href}"]`)) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        link.onload = () => resolve();
        link.onerror = () => reject(new Error(`Failed to load stylesheet ${href}`));
        document.head.appendChild(link);
    });
}

function loadScript(src) {
    if (document.querySelector(`script[src="${src}"]`)) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script ${src}`));
        document.head.appendChild(script);
    });
}

async function ensureLeaflet() {
    if (window.L?.map) {
        return window.L;
    }

    if (!leafletLoadPromise) {
        leafletLoadPromise = (async () => {
            await loadStylesheet(LEAFLET_CSS);
            await loadScript(LEAFLET_JS);

            try {
                await loadStylesheet(MARKER_CLUSTER_CSS);
                await loadStylesheet(MARKER_CLUSTER_DEFAULT_CSS);
                await loadScript(MARKER_CLUSTER_JS);
            } catch {
                // The map still works without clustering.
            }

            return window.L;
        })().catch((error) => {
            leafletLoadPromise = null;
            throw error;
        });
    }

    return leafletLoadPromise;
}

async function ensureHtmlToImage() {
    if (window.htmlToImage) {
        return window.htmlToImage;
    }

    if (!htmlToImageLoadPromise) {
        htmlToImageLoadPromise = loadScript(HTML_TO_IMAGE_JS)
            .then(() => window.htmlToImage)
            .catch((error) => {
                htmlToImageLoadPromise = null;
                throw error;
            });
    }

    return htmlToImageLoadPromise;
}

function getCoordinates(marker) {
    if (marker?.latitude != null && marker?.longitude != null) {
        return [marker.latitude, marker.longitude];
    }

    const jurisdiction = normalizeKey(marker?.jurisdiction);
    if (jurisdiction && JURISDICTION_CENTROIDS[jurisdiction]) {
        return JURISDICTION_CENTROIDS[jurisdiction];
    }

    return JURISDICTION_CENTROIDS.regional;
}

function createState(containerId, options, dotNetHelper) {
    return {
        containerId,
        options: options || {},
        dotNetHelper,
        map: null,
        markerLayer: null,
        markers: new Map(),
        markerVisibility: new Set(["entity", "source", "connected"]),
        visibleKinds: new Set(["entity", "source", "connected"]),
        selectedMarkerId: null
    };
}

function getState(containerId) {
    const state = mapRegistry.get(containerId);
    if (!state) {
        throw new Error(`No geospatial map is registered for container ${containerId}`);
    }

    return state;
}

function removeMarkerLayers(state) {
    if (!state.markerLayer) {
        return;
    }

    state.markerLayer.clearLayers();
}

function createMarkerIcon(marker) {
    const colorMap = {
        entity: "#38bdf8",
        source: "#818cf8",
        connected: "#f59e0b"
    };

    const color = colorMap[normalizeKey(marker.kind)] || "#94a3b8";
    const countBadge = marker.count > 1 ? `<span class="geo-marker-count">${marker.count}</span>` : "";

    return window.L.divIcon({
        className: "geo-marker-icon",
        html: `
            <div class="geo-marker" style="--geo-marker-color:${color}">
                <span class="geo-marker-dot"></span>
                ${countBadge}
            </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
        popupAnchor: [0, -18]
    });
}

function buildPopupContent(marker) {
    const meta = [marker.kind, marker.riskLabel || marker.meta, marker.jurisdiction].filter(Boolean).join(" • ");
    const summary = normalizeText(marker.summary);

    return `
        <div class="geo-popup">
            <div class="geo-popup-kicker">${escapeHtml(marker.kind)}</div>
            <div class="geo-popup-title">${escapeHtml(marker.title)}</div>
            <div class="geo-popup-meta">${escapeHtml(meta)}</div>
            ${summary ? `<div class="geo-popup-summary">${escapeHtml(summary)}</div>` : ""}
        </div>
    `;
}

function escapeHtml(value) {
    return normalizeText(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function escapeCsv(value) {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function isMarkerVisible(state, marker) {
    return state.visibleKinds.has(normalizeKey(marker.kind));
}

function addMarkerToLayer(state, marker) {
    if (!state.map || !state.markerLayer || !marker?.id) {
        return false;
    }

    if (!isMarkerVisible(state, marker)) {
        return false;
    }

    const coordinates = getCoordinates(marker);
    const leafletMarker = window.L.marker(coordinates, {
        icon: createMarkerIcon(marker),
        keyboard: true
    }).bindPopup(buildPopupContent(marker));

    leafletMarker.on("click", () => {
        state.selectedMarkerId = marker.id;
        if (state.dotNetHelper) {
            state.dotNetHelper.invokeMethodAsync("OnGeoMarkerSelected", marker.id);
        }
    });

    leafletMarker.on("mouseover", () => {
        leafletMarker.openPopup();
    });

    state.markerLayer.addLayer(leafletMarker);
    state.markers.set(marker.id, {
        ...marker,
        leafletMarker
    });

    return true;
}

function refreshLayer(state) {
    if (!state.map || !state.markerLayer) {
        return false;
    }

    removeMarkerLayers(state);
    for (const marker of state.markers.values()) {
        if (isMarkerVisible(state, marker)) {
            state.markerLayer.addLayer(marker.leafletMarker);
        }
    }

    return true;
}

function buildBounds(state) {
    const markers = Array.from(state.markers.values()).filter((marker) => isMarkerVisible(state, marker));
    if (markers.length === 0) {
        return null;
    }

    const bounds = markers.map((marker) => getCoordinates(marker));
    return window.L.latLngBounds(bounds);
}

function getVisibleMarkers(state) {
    return Array.from(state.markers.values()).filter((marker) => isMarkerVisible(state, marker));
}

function buildSummaryRows(state) {
    const visibleMarkers = getVisibleMarkers(state);
    const byKind = new Map();
    const byJurisdiction = new Map();

    for (const marker of visibleMarkers) {
        const kind = normalizeKey(marker.kind);
        byKind.set(kind, (byKind.get(kind) || 0) + 1);

        const jurisdiction = normalizeText(marker.jurisdiction) || "Unspecified";
        byJurisdiction.set(jurisdiction, (byJurisdiction.get(jurisdiction) || 0) + 1);
    }

    return {
        visibleMarkers,
        byKind: Array.from(byKind.entries()).map(([kind, count]) => ({ kind, count })),
        byJurisdiction: Array.from(byJurisdiction.entries()).map(([jurisdiction, count]) => ({ jurisdiction, count }))
    };
}

function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

function ensureFileName(fileName, fallback) {
    return normalizeText(fileName) || fallback;
}

function dataUrlToBlob(dataUrl) {
    const [header, encoded] = dataUrl.split(",", 2);
    const mimeMatch = /data:([^;]+)(;base64)?/.exec(header ?? "");
    const mimeType = mimeMatch?.[1] || "application/octet-stream";
    const isBase64 = Boolean(mimeMatch?.[2]);

    if (isBase64) {
        const binary = atob(encoded ?? "");
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return new Blob([bytes], { type: mimeType });
    }

    return new Blob([decodeURIComponent(encoded ?? "")], { type: mimeType });
}

class GeospatialMap {
    constructor(containerId, options, dotNetHelper) {
        this.containerId = containerId;
        this.options = options || {};
        this.dotNetHelper = dotNetHelper;
        this.map = null;
        this.markerLayer = null;
        this.markers = new Map();
        this.visibleKinds = new Set(["entity", "source", "connected"]);
        this.selectedMarkerId = null;
    }

    async init() {
        await ensureLeaflet();

        const container = document.getElementById(this.containerId);
        if (!container) {
            throw new Error(`Map container not found: ${this.containerId}`);
        }

        const center = [
            this.options.centerLatitude ?? -19.0154,
            this.options.centerLongitude ?? 29.1549
        ];
        const zoom = this.options.zoom ?? 4;

        this.map = window.L.map(this.containerId, {
            center,
            zoom,
            zoomControl: false,
            attributionControl: true,
            scrollWheelZoom: true,
            preferCanvas: true,
            worldCopyJump: true
        });

        window.L.control.zoom({ position: "topright" }).addTo(this.map);

        if (this.options.showScale ?? true) {
            window.L.control.scale({ position: "bottomleft", metric: true, imperial: false }).addTo(this.map);
        }

        const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
        const tileUrl = currentTheme === "light"
            ? "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

        this.tileLayer = window.L.tileLayer(tileUrl, {
            attribution: "© OpenStreetMap contributors © CARTO",
            maxZoom: 19,
            minZoom: 2
        }).addTo(this.map);

        window.onOsintThemeChanged = (newTheme) => {
            if (this.tileLayer && this.map) {
                const nextUrl = newTheme === "light"
                    ? "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
                this.tileLayer.setUrl(nextUrl);
            }
        };

        if (this.options.useClustering !== false && typeof window.L.markerClusterGroup === "function") {
            this.markerLayer = window.L.markerClusterGroup({
                maxClusterRadius: 56,
                showCoverageOnHover: false,
                spiderfyOnMaxZoom: true,
                zoomToBoundsOnClick: true
            });
        } else {
            this.markerLayer = window.L.layerGroup();
        }

        this.map.addLayer(this.markerLayer);

        this.map.on("click", () => {
            this.selectedMarkerId = null;
        });

        this.map.on("moveend zoomend", () => {
            if (this.dotNetHelper) {
                this.dotNetHelper.invokeMethodAsync("OnGeoViewportChanged", {
                    zoom: this.map.getZoom()
                });
            }
        });
    }

    setMarkers(markers) {
        this.markers.clear();
        removeMarkerLayers(this);

        (markers || []).forEach((marker) => {
            addMarkerToLayer(this, marker);
        });

        return true;
    }

    updateMarkers(markers) {
        return this.setMarkers(markers);
    }

    setVisibleKinds(visibleKinds) {
        this.visibleKinds = new Set((visibleKinds || []).map((kind) => normalizeKey(kind)));
        return refreshLayer(this);
    }

    fitBounds() {
        if (!this.map) {
            return false;
        }

        const bounds = buildBounds(this);
        if (!bounds) {
            this.map.setView([
                this.options.centerLatitude ?? -19.0154,
                this.options.centerLongitude ?? 29.1549
            ], this.options.zoom ?? 4);
            return true;
        }

        this.map.fitBounds(bounds.pad(0.18), { animate: true });
        return true;
    }

    flyToMarker(markerId) {
        if (!this.map || !markerId) {
            return false;
        }

        const marker = this.markers.get(markerId);
        if (!marker) {
            return false;
        }

        this.selectedMarkerId = markerId;
        this.map.flyTo(getCoordinates(marker), Math.max(this.map.getZoom(), 7), { duration: 1.1 });
        marker.leafletMarker.openPopup();
        return true;
    }

    destroy() {
        if (this.map) {
            this.map.remove();
        }

        this.map = null;
        this.markerLayer = null;
        this.markers.clear();
    }
}

async function exportSnapshot(containerId, fileName, format) {
    const state = getState(containerId);
    const htmlToImage = await ensureHtmlToImage();
    const container = document.getElementById(containerId);
    if (!container) {
        return false;
    }

    const exportFileName = ensureFileName(fileName, `jurisdiction-map.${format}`);
    const dataUrl = format === "png"
        ? await htmlToImage.toPng(container, {
            cacheBust: true,
            pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
            backgroundColor: "#08111f"
        })
        : await htmlToImage.toSvg(container, {
            cacheBust: true,
            backgroundColor: "#08111f"
        });

    const blob = dataUrlToBlob(dataUrl);
    downloadBlob(blob, exportFileName);
    return true;
}

export async function renderGeospatialMap(containerId, markers, options, dotNetHelper) {
    try {
        const existing = mapRegistry.get(containerId);
        if (existing) {
            existing.destroy();
            mapRegistry.delete(containerId);
        }

        const state = createState(containerId, options, dotNetHelper);
        const map = new GeospatialMap(containerId, options, dotNetHelper);
        await map.init();

        state.map = map.map;
        state.markerLayer = map.markerLayer;
        state.markers = map.markers;
        state.visibleKinds = map.visibleKinds;
        state.selectedMarkerId = map.selectedMarkerId;

        mapRegistry.set(containerId, state);
        map.setMarkers(markers);
        map.fitBounds();

        return true;
    } catch (error) {
        console.error("[GEOINT] Failed to render geospatial map", error);
        return false;
    }
}

export async function updateGeospatialMapMarkers(containerId, markers) {
    try {
        const state = getState(containerId);
        const map = new GeospatialMap(containerId, state.options, state.dotNetHelper);
        map.map = state.map;
        map.markerLayer = state.markerLayer;
        map.markers = state.markers;
        map.visibleKinds = state.visibleKinds;
        map.selectedMarkerId = state.selectedMarkerId;
        map.setMarkers(markers);
        state.markers = map.markers;
        map.fitBounds();
        return true;
    } catch (error) {
        console.error("[GEOINT] Failed to update geospatial map markers", error);
        return false;
    }
}

export async function setGeospatialMapLayerFilters(containerId, visibleKinds) {
    try {
        const state = getState(containerId);
        state.visibleKinds = new Set((visibleKinds || []).map((kind) => normalizeKey(kind)));
        refreshLayer(state);
        const map = state.map;
        if (map) {
            const bounds = buildBounds(state);
            if (bounds) {
                map.fitBounds(bounds.pad(0.18), { animate: true });
            }
        }

        return true;
    } catch (error) {
        console.error("[GEOINT] Failed to apply geospatial filters", error);
        return false;
    }
}

export async function flyToGeospatialMapMarker(containerId, markerId) {
    try {
        const state = getState(containerId);
        const map = new GeospatialMap(containerId, state.options, state.dotNetHelper);
        map.map = state.map;
        map.markerLayer = state.markerLayer;
        map.markers = state.markers;
        return map.flyToMarker(markerId);
    } catch (error) {
        console.error("[GEOINT] Failed to fly to geospatial marker", error);
        return false;
    }
}

export async function fitGeospatialMapBounds(containerId) {
    try {
        const state = getState(containerId);
        const map = new GeospatialMap(containerId, state.options, state.dotNetHelper);
        map.map = state.map;
        map.markerLayer = state.markerLayer;
        map.markers = state.markers;
        map.visibleKinds = state.visibleKinds;
        return map.fitBounds();
    } catch (error) {
        console.error("[GEOINT] Failed to fit geospatial map", error);
        return false;
    }
}

export async function exportGeospatialMapPng(containerId, fileName) {
    try {
        return await exportSnapshot(containerId, fileName, "png");
    } catch (error) {
        console.error("[GEOINT] Failed to export map PNG", error);
        return false;
    }
}

export async function exportGeospatialMapSvg(containerId, fileName) {
    try {
        return await exportSnapshot(containerId, fileName, "svg");
    } catch (error) {
        console.error("[GEOINT] Failed to export map SVG", error);
        return false;
    }
}

export async function exportGeospatialMapCsv(containerId, fileName) {
    try {
        const state = getState(containerId);
        const summary = buildSummaryRows(state);
        const rows = [
            ["type", "label", "count"],
            ...summary.byKind.map((row) => ["kind", row.kind, row.count]),
            ...summary.byJurisdiction.map((row) => ["jurisdiction", row.jurisdiction, row.count])
        ];

        const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        downloadBlob(blob, ensureFileName(fileName, "jurisdiction-map-summary.csv"));
        return true;
    } catch (error) {
        console.error("[GEOINT] Failed to export map CSV", error);
        return false;
    }
}

export async function exportGeospatialMapJson(containerId, fileName) {
    try {
        const state = getState(containerId);
        const summary = buildSummaryRows(state);
        const payload = {
            exportedAtUtc: new Date().toISOString(),
            visibleMarkers: summary.visibleMarkers.map((marker) => ({
                id: marker.id,
                kind: marker.kind,
                title: marker.title,
                subtitle: marker.subtitle,
                meta: marker.meta,
                jurisdiction: marker.jurisdiction,
                riskLabel: marker.riskLabel,
                summary: marker.summary,
                entityId: marker.entityId,
                sourceDocumentTitle: marker.sourceDocumentTitle,
                sourceUrl: marker.sourceUrl,
                count: marker.count
            })),
            byKind: summary.byKind,
            byJurisdiction: summary.byJurisdiction
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
        downloadBlob(blob, ensureFileName(fileName, "jurisdiction-map-summary.json"));
        return true;
    } catch (error) {
        console.error("[GEOINT] Failed to export map JSON", error);
        return false;
    }
}

export async function destroyGeospatialMap(containerId) {
    try {
        const state = mapRegistry.get(containerId);
        if (state?.map) {
            state.map.remove();
        }
        mapRegistry.delete(containerId);
        return true;
    } catch (error) {
        console.error("[GEOINT] Failed to destroy geospatial map", error);
        return false;
    }
}

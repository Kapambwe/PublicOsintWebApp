const VIS_TIMELINE_JS = "https://cdn.jsdelivr.net/npm/vis-timeline@7.7.3/dist/vis-timeline-graph2d.min.js";
const VIS_TIMELINE_CSS = "https://cdn.jsdelivr.net/npm/vis-timeline@7.7.3/dist/vis-timeline-graph2d.min.css";

let visLoadPromise = null;

async function ensureVisTimeline() {
    if (window.vis?.Timeline && window.vis?.DataSet) {
        return window.vis;
    }

    if (!visLoadPromise) {
        visLoadPromise = (async () => {
            if (!document.getElementById("vis-timeline-css")) {
                const link = document.createElement("link");
                link.id = "vis-timeline-css";
                link.rel = "stylesheet";
                link.href = VIS_TIMELINE_CSS;
                document.head.appendChild(link);
            }

            await loadScript(VIS_TIMELINE_JS);
            return window.vis;
        })();
    }

    return visLoadPromise;
}

function loadScript(url) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${url}"]`)) {
            resolve();
            return;
        }

        const script = document.createElement("script");
        script.src = url;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load ${url}`));
        document.head.appendChild(script);
    });
}

function normalizeText(value) {
    return String(value ?? "").trim();
}

function escapeHtml(value) {
    return normalizeText(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function parseDate(value) {
    if (!value) {
        return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(value) {
    return value instanceof Date
        ? value.toISOString()
        : value && typeof value === "string"
            ? new Date(value).toISOString()
            : null;
}

function buildSearchText(...values) {
    return values
        .flatMap((value) => {
            if (value == null) {
                return [];
            }

            if (Array.isArray(value)) {
                return value;
            }

            return [String(value)];
        })
        .map((value) => normalizeText(value))
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
}

export class TimelineVisualization {
    constructor(container, items, options = {}, dotNetHelper = null, groups = []) {
        this.container = container;
        this.items = Array.isArray(items) ? items : [];
        this.options = options ?? {};
        this.dotNetHelper = dotNetHelper;
        this.groups = Array.isArray(groups) ? groups : [];
        this.timeline = null;
        this.allItems = [];
        this.activeGroupFilters = [];
        this.activeDateRange = null;
        this.currentWindow = null;
        this.selectedItemId = null;
    }

    async init() {
        await ensureVisTimeline();
        this.createTimeline();
        this.applyFilters(false);
        return true;
    }

    createTimeline() {
        this.container.innerHTML = "";
        this.allItems = this.items.map((item) => ({
            id: item.id,
            content: item.content,
            start: item.start,
            end: item.end || null,
            description: item.description || "",
            itemType: item.itemType || item.type || "",
            riskLevel: item.riskLevel || "",
            className: item.className || "",
            style: item.style || "",
            group: item.group || "",
            searchText: item.searchText || buildSearchText(item.content, item.description, item.itemType, item.riskLevel, item.group)
        }));

        const dataset = new window.vis.DataSet(this.allItems);
        const groupsDataset = this.groups.length ? new window.vis.DataSet(this.groups) : null;

        const timelineOptions = {
            horizontalScroll: this.options.horizontalScroll ?? true,
            verticalScroll: this.options.verticalScroll ?? true,
            zoomKey: this.options.zoomKey || "ctrlKey",
            orientation: "both",
            stack: this.options.stack ?? true,
            showCurrentTime: this.options.showCurrentTime ?? true,
            showMajorLabels: true,
            showMinorLabels: true,
            selectable: true,
            multiselect: false,
            editable: false,
            margin: {
                item: { horizontal: 12, vertical: 10 },
                axis: 8
            },
            template: (item) => this.createItemTemplate(item)
        };

        if (this.options.start) {
            timelineOptions.start = this.options.start;
        }
        if (this.options.end) {
            timelineOptions.end = this.options.end;
        }
        if (this.options.min) {
            timelineOptions.min = this.options.min;
        }
        if (this.options.max) {
            timelineOptions.max = this.options.max;
        }

        this.timeline = groupsDataset
            ? new window.vis.Timeline(this.container, dataset, groupsDataset, timelineOptions)
            : new window.vis.Timeline(this.container, dataset, timelineOptions);

        this.timeline.on("select", (properties) => {
            if (!this.dotNetHelper || !properties.items?.length) {
                return;
            }

            const itemId = properties.items[0];
            this.selectedItemId = itemId;
            this.dotNetHelper.invokeMethodAsync("OnTimelineItemSelected", itemId);
        });

        this.timeline.on("rangechanged", (properties) => {
            if (!this.dotNetHelper) {
                return;
            }

            this.currentWindow = {
                start: properties.start ? properties.start.toISOString() : null,
                end: properties.end ? properties.end.toISOString() : null
            };

            this.dotNetHelper.invokeMethodAsync("OnTimelineRangeChanged", this.currentWindow);
        });

        this.applyBaseStyling();
    }

    createItemTemplate(item) {
        const type = normalizeText(item.itemType);
        const riskLevel = normalizeText(item.riskLevel);
        const iconMap = {
            transaction: "💰",
            document: "📄",
            meeting: "👥",
            communication: "📧",
            alert: "⚠️",
            status: "🔄",
            verification: "✓",
            screening: "🔍",
            investigation: "🕵️",
            case: "📋"
        };

        const icon = iconMap[type.toLowerCase()] || "📌";
        const riskClass = riskLevel ? `risk-${riskLevel.toLowerCase()}` : "";
        const description = item.description ? `<div class="timeline-item-description">${escapeHtml(item.description)}</div>` : "";
        const riskBadge = riskLevel ? `<span class="timeline-risk-badge risk-${riskLevel.toLowerCase()}">${escapeHtml(riskLevel)}</span>` : "";

        return `
            <div class="timeline-item-content ${riskClass}">
                <div class="timeline-item-icon">${icon}</div>
                <div class="timeline-item-details">
                    <div class="timeline-item-title">${escapeHtml(item.content)}</div>
                    ${description}
                    ${riskBadge}
                </div>
            </div>
        `;
    }

    applyBaseStyling() {
        if (document.getElementById("osint-timeline-styles")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "osint-timeline-styles";
        style.textContent = `
            .vis-timeline {
                border: 1px solid #1f2937;
                border-radius: 16px;
                background: linear-gradient(180deg, rgba(8, 17, 31, 0.98), rgba(15, 23, 42, 0.98));
                font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
                color: #e2e8f0;
            }

            .vis-panel.vis-background {
                background: linear-gradient(180deg, rgba(11, 18, 32, 0.82), rgba(8, 17, 31, 0.92));
            }

            .vis-time-axis .vis-text,
            .vis-labelset .vis-label {
                color: #cbd5e1;
                font-size: 12px;
            }

            .vis-time-axis .vis-grid.vis-vertical,
            .vis-time-axis .vis-grid.vis-minor {
                border-color: rgba(148, 163, 184, 0.12);
            }

            .vis-item {
                border: none;
                border-radius: 12px;
                box-shadow: 0 14px 24px -16px rgba(0, 0, 0, 0.65);
                color: #f8fafc;
                transition: transform 120ms ease, box-shadow 120ms ease;
            }

            .vis-item:hover {
                transform: translateY(-1px);
                box-shadow: 0 18px 30px -18px rgba(56, 189, 248, 0.35);
            }

            .vis-item.vis-selected {
                box-shadow: 0 0 0 2px rgba(250, 204, 21, 0.35), 0 20px 34px -18px rgba(0, 0, 0, 0.8);
            }

            .timeline-item-content {
                display: flex;
                align-items: flex-start;
                gap: 0.65rem;
                padding: 0.6rem 0.75rem;
                min-width: 180px;
            }

            .timeline-item-icon {
                font-size: 1.05rem;
                line-height: 1;
                margin-top: 0.08rem;
            }

            .timeline-item-details {
                min-width: 0;
            }

            .timeline-item-title {
                font-weight: 700;
                font-size: 0.85rem;
                line-height: 1.25;
                color: #f8fafc;
            }

            .timeline-item-description {
                margin-top: 0.2rem;
                font-size: 0.72rem;
                line-height: 1.3;
                color: #94a3b8;
            }

            .timeline-risk-badge {
                display: inline-block;
                margin-top: 0.35rem;
                padding: 0.15rem 0.45rem;
                border-radius: 999px;
                font-size: 0.65rem;
                font-weight: 700;
                letter-spacing: 0.05em;
                text-transform: uppercase;
                color: #fff;
            }

            .timeline-risk-badge.risk-critical { background: #dc2626; }
            .timeline-risk-badge.risk-high { background: #f59e0b; }
            .timeline-risk-badge.risk-medium { background: #3b82f6; }
            .timeline-risk-badge.risk-low { background: #10b981; }
            .timeline-risk-badge.risk-verified { background: #22c55e; }
            .timeline-risk-badge.risk-unverified { background: #64748b; }
            .timeline-risk-badge.risk-reviewed { background: #a855f7; }

            .vis-current-time {
                background-color: #f43f5e;
                width: 2px;
            }
        `;
        document.head.appendChild(style);
    }

    rebuildDataset(filteredItems) {
        if (!this.timeline) {
            return;
        }

        const dataset = new window.vis.DataSet(filteredItems);
        this.timeline.setItems(dataset);
        if (this.groups.length) {
            this.timeline.setGroups(new window.vis.DataSet(this.groups));
        }
    }

    applyFilters(notify = true) {
        if (!this.timeline) {
            return;
        }

        let filteredItems = this.allItems.slice();
        if (this.activeGroupFilters.length > 0) {
            filteredItems = filteredItems.filter((item) => item.group && this.activeGroupFilters.includes(item.group));
        }

        if (this.activeDateRange) {
            filteredItems = filteredItems.filter((item) => {
                const itemDate = parseDate(item.start);
                if (!itemDate) {
                    return false;
                }

                const start = this.activeDateRange.start ? parseDate(this.activeDateRange.start) : null;
                const end = this.activeDateRange.end ? parseDate(this.activeDateRange.end) : null;

                if (start && itemDate < start) {
                    return false;
                }
                if (end && itemDate > end) {
                    return false;
                }

                return true;
            });
        }

        this.rebuildDataset(filteredItems);

        if (notify && this.dotNetHelper) {
            this.dotNetHelper.invokeMethodAsync("OnFilterChanged", {
                groupFilters: this.activeGroupFilters,
                dateRange: this.activeDateRange,
                filteredCount: filteredItems.length,
                totalCount: this.allItems.length
            });
        }

        return filteredItems;
    }

    filterByGroups(groupIds) {
        this.activeGroupFilters = Array.isArray(groupIds) ? groupIds.filter(Boolean) : [];
        this.applyFilters(true);
    }

    filterByDateRange(startDate, endDate) {
        if (startDate || endDate) {
            this.activeDateRange = {
                start: startDate || null,
                end: endDate || null
            };
        } else {
            this.activeDateRange = null;
        }

        this.applyFilters(true);
    }

    clearFilters() {
        this.activeGroupFilters = [];
        this.activeDateRange = null;
        this.applyFilters(true);
    }

    getFilterState() {
        return {
            groupFilters: this.activeGroupFilters.slice(),
            dateRange: this.activeDateRange
        };
    }

    setWindow(start, end) {
        if (!this.timeline) {
            return;
        }

        const startDate = start ? parseDate(start) : null;
        const endDate = end ? parseDate(end) : null;
        if (startDate && endDate) {
            this.timeline.setWindow(startDate, endDate, { animation: true });
            this.currentWindow = {
                start: startDate.toISOString(),
                end: endDate.toISOString()
            };
        }
    }

    fit() {
        this.timeline?.fit();
    }

    destroy() {
        this.timeline?.destroy();
        this.timeline = null;
        this.container.innerHTML = "";
    }
}

export function createTimelineController(container, items, options, dotNetHelper, groups) {
    return new TimelineVisualization(container, items, options, dotNetHelper, groups);
}

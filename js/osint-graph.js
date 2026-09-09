const graphRegistry = new Map();

function requireCytoscape() {
    if (!window.cytoscape) {
        throw new Error("Cytoscape.js is not available. Ensure the Cytoscape script is loaded before osint-graph.js.");
    }

    return window.cytoscape;
}

function getContainer(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        throw new Error(`Graph container not found: ${containerId}`);
    }

    return container;
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

function escapeCsv(value) {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function hashString(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = ((hash << 5) - hash) + value.charCodeAt(i);
        hash |= 0;
    }

    return Math.abs(hash);
}

function uniqueById(items) {
    const map = new Map();
    for (const item of items) {
        if (item?.data?.id && !map.has(item.data.id)) {
            map.set(item.data.id, item);
        }
    }

    return Array.from(map.values());
}

function getState(containerId) {
    const state = graphRegistry.get(containerId);
    if (!state) {
        throw new Error(`No Cytoscape graph is registered for container ${containerId}`);
    }

    return state;
}

function createSurface(container) {
    const surface = document.createElement("div");
    surface.className = "osint-graph-surface";
    container.appendChild(surface);
    return surface;
}

function createLabelLayer(container) {
    const layer = document.createElement("div");
    layer.className = "osint-graph-label-layer";
    container.appendChild(layer);
    return layer;
}

function buildStylesheet() {
    return [
        {
            selector: "node",
            style: {
                "font-family": "Segoe UI, Tahoma, Geneva, Verdana, sans-serif",
                "background-color": "#111827",
                "border-width": 2,
                "border-color": "#334155",
                "color": "#f8fafc",
                "label": "data(label)",
                "text-wrap": "wrap",
                "text-max-width": 120,
                "font-size": 11,
                "text-valign": "center",
                "text-halign": "center",
                "shape": "round-rectangle",
                "width": 120,
                "height": 58
            }
        },
        {
            selector: "node[kind = 'entity']",
            style: {
                "background-color": "#1d4ed8",
                "border-color": "#38bdf8",
                "width": 168,
                "height": 84,
                "font-size": 12,
                "font-weight": 700
            }
        },
        {
            selector: "node[entityCategory = 'PEP']",
            style: {
                "background-color": "#5b21b6",
                "border-color": "#f59e0b",
                "text-outline-color": "#0f172a",
                "text-outline-width": 2,
                "font-weight": 800
            }
        },
        {
            selector: "node[kind = 'relationship']",
            style: {
                "background-color": "#0f172a",
                "border-color": "#38bdf8"
            }
        },
        {
            selector: "node[kind = 'document']",
            style: {
                "background-color": "#1e1b4b",
                "border-color": "#818cf8"
            }
        },
        {
            selector: "node[kind = 'claim']",
            style: {
                "background-color": "#3f1d2e",
                "border-color": "#f43f5e"
            }
        },
        {
            selector: "node[kind = 'ownership-root']",
            style: {
                "background-color": "#0f766e",
                "border-color": "#5eead4",
                "width": 190,
                "height": 92,
                "font-size": 12,
                "font-weight": 800
            }
        },
        {
            selector: "node[kind = 'ownership-ubo']",
            style: {
                "background-color": "#166534",
                "border-color": "#4ade80",
                "width": 170,
                "height": 80,
                "font-size": 12,
                "font-weight": 800
            }
        },
        {
            selector: "node[kind = 'ownership-vehicle']",
            style: {
                "background-color": "#7c2d12",
                "border-color": "#fb923c",
                "width": 162,
                "height": 74,
                "font-size": 11,
                "font-weight": 700
            }
        },
        {
            selector: "node[kind = 'ownership-hop']",
            style: {
                "background-color": "#1f2937",
                "border-color": "#38bdf8",
                "width": 154,
                "height": 72,
                "font-size": 11,
                "font-weight": 700
            }
        },
        {
            selector: "node.graph-hidden, edge.graph-hidden",
            style: { "display": "none" }
        },
        {
            selector: "node.graph-search-hit",
            style: {
                "border-width": 4,
                "border-color": "#facc15",
                "background-color": "#1f2937"
            }
        },
        {
            selector: "node.graph-search-dim, edge.graph-search-dim",
            style: { "opacity": 0.18 }
        },
        {
            selector: "node.graph-focus",
            style: {
                "border-width": 4,
                "border-color": "#facc15",
                "background-color": "#1e3a8a"
            }
        },
        {
            selector: "edge.graph-focus",
            style: {
                "width": 3.5,
                "line-color": "#facc15",
                "target-arrow-color": "#facc15"
            }
        },
        {
            selector: "node.graph-faded, edge.graph-faded",
            style: { "opacity": 0.28 }
        },
        {
            selector: "edge",
            style: {
                "curve-style": "bezier",
                "width": 1.8,
                "line-color": "#475569",
                "target-arrow-color": "#475569",
                "target-arrow-shape": "triangle",
                "arrow-scale": 0.8
            }
        },
        {
            selector: "edge[kind = 'relationship']",
            style: {
                "line-color": "#38bdf8",
                "target-arrow-color": "#38bdf8"
            }
        },
        {
            selector: "edge[kind = 'document']",
            style: {
                "line-color": "#818cf8",
                "target-arrow-color": "#818cf8",
                "line-style": "dashed"
            }
        },
        {
            selector: "edge[kind = 'claim']",
            style: {
                "line-color": "#f43f5e",
                "target-arrow-color": "#f43f5e",
                "line-style": "dotted"
            }
        },
        {
            selector: "edge[kind = 'ownership']",
            style: {
                "line-color": "#5eead4",
                "target-arrow-color": "#5eead4",
                "width": 2.6
            }
        }
    ];
}

function buildGraphElements(payload, container) {
    const nodes = uniqueById((payload.nodes ?? []).map((node) => ({ data: { ...node }, position: { x: 0, y: 0 } })));
    const edges = (payload.edges ?? []).map((edge) => ({ data: { ...edge } }));
    assignPositions(payload, nodes, container);
    return nodes.concat(edges);
}

function assignPositions(payload, nodes, container) {
    const width = container.clientWidth || 1200;
    const height = container.clientHeight || 720;
    const center = { x: width / 2, y: height / 2 };
    const rootId = `entity-${payload?.rootEntityId ?? ""}`;
    const entityNodes = nodes.filter((node) => node.data.kind === "entity");
    const entityById = new Map(entityNodes.map((node) => [node.data.id, node]));
    const ownershipNodes = nodes.filter((node) => String(node.data.kind || "").startsWith("ownership-"));

    if (ownershipNodes.length > 0) {
        layoutOwnershipGraph(nodes, center, width, height);
        return;
    }

    const rootNode = entityById.get(rootId) || entityNodes[0] || null;
    if (rootNode) {
        rootNode.position = center;
    }

    const outerEntities = entityNodes.filter((node) => node !== rootNode);
    const outerRadius = Math.max(240, Math.min(width, height) / 2 - 120);
    outerEntities.forEach((node, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(1, outerEntities.length);
        node.position = {
            x: center.x + outerRadius * Math.cos(angle),
            y: center.y + outerRadius * Math.sin(angle)
        };
    });

    const nonEntityNodes = nodes.filter((node) => node.data.kind !== "entity");
    const grouped = new Map();
    for (const node of nonEntityNodes) {
        const ownerId = `entity-${node.data.entityId || payload?.rootEntityId || ""}`;
        if (!grouped.has(ownerId)) {
            grouped.set(ownerId, []);
        }

        grouped.get(ownerId).push(node);
    }

    for (const [ownerId, group] of grouped.entries()) {
        const owner = entityById.get(ownerId) || rootNode;
        if (!owner) {
            continue;
        }

        const origin = owner.position || center;
        const buckets = { relationship: [], document: [], claim: [], misc: [] };
        for (const node of group) {
            if (node.data.kind === "relationship") {
                buckets.relationship.push(node);
            } else if (node.data.kind === "document") {
                buckets.document.push(node);
            } else if (node.data.kind === "claim") {
                buckets.claim.push(node);
            } else {
                buckets.misc.push(node);
            }
        }

        layoutRing(buckets.relationship, origin, 138, ownerId, "relationship");
        layoutRing(buckets.document, origin, 202, ownerId, "document");
        layoutRing(buckets.claim, origin, 268, ownerId, "claim");
        layoutRing(buckets.misc, origin, 332, ownerId, "misc");
    }
}

function layoutOwnershipGraph(nodes, center, width, height) {
    const ownershipNodes = nodes.filter((node) => String(node.data.kind || "").startsWith("ownership-"));
    if (!ownershipNodes.length) {
        return;
    }

    const root = ownershipNodes.find((node) => node.data.kind === "ownership-root") || ownershipNodes[0];
    const rootChain = normalizeText(root?.data("ownershipChainId") || "ownership");
    const chainGroups = new Map();

    ownershipNodes.forEach((node) => {
        const chainId = normalizeText(node.data("ownershipChainId") || rootChain || "ownership");
        if (!chainGroups.has(chainId)) {
            chainGroups.set(chainId, []);
        }

        chainGroups.get(chainId).push(node);
    });

    const chains = Array.from(chainGroups.entries())
        .map(([chainId, group]) => ({
            chainId,
            group: group.sort((a, b) => {
                const depthA = Number(a.data("ownershipDepth") ?? 0);
                const depthB = Number(b.data("ownershipDepth") ?? 0);
                if (depthA !== depthB) {
                    return depthA - depthB;
                }

                return normalizeText(a.data("title")).localeCompare(normalizeText(b.data("title")));
            })
        }))
        .sort((a, b) => b.group.length - a.group.length || a.chainId.localeCompare(b.chainId));

    const rootPosition = {
        x: Math.max(180, Math.min(center.x * 0.34, 260)),
        y: center.y
    };
    if (root) {
        root.position = rootPosition;
    }

    const rowSpan = Math.max(150, Math.min(220, (height - 120) / Math.max(1, chains.length)));
    chains.forEach((chain, chainIndex) => {
        const chainBaseY = center.y - ((chains.length - 1) * rowSpan) / 2 + chainIndex * rowSpan;
        const chainNodes = chain.group;
        const chainRoot = chainNodes.find((node) => node.data.kind === "ownership-root") || root;
        const stepSpacing = Math.max(165, Math.min(245, (width - rootPosition.x - 120) / Math.max(2, chainNodes.length + 1)));

        chainNodes.forEach((node, index) => {
            if (node === chainRoot) {
                node.position = rootPosition;
                return;
            }

            const depth = Math.max(1, Number(node.data("ownershipDepth") ?? index));
            const yJitter = (hashString(`${chain.chainId}:${node.id()}`) % 44) - 22;
            node.position = {
                x: rootPosition.x + depth * stepSpacing + (node.data("ownershipIsControlVehicle") ? 24 : 0),
                y: chainBaseY + yJitter
            };
        });
    });
}

function layoutRing(nodes, origin, radius, seed, kind) {
    if (!nodes.length) {
        return;
    }

    const offset = (hashString(`${seed}:${kind}`) % 360) * Math.PI / 180;
    const step = (Math.PI * 2) / nodes.length;
    nodes.forEach((node, index) => {
        const angle = offset + index * step;
        node.position = {
            x: origin.x + radius * Math.cos(angle),
            y: origin.y + radius * Math.sin(angle)
        };
    });
}

function setNodeDataLabels(cy) {
    cy.nodes().forEach((node) => {
        const title = normalizeText(node.data("title") || node.data("label") || node.id());
        const subtitle = normalizeText(node.data("subtitle") || "");
        const meta = normalizeText(node.data("meta") || "");
        node.data("label", title);
        node.data("searchText", normalizeText([
            title,
            subtitle,
            meta,
            node.id(),
            node.data("entityCategory") || "",
            node.data("entityJurisdiction") || "",
            node.data("entitySummary") || "",
            node.data("sourceDocumentTitle") || "",
            node.data("claimQuote") || "",
            node.data("ownershipChainSummary") || "",
            node.data("ownershipRole") || "",
            node.data("ownershipStepLabel") || "",
            ...(Array.isArray(node.data("entityAliases")) ? node.data("entityAliases") : []),
            ...(Array.isArray(node.data("entityTags")) ? node.data("entityTags") : [])
        ].filter(Boolean).join(" ")));
    });
}

function applySearchIndex(payload, cy) {
    const searchIndex = Array.isArray(payload?.searchIndex) ? payload.searchIndex : [];
    if (!searchIndex.length) {
        return;
    }

    cy.batch(() => {
        searchIndex.forEach((entry) => {
            if (!entry?.nodeId) {
                return;
            }

            const node = cy.getElementById(entry.nodeId);
            if (node && !node.empty()) {
                node.data("searchText", normalizeText(entry.searchText || node.data("searchText") || ""));
            }
        });
    });
}

function renderGraph(containerId, payload, dotNetRef) {
    const cytoscape = requireCytoscape();
    const container = getContainer(containerId);
    const existing = graphRegistry.get(containerId);
    if (existing) {
        existing.resizeObserver?.disconnect();
        existing.cy?.destroy();
        graphRegistry.delete(containerId);
    }

    container.innerHTML = "";
    const surface = createSurface(container);
    const labelLayer = createLabelLayer(container);

    const state = {
        cy: null,
        container,
        labelLayer,
        payload,
        dotNetRef,
        filters: {
            showRelationships: true,
            showDocuments: true,
            showClaims: true
        },
        searchTerm: "",
        focusedId: `entity-${payload?.rootEntityId ?? ""}`,
        labelOffsets: new Map(),
        resizeObserver: null
    };

    const cy = cytoscape({
        container: surface,
        elements: buildGraphElements(payload, container),
        style: buildStylesheet(),
        layout: {
            name: "preset",
            fit: true,
            padding: 20
        },
        minZoom: 0.4,
        maxZoom: 2.8,
        wheelSensitivity: 0.15
    });

    state.cy = cy;
    setNodeDataLabels(cy);
    applySearchIndex(payload, cy);
    graphRegistry.set(containerId, state);

    cy.on("render zoom pan add remove position data", () => syncGraphState(containerId));
    cy.on("tap", "node", (evt) => focusNode(containerId, evt.target.id(), { animate: true, notify: true, preserveSearch: true }));
    cy.on("tap", (evt) => {
        if (evt.target === cy) {
            resetFocus(containerId);
        }
    });

    state.resizeObserver = new ResizeObserver(() => {
        const current = graphRegistry.get(containerId);
        if (!current) {
            return;
        }

        current.cy.resize();
        syncGraphState(containerId);
    });
    state.resizeObserver.observe(container);

    applyFilters(containerId, state.filters);
    if (state.focusedId) {
        focusNode(containerId, state.focusedId, { animate: false, centerOnly: true, notify: false, preserveSearch: false });
    }
    syncGraphState(containerId);
    return cy;
}

function syncGraphState(containerId) {
    const state = getState(containerId);
    const { cy, labelLayer, labelOffsets } = state;
    if (!cy || !labelLayer) {
        return;
    }

    labelLayer.innerHTML = "";

    cy.nodes().forEach((node) => {
        if (node.hasClass("graph-hidden")) {
            return;
        }

        const nodeId = node.id();
        const kind = node.data("kind");
        const position = node.renderedPosition();
        const offset = labelOffsets.get(nodeId) || { x: 0, y: 0 };
        const label = document.createElement("button");
        label.type = "button";
        label.className = [
            "osint-graph-label",
            `osint-graph-label--${kind}`,
            node.hasClass("graph-search-hit") ? "osint-graph-label--search" : "",
            node.hasClass("graph-focus") ? "osint-graph-label--focus" : ""
        ].filter(Boolean).join(" ");
        label.dataset.nodeId = nodeId;
        label.dataset.kind = kind;
        label.style.left = `${position.x + offset.x}px`;
        label.style.top = `${position.y + offset.y}px`;
        label.setAttribute("aria-label", `${normalizeText(node.data("title") || node.id())} ${normalizeText(node.data("subtitle") || "")}`.trim());
        label.innerHTML = `
            <span class="osint-graph-label__title">${escapeHtml(node.data("title") || node.data("label") || nodeId)}</span>
            <span class="osint-graph-label__subtitle">${escapeHtml(node.data("subtitle") || "")}</span>
            <span class="osint-graph-label__meta">${escapeHtml(node.data("meta") || "")}</span>
        `;

        wireLabelInteraction(containerId, label, nodeId);
        labelLayer.appendChild(label);
    });
}

function wireLabelInteraction(containerId, label, nodeId) {
    const state = getState(containerId);
    let drag = null;
    let moved = false;

    const onPointerMove = (event) => {
        if (!drag) {
            return;
        }

        const dx = event.clientX - drag.clientX;
        const dy = event.clientY - drag.clientY;
        if (Math.abs(dx) + Math.abs(dy) > 3) {
            moved = true;
        }

        state.labelOffsets.set(nodeId, {
            x: drag.offset.x + dx,
            y: drag.offset.y + dy
        });
        syncGraphState(containerId);
    };

    const onPointerUp = () => {
        if (!drag) {
            return;
        }

        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        const shouldFocus = !moved;
        drag = null;
        moved = false;

        if (shouldFocus) {
            focusNode(containerId, nodeId, { animate: true, notify: true, preserveSearch: true });
        }
    };

    label.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        drag = {
            clientX: event.clientX,
            clientY: event.clientY,
            offset: state.labelOffsets.get(nodeId) || { x: 0, y: 0 }
        };
        moved = false;
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
    });

    label.addEventListener("click", (event) => {
        if (moved) {
            event.preventDefault();
            event.stopPropagation();
        }
    });
}

function isNodeVisibleByFilter(kind, filters) {
    if (kind === "entity") {
        return true;
    }

    if (kind && String(kind).startsWith("ownership-")) {
        return true;
    }

    if (kind === "relationship") {
        return filters.showRelationships;
    }

    if (kind === "document") {
        return filters.showDocuments;
    }

    if (kind === "claim") {
        return filters.showClaims;
    }

    return true;
}

function clearInteractionClasses(cy) {
    cy.batch(() => {
        cy.elements().removeClass("graph-search-hit graph-search-dim graph-focus graph-faded");
    });
}

function isElementVisible(nodeId, cy) {
    const node = cy.getElementById(nodeId);
    return Boolean(node && !node.empty() && !node.hasClass("graph-hidden"));
}

function applyFilters(containerId, filters) {
    const state = getState(containerId);
    state.filters = {
        showRelationships: Boolean(filters?.showRelationships),
        showDocuments: Boolean(filters?.showDocuments),
        showClaims: Boolean(filters?.showClaims)
    };

    const { cy } = state;
    cy.batch(() => {
        cy.nodes().forEach((node) => {
            if (node.data("kind") === "entity") {
                node.removeClass("graph-hidden");
                return;
            }

            node.toggleClass("graph-hidden", !isNodeVisibleByFilter(node.data("kind"), state.filters));
        });

        cy.edges().forEach((edge) => {
            const source = cy.getElementById(edge.data("source"));
            const target = cy.getElementById(edge.data("target"));
            const visible = isNodeVisibleByFilter(edge.data("kind"), state.filters) && !source.hasClass("graph-hidden") && !target.hasClass("graph-hidden");
            edge.toggleClass("graph-hidden", !visible);
        });
    });

    if (!isElementVisible(state.focusedId, cy)) {
        state.focusedId = `entity-${state.payload?.rootEntityId ?? ""}`;
    }

    if (state.searchTerm) {
        applySearchHighlight(containerId, state.searchTerm, { notify: false, skipRefocus: true });
    } else {
        clearInteractionClasses(cy);
        if (state.focusedId) {
            focusNode(containerId, state.focusedId, { animate: false, centerOnly: true, notify: false, preserveSearch: false });
        }
    }

    syncGraphState(containerId);
}

function applySearchHighlight(containerId, query, options = {}) {
    const state = getState(containerId);
    const { cy } = state;
    const text = normalizeText(query).toLowerCase();
    state.searchTerm = text;

    cy.batch(() => {
        cy.nodes().removeClass("graph-search-hit graph-search-dim");
        cy.edges().removeClass("graph-search-hit graph-search-dim");

        if (!text) {
            if (!options.skipRefocus && state.focusedId) {
                focusNode(containerId, state.focusedId, { animate: false, centerOnly: true, notify: false, preserveSearch: false });
            }
            return;
        }

        const matches = cy.nodes().filter((node) => {
            if (node.hasClass("graph-hidden")) {
                return false;
            }

            const searchText = normalizeText(node.data("searchText") || [node.data("title"), node.data("subtitle"), node.data("meta"), node.id()].join(" ")).toLowerCase();
            return searchText.includes(text);
        });

        const matchedIds = new Set(matches.map((node) => node.id()));
        matches.addClass("graph-search-hit");
        cy.nodes().not(matches).not(":hidden").addClass("graph-search-dim");

        cy.edges().forEach((edge) => {
            const sourceMatch = matchedIds.has(edge.data("source"));
            const targetMatch = matchedIds.has(edge.data("target"));
            edge.toggleClass("graph-search-hit", sourceMatch || targetMatch);
            edge.toggleClass("graph-search-dim", !(sourceMatch || targetMatch));
        });

        if (matches.length > 0) {
            focusNode(containerId, matches[0].id(), {
                animate: true,
                centerOnly: false,
                notify: options.notify !== false,
                preserveSearch: true
            });
        } else {
            state.focusedId = `entity-${state.payload?.rootEntityId ?? ""}`;
        }
    });

    syncGraphState(containerId);
    const hits = cy.nodes().filter((node) => node.hasClass("graph-search-hit"));
    return {
        matchCount: hits.length,
        firstMatchId: hits[0]?.id() ?? null
    };
}

function searchGraph(containerId, query) {
    return applySearchHighlight(containerId, query, { notify: true });
}

function focusNode(containerId, nodeId, options = {}) {
    const state = getState(containerId);
    const { cy } = state;
    const node = cy.getElementById(nodeId);
    if (!node || node.empty() || node.hasClass("graph-hidden")) {
        return;
    }

    const animate = options.animate !== false;
    const centerOnly = Boolean(options.centerOnly);
    const preserveSearch = Boolean(options.preserveSearch || state.searchTerm);
    state.focusedId = nodeId;

    cy.batch(() => {
        cy.elements().removeClass("graph-focus graph-faded");
        const targetSet = centerOnly ? node : node.closedNeighborhood();
        targetSet.addClass("graph-focus");
        cy.elements().difference(targetSet).not(node).addClass("graph-faded");
    });

    if (centerOnly) {
        if (animate) {
            cy.animate({ fit: { eles: node, padding: 120 }, duration: 360 });
        } else {
            cy.fit(node, 120);
        }
    } else {
        const neighborhood = node.closedNeighborhood();
        if (animate) {
            cy.animate({ fit: { eles: neighborhood, padding: 90 }, duration: 360 });
        } else {
            cy.fit(neighborhood, 90);
        }
    }

    if (!preserveSearch) {
        cy.nodes().removeClass("graph-search-dim");
        cy.edges().removeClass("graph-search-dim");
    }

    if (options.notify !== false && state.dotNetRef) {
        state.dotNetRef.invokeMethodAsync("OnGraphNodeFocused", buildNodeDetail(node));
    }

    syncGraphState(containerId);
}

function resetFocus(containerId) {
    const state = getState(containerId);
    clearInteractionClasses(state.cy);
    state.focusedId = `entity-${state.payload?.rootEntityId ?? ""}`;
    if (state.focusedId) {
        focusNode(containerId, state.focusedId, { animate: false, centerOnly: true, notify: false, preserveSearch: Boolean(state.searchTerm) });
    }

    syncGraphState(containerId);
}

function buildNodeDetail(node) {
    return {
        id: node.id(),
        kind: normalizeText(node.data("kind")),
        title: normalizeText(node.data("title")),
        subtitle: normalizeText(node.data("subtitle")),
        meta: normalizeText(node.data("meta")),
        entityId: normalizeText(node.data("entityId")),
        claimId: normalizeText(node.data("claimId")),
        sourceDocumentTitle: normalizeText(node.data("sourceDocumentTitle")),
        sourceUrl: normalizeText(node.data("sourceUrl")),
        claimQuote: normalizeText(node.data("claimQuote")),
        entityCategory: normalizeText(node.data("entityCategory")),
        entityJurisdiction: normalizeText(node.data("entityJurisdiction")),
        entityRiskLabel: normalizeText(node.data("entityRiskLabel")),
        entityRiskScore: Number(node.data("entityRiskScore") ?? 0),
        entitySummary: normalizeText(node.data("entitySummary")),
        entityAliases: Array.isArray(node.data("entityAliases")) ? node.data("entityAliases") : [],
        entityTags: Array.isArray(node.data("entityTags")) ? node.data("entityTags") : [],
        entityClaims: Array.isArray(node.data("entityClaims")) ? node.data("entityClaims") : [],
        entityRelationships: Array.isArray(node.data("entityRelationships")) ? node.data("entityRelationships") : [],
        entitySourceDocuments: Array.isArray(node.data("entitySourceDocuments")) ? node.data("entitySourceDocuments") : [],
        ownershipChainId: normalizeText(node.data("ownershipChainId")),
        ownershipChainSummary: normalizeText(node.data("ownershipChainSummary")),
        ownershipRole: normalizeText(node.data("ownershipRole")),
        ownershipDepth: Number(node.data("ownershipDepth") ?? 0),
        ownershipControlScore: Number(node.data("ownershipControlScore") ?? 0),
        ownershipConfidenceScore: Number(node.data("ownershipConfidenceScore") ?? 0),
        ownershipEstimatedOwnershipPercentage: node.data("ownershipEstimatedOwnershipPercentage") ?? null,
        ownershipStepLabel: normalizeText(node.data("ownershipStepLabel")),
        ownershipCanExpandPath: Boolean(node.data("ownershipCanExpandPath")),
        ownershipIsLikelyUbo: Boolean(node.data("ownershipIsLikelyUbo")),
        ownershipIsControlVehicle: Boolean(node.data("ownershipIsControlVehicle")),
        canExpand: Boolean(node.data("canExpand")),
        canOpenDossier: Boolean(node.data("canOpenDossier"))
    };
}

function buildGraphSnapshot(containerId) {
    const state = getState(containerId);
    return {
        graph: state.cy.json(true),
        filters: state.filters,
        payload: state.payload,
        searchTerm: state.searchTerm,
        focusedId: state.focusedId,
        labelOffsets: Object.fromEntries(state.labelOffsets.entries()),
        generatedAt: new Date().toISOString()
    };
}

function collectVisibleNodesAndEdges(containerId) {
    const state = getState(containerId);
    const nodes = state.cy.nodes().filter((node) => !node.hasClass("graph-hidden"));
    const edges = state.cy.edges().filter((edge) => !edge.hasClass("graph-hidden"));
    return { nodes, edges };
}

function buildSvg(containerId) {
    const state = getState(containerId);
    const { container, labelOffsets } = state;
    const width = container.clientWidth || 1200;
    const height = container.clientHeight || 720;
    const { nodes, edges } = collectVisibleNodesAndEdges(containerId);
    const positions = new Map(nodes.map((node) => [node.id(), node.renderedPosition()]));

    const edgeLines = edges.map((edge) => {
        const source = positions.get(edge.data("source"));
        const target = positions.get(edge.data("target"));
        if (!source || !target) {
            return "";
        }

        const kind = edge.data("kind");
        const stroke = kind === "document" ? "#818cf8" : kind === "claim" ? "#f43f5e" : "#38bdf8";
        const dash = kind === "document" ? ' stroke-dasharray="8 6"' : kind === "claim" ? ' stroke-dasharray="4 5"' : "";
        return `<line x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}" stroke="${stroke}" stroke-width="2" marker-end="url(#graph-arrow)"${dash} />`;
    }).filter(Boolean);

    const nodeSprites = nodes.map((node) => {
        const position = node.renderedPosition();
        const kind = node.data("kind");
        const fill = kind === "entity" ? "#1d4ed8" : kind === "document" ? "#1e1b4b" : kind === "claim" ? "#3f1d2e" : "#0f172a";
        const stroke = kind === "entity" ? "#38bdf8" : kind === "document" ? "#818cf8" : kind === "claim" ? "#f43f5e" : "#38bdf8";
        const offset = labelOffsets.get(node.id()) || { x: 0, y: 0 };

        return `
            <g>
                <rect x="${position.x - 78}" y="${position.y - 41}" rx="18" ry="18" width="156" height="82" fill="${fill}" stroke="${stroke}" stroke-width="2" />
                <text x="${position.x}" y="${position.y - 2}" fill="#f8fafc" font-size="12" font-weight="700" text-anchor="middle">${escapeHtml(node.data("title") || node.data("label") || node.id())}</text>
                <text x="${position.x}" y="${position.y + 14}" fill="#cbd5e1" font-size="10" text-anchor="middle">${escapeHtml(node.data("subtitle") || "")}</text>
                <text x="${position.x}" y="${position.y + 28}" fill="#94a3b8" font-size="9" text-anchor="middle">${escapeHtml(node.data("meta") || "")}</text>
                <text x="${position.x + offset.x}" y="${position.y + offset.y}" fill="#7dd3fc" font-size="9" font-style="italic" text-anchor="middle">${escapeHtml(node.id())}</text>
            </g>`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="graph-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#08111f"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <marker id="graph-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="#94a3b8"></path>
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="url(#graph-bg)" />
  ${edgeLines.join("\n")}
  ${nodeSprites.join("\n")}
</svg>`;
}

function toCsv(containerId) {
    const state = getState(containerId);
    const { cy, payload, searchTerm, filters, focusedId } = state;
    const visibleNodes = cy.nodes().filter((node) => !node.hasClass("graph-hidden"));
    const visibleEdges = cy.edges().filter((edge) => !edge.hasClass("graph-hidden"));

    const rows = [
        ["record_type", "id", "label", "kind", "source", "target", "details"].join(","),
        ["summary", payload.rootEntityId || "", "Root dossier", "entity", "", "", `search=${searchTerm || ""} | focused=${focusedId || ""}`].map(escapeCsv).join(","),
        ["summary", "filters", "Graph filters", "summary", "", "", `relationships=${filters.showRelationships}; documents=${filters.showDocuments}; claims=${filters.showClaims}`].map(escapeCsv).join(","),
        ["summary", "nodes", "Visible nodes", "summary", "", "", `${visibleNodes.length}`].map(escapeCsv).join(","),
        ["summary", "edges", "Visible edges", "summary", "", "", `${visibleEdges.length}`].map(escapeCsv).join(",")
    ];

    visibleNodes.forEach((node) => {
        rows.push([
            "node",
            node.id(),
            node.data("title") || node.data("label") || "",
            node.data("kind"),
            "",
            "",
            [node.data("subtitle"), node.data("meta")].filter(Boolean).join(" | ")
        ].map(escapeCsv).join(","));
    });

    visibleEdges.forEach((edge) => {
        rows.push([
            "edge",
            edge.id(),
            edge.data("label") || "",
            edge.data("kind"),
            edge.data("source"),
            edge.data("target"),
            ""
        ].map(escapeCsv).join(","));
    });

    return rows.join("\n");
}

function triggerDownload(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

function toPngPromise(containerId, filename) {
    const graph = getState(containerId).cy;
    return graph.png({
        output: "blob-promise",
        full: true,
        bg: "#08111f"
    }).then((blob) => {
        downloadBlob(filename || "osint-graph.png", blob);
        return true;
    });
}

function destroyGraph(containerId) {
    const state = graphRegistry.get(containerId);
    if (!state) {
        return;
    }

    state.resizeObserver?.disconnect();
    state.cy?.destroy();
    graphRegistry.delete(containerId);
}

export function exportPng(containerId, filename) {
    return toPngPromise(containerId, filename);
}

export function exportSvg(containerId, filename) {
    triggerDownload(filename || "osint-graph.svg", buildSvg(containerId), "image/svg+xml");
    return true;
}

export function exportCsv(containerId, filename) {
    triggerDownload(filename || "osint-graph.csv", toCsv(containerId), "text/csv");
    return true;
}

export function exportJson(containerId, filename) {
    triggerDownload(filename || "osint-graph.json", JSON.stringify(buildGraphSnapshot(containerId), null, 2), "application/json");
    return true;
}

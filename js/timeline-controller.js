import { createTimelineController } from "./timeline-visualization.js";

const timelineRegistry = new Map();

function getContainer(elementId) {
    const container = document.getElementById(elementId);
    if (!container) {
        throw new Error(`Timeline container not found: ${elementId}`);
    }

    return container;
}

function getController(elementId) {
    const controller = timelineRegistry.get(elementId);
    if (!controller) {
        throw new Error(`No timeline is registered for container ${elementId}`);
    }

    return controller;
}

export async function render(elementId, items, options, dotNetHelper, groups) {
    const container = getContainer(elementId);
    if (timelineRegistry.has(elementId)) {
        timelineRegistry.get(elementId).destroy();
        timelineRegistry.delete(elementId);
    }

    const controller = createTimelineController(container, items, options, dotNetHelper, groups);
    await controller.init();
    timelineRegistry.set(elementId, controller);
    return true;
}

export function destroy(elementId) {
    if (!timelineRegistry.has(elementId)) {
        return false;
    }

    timelineRegistry.get(elementId).destroy();
    timelineRegistry.delete(elementId);
    return true;
}

export function addItem(elementId, item) {
    const controller = getController(elementId);
    controller.items = controller.items.concat([item]);
    controller.allItems = controller.items.slice();
    controller.applyFilters(true);
    return true;
}

export function updateItem(elementId, item) {
    const controller = getController(elementId);
    controller.items = controller.items.map((current) => current.id === item.id ? item : current);
    controller.allItems = controller.items.slice();
    controller.applyFilters(true);
    return true;
}

export function removeItem(elementId, itemId) {
    const controller = getController(elementId);
    controller.items = controller.items.filter((current) => current.id !== itemId);
    controller.allItems = controller.items.slice();
    controller.applyFilters(true);
    return true;
}

export function setWindow(elementId, start, end) {
    getController(elementId).setWindow(start, end);
    return true;
}

export function fit(elementId) {
    getController(elementId).fit();
    return true;
}

export function filterByGroups(elementId, groupIds) {
    getController(elementId).filterByGroups(groupIds);
    return true;
}

export function filterByDateRange(elementId, startDate, endDate) {
    getController(elementId).filterByDateRange(startDate, endDate);
    return true;
}

export function clearFilters(elementId) {
    getController(elementId).clearFilters();
    return true;
}

export function getFilterState(elementId) {
    return getController(elementId).getFilterState();
}

window.TimelineVisualization = {
    render,
    destroy,
    addItem,
    updateItem,
    removeItem,
    setWindow,
    fit,
    filterByGroups,
    filterByDateRange,
    clearFilters,
    getFilterState
};

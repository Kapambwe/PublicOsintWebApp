# Timeline Visualization Filter Guide

This guide explains the timeline filtering and window controls used by the Public OSINT dossier timeline.

## Features

1. Group filtering by one or more timeline groups.
2. Date range filtering by start and/or end date.
3. Combined filtering across groups and date range.
4. Filter state inspection and clearing.
5. Time-scale window controls for day, week, month, and year views.

## JavaScript API

```javascript
TimelineVisualization.filterByGroups('myTimeline', ['Court Judgment', 'Official Record']);
TimelineVisualization.filterByDateRange('myTimeline', '2024-01-01', '2024-12-31');
TimelineVisualization.clearFilters('myTimeline');
const state = TimelineVisualization.getFilterState('myTimeline');
```

## Notes

- Group filters are inclusive and can be combined.
- Date range filtering uses the item `start` date.
- Filters hide items from the timeline; they do not delete data.
- The .NET helper receives filter change callbacks when the visible set changes.

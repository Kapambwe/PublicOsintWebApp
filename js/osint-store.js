window.osintStore = {
    getJson: function (key) {
        return window.localStorage.getItem(key);
    },
    setJson: function (key, value) {
        window.localStorage.setItem(key, value);
    },
    downloadText: function (filename, content, mimeType) {
        const blob = new Blob([content ?? ""], { type: mimeType || "text/plain" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename || "osint-export.txt";
        anchor.rel = "noopener";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    },
    exportPdf: function (title, htmlBody) {
        const printWindow = window.open("", "_blank");
        if (!printWindow) {
            alert("Please allow popups to export PDF dossiers.");
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${title || "AFRI-INTELLIGENCE Dossier Export"}</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; line-height: 1.5; padding: 2rem; max-width: 900px; margin: 0 auto; }
                    .pdf-header { border-bottom: 3px solid #0284c7; padding-bottom: 1rem; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center; }
                    .pdf-title { font-size: 1.8rem; font-weight: 800; color: #0284c7; margin: 0; }
                    .pdf-meta { font-size: 0.85rem; color: #64748b; text-align: right; }
                    .pdf-section { margin-bottom: 2rem; page-break-inside: avoid; }
                    .pdf-section-h2 { font-size: 1.25rem; font-weight: 700; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 0.5rem; margin-bottom: 1rem; }
                    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
                    th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-size: 0.9rem; }
                    th { background-color: #f1f5f9; font-weight: 700; color: #334155; }
                    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; background: #e2e8f0; color: #334155; }
                    .badge-pep { background: #7c3aed; color: #fff; }
                    .quote-box { background: #f8fafc; border-left: 4px solid #0284c7; padding: 1rem; font-style: italic; margin: 0.75rem 0; }
                    @media print {
                        body { padding: 0; }
                        @page { margin: 1.5cm; }
                    }
                </style>
            </head>
            <body>
                <div class="pdf-header">
                    <div>
                        <h1 class="pdf-title">AFRI-INTELLIGENCE</h1>
                        <div>Official Intelligence Dossier Report</div>
                    </div>
                    <div class="pdf-meta">
                        <div>Generated: ${new Date().toUTCString()}</div>
                        <div>Classification: PUBLIC OSINT</div>
                    </div>
                </div>
                ${htmlBody}
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 500);
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    },
    getPreferredTheme: function () {
        return window.localStorage.getItem("osint.theme.v1") || "dark";
    },
    setPreferredTheme: function (theme) {
        const targetTheme = (theme === "light" || theme === "dark") ? theme : "dark";
        window.localStorage.setItem("osint.theme.v1", targetTheme);
        document.documentElement.setAttribute("data-theme", targetTheme);
        document.body.setAttribute("data-theme", targetTheme);
        
        // Notify leaflet maps of tile layer swap if active
        if (window.onOsintThemeChanged) {
            window.onOsintThemeChanged(targetTheme);
        }
        return targetTheme;
    }
};

// Initialize theme on load
(function () {
    const savedTheme = window.localStorage.getItem("osint.theme.v1") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
    document.body.setAttribute("data-theme", savedTheme);
})();

// Global keyboard shortcut listener for / and Ctrl+K keys
document.addEventListener("keydown", function (event) {
    if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
        const searchInput = document.getElementById("hero-search-input");
        if (searchInput) {
            event.preventDefault();
            searchInput.focus();
            searchInput.select();
        }
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        const paletteBtn = document.getElementById("cmd-palette-toggle");
        if (paletteBtn) {
            paletteBtn.click();
        }
    }
});

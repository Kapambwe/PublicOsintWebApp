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
    }
};

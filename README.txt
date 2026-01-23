INSTRUCTIONS:

1. CHART.JS:
   You need to download the Chart.js library manually because Python didn't fetch it.
   - Go to: https://cdn.jsdelivr.net/npm/chart.js
   - Right Click -> Save As...
   - Save it inside this folder as "chart.js"

2. ICONS:
   Create a folder named "icons".
   Add two PNG images inside: "icon-192.png" and "icon-512.png".

3. RUNNING:
   Open this folder in VS Code.
   Right click "index.html" -> Open with Live Server.

TREE STRUCTURE:

/loan-calculator
  ├── index.html          (The user interface)
  ├── style.css           (The look and feel)
  ├── app.js              (The logic and calculation)
  ├── sw.js               (Service Worker for offline capabilities)
  ├── manifest.json       (App metadata for installation)
  ├── chart.js
  └── icons/              (Folder for app icons)
      ├── icon-192.png
      └── icon-512.png

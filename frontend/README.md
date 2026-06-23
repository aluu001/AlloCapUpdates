# AlloCap document Comparison Workspace (Frontend UI)

Welcome to the **AlloCap Document Comparison Workspace** frontend console. This React application is built on top of TypeScript, Vite, and HSL variables, styled in a premium, modern enterprise light-themed consulting interface matching the Public Consulting Group (PCG) visual guidelines.

It serves as the user-facing command center for uploading, validating, comparing, auditing, and publishing document differences, utilizing the Gemini 3.5 Flash backend pipeline.

---

## 💰 Comparison Modes & Cost Benchmarks

AlloCap is optimized for both speed and financial efficiency. Users can choose from three distinct comparison modes to balance detail resolution against API token costs:

| Comparison Mode | Core Functionality | Detailed Change Cards | Target Audience | Cost Profile |
| :--- | :--- | :---: | :--- | :--- |
| **Summary of Changes** | Structured 1-to-2 page executive write-up of material, financial, and compliance changes. | ❌ No | C-Suite & Executives | **Negligible** (Fraction of a cent) |
| **Standard (Fast)** | Fast, single-pass visual & textual comparison of the entire document. | ✔️ Yes | General Auditing | **Very Low** (Fraction of a cent) |
| **Thorough (Page-by-Page)** | Exhaustive page-by-page split comparison capturing character-level modifications and document layer data. | ✔️ Yes | Legal & Compliance | **Linear Scale** (~$1.00–$1.50 per 78 pages) |

### 🔍 Thorough Mode Cost Benchmark & Scale
To achieve ultimate precision on long documents (e.g., contracts, lease agreements, policies), **Thorough Mode** locally splits PDFs and uploads them page-by-page. This converts a quadratic $O(N^2)$ token overhead into a linear $O(N)$ token cost pipeline:
* **Key Metric**: Auditing a **78-page document** in Thorough Mode costs approximately **$1.00 to $1.50**.
* **Scaling**: You can reliably assume a linear scale-up of cost based on document page count (e.g. ~$0.015 to $0.02 per page).
* **Deep Scanning**: In addition to standard character-level edits, this cost includes extracting and parsing **inline comments, editor annotations, and sign-offs** directly within the hidden document layers—guaranteeing no detail is omitted.

---

## 🎨 Design System & Visual Aesthetics

The AlloCap UI follows strict corporate consulting aesthetics. Plain layouts, dark mesh filters, and generic colors have been replaced by a premium corporate look:

* **Primary Cobalt Navy (`#015294`)**: Header background, Greek column emblems, active selection toggles, and main action triggers.
* **Secondary Cyber Teal (`#007E9E`)**: Inline warning labels, assistant badges, and active subcomponents.
* **Accent Emerald Green (`#21874c`)**: Positive delta indicators, download actions, and safe-state tags.
* **Clean Neutral Palette**: High-contrast white workspace cards with light border outlines (`#cbd5e1`/`#e2e8f0`) on a soft background (`#f8fafc`).
* **Enhanced Typography**: Set in `'Raleway'` for core corporate headers and `'Plus Jakarta Sans'` for document comparison prose blocks.

---

## 🚀 Key Interface Features

### 1. Unified 3-Segment Toggle Selector
Allows switching between **Summary of Changes**, **Standard (Fast)**, and **Thorough (Page-by-Page)** comparison modes. Active modes are styled in Cobalt Navy with custom drop-shadows, accompanied by an inline description card explaining what each mode does.

### 2. Collapsible Side Panel & Sync Drawer
The left navigation sidebar collapses off-screen to maximize horizontal real estate. The Document Storage drawer slides in lockstep, automatically shifting its position dynamically between `240px` (sidebar open) and `0px` (sidebar collapsed).

### 3. Word-Level Strikethrough Diff Engine
Calculates word additions and deletions using a token-based LCS diff algorithm:
* **Deleted segments** are formatted in soft red with a strikethrough.
* **Added segments** are highlighted in soft yellow with brown text, mimicking a physical highlighter.

### 4. Interactive Report Publisher
- Renders an A4/Letter simulated paper document containing metadata tables, sequential section numbers, and executive write-ups.
- Omit toggles and empty modification tables automatically when running in **Summary of Changes** mode, outputting a clean 1-to-2 page executive report.
- Includes a **SharePoint & MS Word Copy Action** that compiles inline-styled HTML blocks, preserving text highlight colors when pasted directly into office suites.
- Embeds print styles (`@media print`) that hide all settings panels, navigation menus, and drawers during PDF export.

### 5. AlloCap AI Chat Assistant
A text-based, icon-less conversational chatbot integrated directly under each card in the compare view. Runs isolated chat threads per difference card, with preset prompt pills for checking financial liability, operational timelines, and legal risks.

### 6. Developer Integration Suite
Includes a developer panel rendering:
* **JSON Ingestion Payload**: Structured JSON representing the complete metadata, summary, and changes.
* **PostgreSQL Migration DML**: Transaction-wrapped script (`BEGIN;` / `COMMIT;`) that creates PostgreSQL inserts for database syncing, automatically escaping single quotes.

---

## 🛠️ Getting Started

### Prerequisites
Make sure you have Node.js (v18+) and npm installed.

### Installation
Run this command from the `frontend` folder to install dependencies:
```bash
npm install
```

### Run Development Server
To launch the frontend with hot-reload:
```bash
npm run dev
```

### Build Production Bundle
To build the static application files for hosting or validation:
```bash
npm run build
```
The compiled files will be outputted to the `dist/` folder.

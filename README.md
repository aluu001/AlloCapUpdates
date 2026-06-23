# AlloCapUpdates - AI Document Comparison System

**AlloCapUpdates** is a premium, modern, and intuitive enterprise document comparison platform. Powered by **Google Gemini 3.5 Flash**, it enables visual and textual auditing of complex agreements (e.g., contracts, lease agreements, policies) up to 500+ pages.

The system features a bespoke light-themed consulting interface matching the Public Consulting Group (PCG) styling guidelines, a collapsible sidebar and storage drawer workspace, per-clause chatbot assistant dialogs, and a simulated A4 publisher panel with rich copy-pasting for SharePoint and MS Word.

---

## 💰 Comparison Modes & Cost Benchmarks

AlloCap balances auditing precision with API token cost management by providing three comparison profiles:

| Comparison Mode | Core Functionality | Detailed Change Cards | Target Audience | Cost Profile |
| :--- | :--- | :---: | :--- | :--- |
| **Summary of Changes** | High-level, structured 1-to-2 page executive report summarizing material, financial, and compliance changes. | ❌ No | C-Suite & Executives | **Negligible** (Fraction of a cent) |
| **Standard (Fast)** | Fast, single-pass visual & textual comparison of the entire document. | ✔️ Yes | General Auditing | **Very Low** (Fraction of a cent) |
| **Thorough (Page-by-Page)** | Exhaustive page-by-page scan capturing character-level modifications and document layer data. | ✔️ Yes | Legal & Compliance | **Linear Scale** (~$1.00–$1.50 per 78 pages) |

### 🔍 Thorough Mode Cost & Performance Benchmarks
To resolve LLM attention drop-offs and context length limits on large files, **Thorough Mode** locally splits PDFs and uploads pages one-by-one. This converts a quadratic $O(N^2)$ token overhead into a linear $O(N)$ token cost pipeline:
* **Cost Metric**: Auditing a **78-page document** in Thorough Mode costs approximately **$1.00 to $1.50**, scaling linearly from there at around **$0.015 to $0.02 per page**.
* **Speed Metric**: Complete execution on a **78-page document** takes approximately **5 to 7 minutes** due to the batch-concurrency page upload queue.
* **Auditing Rigor**: This mode runs with extreme resolution, catching adjustments all the way down to **single-letter updates and typos**. Crucially, it parses **inline comments, editor annotations, and sign-offs** directly within the hidden document layers—guaranteeing zero omissions.

---

## 🚀 Key Features & Subsystems

### 1. Three-Segment Selector Toggle
Enables quick switching between **Summary of Changes**, **Standard (Fast)**, and **Thorough (Page-by-Page)** modes. Styled in Cobalt Navy with custom shadows, accompanied by a dynamic inline card describing each mode.

### 2. Collapsible Navigation Sidebar & Sync Drawer
The left navigation sidebar collapses off-screen to maximize horizontal real estate. The Document Storage drawer slides in lockstep, dynamically transitioning its alignment between `240px` (sidebar open) and `0px` (sidebar collapsed).

### 3. Word-Level Strikethrough Diff Engine
Calculates word additions and deletions using a token-based LCS diff algorithm:
* **Deleted segments** are formatted in soft red with a strikethrough.
* **Added segments** are highlighted in soft yellow with brown text, resembling a physical highlighter.
* Typography is rendered in `'Plus Jakarta Sans'` prose font at `12.5px` for readability.

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

## 🎨 Design System & Color Palette
The AlloCap UI follows strict corporate consulting aesthetics:
* **Primary Cobalt Navy (`#015294`)**: Header background, Greek column emblems, active selection toggles, and main action triggers.
* **Secondary Cyber Teal (`#007E9E`)**: Inline warning labels, assistant badges, and active subcomponents.
* **Accent Emerald Green (`#21874c`)**: Positive delta indicators, download actions, and safe-state tags.
* **Clean Neutral Palette**: High-contrast white workspace cards with light border outlines (`#cbd5e1`/`#e2e8f0`) on a soft background (`#f8fafc`).
* **Enhanced Typography**: Set in `'Raleway'` for core corporate headers and `'Plus Jakarta Sans'` for document comparison prose blocks.

---

## 📦 Monorepo Architecture

This repository is structured as follows:
* **`backend/`**: Express + TypeScript server interfacing with the Google GenAI Files API.
* **`frontend/`**: Vite + React + TypeScript workspace styled with premium Vanilla CSS.
* **`backend/storage/`**: Local directory for temporary and persistent document uploads, facilitating original file downloads.

---

## 🛠️ Setup & Running the Application

### Prerequisites
- Node.js (v18.0.0 or higher recommended)
- A Google Gemini API Key

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `backend/` directory:
   ```env
   PORT=5001
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
4. Start the server:
   - **Development**: `npm run dev`
   - **Production**: `npm run build && npm start`

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:5173` in your browser.

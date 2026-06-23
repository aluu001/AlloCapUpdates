# Project Updates: AlloCapUpdates AI Document Comparison System

This document provides a comprehensive history of the milestones, layout redesigns, branding integrations, and backend pipeline enhancements implemented in the **AlloCapUpdates** project.

---

## 1. Core Architecture & Backend Engine
* **Technology Stack**: Set up a Node.js + Express + TypeScript server backend paired with a React + Vite + TypeScript frontend.
* **Gemini Integration**: Built a connection to the Google Gen AI SDK utilizing `gemini-3.5-flash` for high-speed textual and visual analysis.
* **Page-by-Page Batched Pipeline**: Implemented a batch-concurrency loop (concurrency limit = `3`) that queries page counts first and scans documents page-by-page. This eliminates LLM output context limits and attention drops in large agreements, dynamically aggregating text, table, and visual changes.
* **Dual Comparison Modes**:
  * **Standard (Fast)**: Single-pass overall audit ideal for quick analysis (~10–15 seconds).
  * **Thorough (Page-by-Page)**: Exhaustive page-by-page scan for character-level precision.
* **Thorough Mode Page-Splitting & Token Optimization**: Re-engineered Thorough mode to locally split PDFs using `pdf-lib` and compare single-page PDFs on-the-fly, reducing input token complexity from quadratic $O(N^2)$ to linear $O(N)$ and decreasing input token costs by up to 98% for long documents.
* **Pre-Comparison Compatibility Validator**: Integrated a Gemini-powered document alignment step that scans Page 1 headers, parties, and content to block unrelated files (e.g. comparing a lease agreement to a recipe) with a structured response schema.

---

## 2. Modern Light-Themed Enterprise Interface
* **Brand Styling**: Modernized the app stylesheet with the **PCG (Public Consulting Group)** design language, replacing the dark neon glassmorphism with a premium enterprise light theme.
* **Color System**: Mapped color assets to exact HSL variables:
  * **Electric Cobalt Navy** (`#015294`) for primary headers, logo, and active selectors.
  * **Cyber Teal** (`#007E9E`) for secondary accents.
  * **Emerald Green** (`#21874c`) for low-severity highlights.
* **Collapsible Layout**: Added a header hamburger menu button to collapse the left navigation sidebar. The storage drawer slides in sync to maximize screen space.
* **Direct File Dropdowns**: Replaced abstract document slot cards with direct, searchable select dropdown menus in the workspace, with automated conflict checking.

---

## 3. High-Precision Diff Engine
* **Word-Level Deltas**: Developed a token-based Longest Common Subsequence (LCS) algorithm to compute exact word additions and deletions.
* **Visual Highlights**: 
  * **Deleted text** is formatted in soft red (`#fee2e2`/`#b91c1c`) with line-through prose.
  * **Added text** is highlighted in high-contrast soft yellow (`#fef08a`/`#713f12`) representing a physical auditor's marker.
* **Typography**: Styled comparison diffs in `'Plus Jakarta Sans'` prose font at `12.5px` to match legal lease agreements and documents.
* **Callout Header Blocks**: Wrapped change descriptions in left-bordered severity callouts (navy, teal, green) for rapid scanning.

---

## 4. Audit Report Publisher
* **Simulated Paper Sheet**: Built an A4/Letter simulated paper document panel featuring a high-contrast executive header, metadata table, and dynamic change diff sections.
* **Dynamic Section Numbering**: Built a real-time header counter that sequentially updates section titles (e.g., Section 2, Section 3) if preceding blocks are toggled off by the user.
* **Settings Customizer**: Created a sidebar configuration form to edit the report title, compare date, auditor notes, and toggle the visibility of individual change tables.
* **SharePoint & Word Copy Pipeline**: Implemented a rich-text clipboard exporter that compiles inline-styled HTML blocks, preserving highlights and table styling when pasted into MS Word or SharePoint Wiki pages.
* **Raw GFM Markdown**: Handled Copy and Download actions for raw GitHub-Flavored Markdown reports.

---

## 5. AlloCap AI & Obligation Analytics
* **Obligation Shifts**: Programmed the comparison engine to classify the direction of shifts (e.g., *Burden Increased*, *Obligation Neutral*) and semantic categories (*Financial Liability*, *Operational Timeline*), rendering them in parentheses inside the potential impact header.
* **Contextual Chatbot Explainer**: Placed a text-based, icon-less chatbot panel (AlloCap AI) underneath each difference card. Users can ask queries on a per-card basis using isolated message histories.
* **Suggested Prompt Pills**: Embedded preset quick-action prompt buttons to instantly query AlloCap AI about operational risk or legal liability.

---

## 6. Developer Integration Suite
* **Structured JSON Payload**: Added a visual tab showing the raw JSON payload with full run metadata, overall summary, and categorized text/table/visual change logs.
* **PostgreSQL Migration Script**: Added a transactional DML script (`BEGIN;` / `COMMIT;`) that generates SQL insert scripts for `document_comparisons` and `comparison_change_entries` tables, automatically escaping single-quotes.
* **Prepared By Anthony Luu**: Replaced all database `risk_rating` inputs with `prepared_by: 'Anthony Luu'` to match report styles.

---

## 7. PDF Export & Error Resiliency
* **Print-Isolated PDF Engine**: Configured print CSS variables to set `.report-paper-page` to `display: none !important` by default, forcing only `#printable-report` to `display: block !important`. Hitting "Export to PDF" from *any* active tab prints only the formal HTML sheet, hiding chatbot controls and developer tools.
* **Inline Error Warning Card**: Switched out standard browser alert prompts with a dismissible warning card inside the comparison panel layout, displaying clean error reasons for file mismatches or offline issues.

---

## 8. Chronological Timeline of Updates

Here is a detailed, day-by-day record of all commits and developments made to the codebase, tracking exactly when each feature was implemented.

### 📅 May 28, 2026: Foundation & Visual Modernization
* **Initial Fullstack Setup**: Committed the base Node.js + Express backend and Vite + React frontend boilerplate integrated with Gemini Files API.
* **Stepping Loader & Verbatim Diffs**: Added the detailed loading check-stepper interface and built the initial side-by-side verbatim text extraction delta panels.
* **Streaming Thinking Console**: Enabled Gemini API thought streaming and designed the light-theme corporate console styling to render thinking tokens in real-time with custom markdown and a flashing cursor caret.
* **Side-by-Side Table & Visual Diffs**: Upgraded the prompt models to request before/after visual state representations, rendering table cell modifications and layout shifts in adjacent cards.
* **Visual Theme Redesign (AlloCap 2.0)**: Transitioned UI components to the modern corporate light theme using AlloCap brand HSL colors (Cobalt Navy, Cyber Teal, and Emerald Green).
* **Storage Drawer & Condensed Layouts**: Replaced large file elements with condensed file rows and added file deletion capabilities.
* **Collapsible Navigation Sidebar**: Supported collapsing the entire left sidebar using a hamburger header button, transitioning the file storage drawer in sync with it.
* **Direct Dropdown Slots**: Reconfigured Slot A & Slot B selection slots to contain direct select dropdown menus for instantly selecting files.
* **Display Name Prefix Cleanup**: Modified the backend display name generation to strip Multer-injected timestamps and random digits.
* **Word-Level Diff Engine**: Developed the token-based LCS diff algorithm to highlight deleted words (soft red) and added words (soft teal/yellow) in `'Plus Jakarta Sans'` prose font, wrapping descriptions in left severity borders.

### 📅 June 12, 2026: Report Publisher & Developer Integration
* **Audit Report Publisher**: Implemented the formal simulated A4 sheet preview page with customized headers and metadata tables, along with settings controllers in the sidebar.
* **SharePoint Export Exporter**: Built the rich HTML clipboard copy pipeline to format diff highlights and metadata tables for direct pasting into Microsoft Word and SharePoint wikis.
* **Preserved Print Colors**: Added CSS media overrides (`print-color-adjust: exact`) to force browsers to preserve soft-red and yellow text highlights during PDF print generation.
* **Rendered Markdown Viewer**: Replaced the raw markdown block with a beautifully parsed, styled, and read-only markdown document view.
* **Contextual Potential Impacts**: Renamed recommendations to potential impacts, enforcing exactly two sentences of compliance/liability/risk impact from Gemini.
* **Dynamic Section Numbering**: Built the real-time sequential section numbering system for HTML, copied rich-text, and GFM markdown exports.
* **Comparison Terminology Normalization**: Replaced all "Audit" terms with "Comparison" and resolved the naming convention mismatch by renaming PCC references to PCG (Public Consulting Group).
* **Database Integration Dashboard**: Added JSON ingestion payloads and PostgreSQL transactional script visualizers, stacking them vertically for clean horizontal reading.

### 📅 June 22, 2026: Pipeline Scale, Safety, & Usability
* **Page-by-Page Batched Pipeline (Thorough Mode)**: Re-architected `compareAgent.ts` to query page counts and scan pages concurrently (limit = 3), bypassing LLM output tokens limit for large files.
* **Thorough Mode Local PDF Page-Splitting (Strategy A)**: Integrated `pdf-lib` package and built local single-page splitting and cleanup helper functions. Refactored Thorough mode loop to upload and compare single-page PDF files on-the-fly, deleting them from Gemini Files API immediately after comparison to keep storage clean and minimize input token overhead.
* **Strict Document Alignment Validator**: Added a structured schema-checked pre-verification validator to verify that uploaded documents are versions/revisions of the exact same agreement, rejecting mismatched files. Validates on Page 1 to save tokens.
* **PDF Tab Print Isolation**: Modified print stylesheets in `index.css` to hide all screen layouts (`display: none !important`) by default, forcing only `#printable-report` to display print.
* **Risk Rating Cleanup**: Removed risk ratings and replaced them with "Prepared By: Anthony Luu" across HTML, Markdown, Copy HTML, and JSON/SQL database formats.
* **Workspace Inline Warning Card**: Replaced generic browser alert popups with a styled, dismissible warning banner inside the comparison dashboard.

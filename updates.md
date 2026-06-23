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
* **Pre-Comparison Compatibility Validator**: Integrated a Gemini-powered document alignment step that scans headers, parties, and content to block unrelated files (e.g. comparing a lease agreement to a recipe) with a structured response schema.

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

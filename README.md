# AlloCapUpdates - AI Document Comparison System

AlloCapUpdates is a premium, modern, and intuitive web application that uses AI agents powered by **Google Gemini 3.5 Flash** to perform detailed visual and textual comparisons of large documents (up to 500+ pages).

The system analyzes and highlights changes in:
- **Content**: Additions, deletions, and modifications of text.
- **Table Structure**: Layout shifts, added/removed rows and columns, and modified cell data.
- **Visuals & Images**: Diagram updates, logo replacements, chart edits, and structural page layouts.

---

## Repository Architecture

This is a monorepo structured as follows:
- **`backend/`**: Node.js + Express + TypeScript service that interfaces with the Google GenAI Files API.
- **`frontend/`**: Vite + React + TypeScript workspace styled with premium Vanilla CSS.
- **`backend/storage/`**: Local directory for storing raw uploaded documents, facilitating high-fidelity downloads of original files.

---

## Setup & Running the Application

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
4. Start the backend server:
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
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open the displayed URL (typically `http://localhost:5173`) in your browser to view the sleek UI.

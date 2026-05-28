import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  ArrowRight, 
  RefreshCw, 
  Download, 
  AlertTriangle, 
  MessageSquare, 
  X, 
  Send,
  FileCheck,
  LayoutGrid,
  Table,
  Layers,
  Sparkles
} from 'lucide-react';

const API_BASE = 'http://localhost:5001/api';

interface DocumentFile {
  filename: string;
  displayName: string;
  size: number;
  uploadedAt: string;
}

interface TextChange {
  page: string;
  type: string;
  description: string;
  originalText?: string;
  revisedText?: string;
  severity: 'low' | 'medium' | 'high';
}

interface TableChange {
  page: string;
  tableName: string;
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

interface VisualChange {
  page: string;
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

interface ComparisonReport {
  overallSummary: string;
  riskRating: 'low' | 'medium' | 'high';
  textChanges: TextChange[];
  tableChanges: TableChange[];
  visualChanges: VisualChange[];
}

interface ChatMessage {
  role: 'user' | 'agent';
  content: string;
}

// Mock comparison data for demo mode when API Key is missing
const mockReport: ComparisonReport = {
  overallSummary: "A detailed comparison was performed between the two lease agreements. Key modifications include a 15% increase in the security deposit, updated late payment fees, and structural changes to the utility cost breakdown table. The landlord's logo has also been updated, and an additional page layout section was inserted on page 4.",
  riskRating: "medium",
  textChanges: [
    {
      page: "1",
      type: "modified",
      description: "Security deposit amount increased by $300.",
      originalText: "$2,000.00 (Two Thousand Dollars)",
      revisedText: "$2,300.00 (Two Thousand Three Hundred Dollars)",
      severity: "high"
    },
    {
      page: "2",
      type: "modified",
      description: "Late fee grace period shortened.",
      originalText: "Late fees will apply if rent is unpaid by the 5th day of the month.",
      revisedText: "Late fees will apply if rent is unpaid by the 3rd day of the month.",
      severity: "medium"
    },
    {
      page: "5",
      type: "deleted",
      description: "Pet policy lease rider removed.",
      originalText: "Tenant is permitted to keep one domestic cat under 15 lbs on the premises.",
      revisedText: "Clause deleted in revised agreement.",
      severity: "medium"
    },
    {
      page: "6",
      type: "added",
      description: "Indemnification clause added for parking space damages.",
      originalText: "[No clause existed]",
      revisedText: "Tenant agrees to indemnify landlord for any claims arising from parking space usage.",
      severity: "low"
    }
  ],
  tableChanges: [
    {
      page: "3",
      tableName: "Utility Responsibilities Schedule",
      type: "value_modified",
      description: "Electricity billing shifted from Landlord to Tenant.",
      severity: "high"
    },
    {
      page: "3",
      tableName: "Utility Responsibilities Schedule",
      type: "row_added",
      description: "Added a row for High-Speed Fiber Internet fee structure ($50/mo flat fee).",
      severity: "medium"
    }
  ],
  visualChanges: [
    {
      page: "1",
      type: "logo_replaced",
      description: "Landlord logo updated from 'Apex Holdings LLC' to 'Aegis Property Management Group'.",
      severity: "low"
    },
    {
      page: "4",
      type: "layout_shifted",
      description: "Signature block moved from page 5 to page 4 due to compact margins.",
      severity: "low"
    }
  ]
};

export default function App() {
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [fileA, setFileA] = useState<string | null>(null);
  const [fileB, setFileB] = useState<string | null>(null);
  const [report, setReport] = useState<ComparisonReport | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isConfigured, setIsConfigured] = useState(true);

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<'summary' | 'text' | 'tables' | 'visuals'>('summary');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch document lists
  const fetchFiles = async () => {
    try {
      const res = await fetch(`${API_BASE}/files`);
      const data = await res.json();
      if (data.files) {
        setFiles(data.files);
      }
    } catch (err) {
      console.error("Failed to fetch files", err);
    }
  };

  // Check API status
  const checkStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/status`);
      const data = await res.json();
      setIsConfigured(data.isApiConfigured);
    } catch (err) {
      console.error("Failed to check status", err);
      setIsConfigured(false); // Default to false if server isn't running yet
    }
  };

  useEffect(() => {
    checkStatus();
    fetchFiles();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setUploadError("Only PDF documents are supported for now.");
      return;
    }

    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        await fetchFiles();
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        setUploadError(data.error || "Upload failed");
      }
    } catch (err) {
      setUploadError("Server connection error during upload.");
    } finally {
      setUploading(false);
    }
  };

  // Compare documents handler
  const handleCompare = async () => {
    if (!fileA || !fileB) return;

    // Demo Mode trigger if API not configured
    if (!isConfigured) {
      setIsLoading(true);
      setIsDemoMode(true);
      setProgressMsg("Simulating local comparison (Demo Mode)...");
      
      const steps = [
        "Uploading Original File to virtual repository...",
        "Uploading Revised File to virtual repository...",
        "Identifying document sections and layouts...",
        "Comparing clauses, definitions, and formatting...",
        "Generating visual change summary...",
        "Structuring differences into JSON format..."
      ];

      for (let i = 0; i < steps.length; i++) {
        setProgressMsg(steps[i]);
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      setReport(mockReport);
      setChatMessages([
        { role: 'agent', content: "Hello! I am your Comparison Agent. I have successfully analyzed the differences between your two documents. Ask me anything about the changes!" }
      ]);
      setIsLoading(false);
      setProgressMsg('');
      setActiveTab('summary');
      return;
    }

    setIsLoading(true);
    setIsDemoMode(false);
    setProgressMsg("Contacting Gemini Comparison Agent...");

    try {
      // Simulate frontend status steps as request is processed (or poll)
      // Since it's a single HTTP response, we trigger step indicators based on approximate timing,
      // or we can print them when the API returns. We will just keep a friendly loading text:
      setProgressMsg("Uploading files and comparing visual layouts page-by-page...");
      
      const res = await fetch(`${API_BASE}/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filenameA: fileA, filenameB: fileB })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setReport(data.report);
        setChatMessages([
          { role: 'agent', content: `Hello! I have completed a detailed analysis between "${files.find(f => f.filename === fileA)?.displayName}" and "${files.find(f => f.filename === fileB)?.displayName}". How can I help you digest these updates?` }
        ]);
        setActiveTab('summary');
      } else {
        alert(data.error || "Comparison failed");
      }
    } catch (err) {
      alert("Error reaching backend. Check if the server is running on port 5001.");
    } finally {
      setIsLoading(false);
      setProgressMsg('');
    }
  };

  // Chat message submission
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !fileA || !fileB) return;

    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');
    setIsChatLoading(true);

    if (isDemoMode) {
      setTimeout(() => {
        // Mock chat answers based on query
        let answer = "I can see changes in the security deposit and the utility schedule. Let me know if you want details on those sections.";
        if (userMsg.toLowerCase().includes('deposit')) {
          answer = "The security deposit was increased from $2,000.00 to $2,300.00 on Page 1. This represents a 15% increase ($300.00 difference).";
        } else if (userMsg.toLowerCase().includes('electricity') || userMsg.toLowerCase().includes('utility')) {
          answer = "According to the Utility Responsibilities Schedule on Page 3, electricity billing has been modified. In the original, the Landlord paid for it, but in the revised agreement, it is now the Tenant's responsibility.";
        } else if (userMsg.toLowerCase().includes('fee') || userMsg.toLowerCase().includes('late')) {
          answer = "The grace period for rent payments was reduced. Previously, rent was late after the 5th; now it is late after the 3rd of the month.";
        }
        setChatMessages(prev => [...prev, { role: 'agent', content: answer }]);
        setIsChatLoading(false);
      }, 1500);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filenameA: fileA,
          filenameB: fileB,
          messages: chatMessages,
          message: userMsg
        })
      });

      const data = await res.json();
      if (res.ok && data.reply) {
        setChatMessages(prev => [...prev, { role: 'agent', content: data.reply }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'agent', content: `Error: ${data.error || "Failed to get response."}` }]);
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'agent', content: "Error communicating with comparison chatbot backend." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Helper formats
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = 1;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const getSeverityColor = (sev: 'low' | 'medium' | 'high') => {
    switch (sev) {
      case 'high': return 'hsl(0 84% 60%)';
      case 'medium': return 'hsl(38 92% 50%)';
      default: return 'hsl(142 76% 45%)';
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header Bar */}
      <header className="glass-container" style={{ margin: '16px 24px 0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'linear-gradient(135deg, hsl(263, 90%, 50%) 0%, hsl(190, 90%, 50%) 100%)', width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 15px hsla(263, 90%, 50%, 0.4)' }}>
            <Sparkles size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, background: 'linear-gradient(90deg, #fff 0%, hsl(var(--text-muted)) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              AlloCapUpdates
            </h1>
            <p style={{ fontSize: '12px', color: 'hsl(var(--text-muted))' }}>AI Agent Document Comparison</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {!isConfigured && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'hsla(38, 92%, 50%, 0.15)', border: '1px solid hsl(38 92% 50% / 0.3)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', color: 'hsl(38 92% 50%)' }}>
              <AlertTriangle size={14} />
              <span>Demo Mode active (No API Key)</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'hsla(263, 90%, 50%, 0.15)', border: '1px solid hsl(263 90% 50% / 0.3)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', color: 'hsl(263 90% 60%)', fontWeight: 600 }}>
            <span>Gemini 3.5 Flash</span>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="dashboard-grid">
        
        {/* Sidebar Panel - Storage & Uploads */}
        <section className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px', height: '100%', overflowY: 'auto' }}>
          <div>
            <h2 style={{ fontSize: '18px', marginBottom: '6px' }}>Document Storage</h2>
            <p style={{ fontSize: '12px', color: 'hsl(var(--text-muted))' }}>Upload and select documents to compare.</p>
          </div>

          {/* Upload Drop Zone */}
          <div 
            style={{ 
              border: '2px dashed hsla(224, 71%, 20%, 0.6)', 
              borderRadius: '12px', 
              padding: '24px 16px', 
              textAlign: 'center',
              cursor: 'pointer',
              background: 'hsla(224, 71%, 4%, 0.3)',
              transition: 'var(--transition-smooth)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'hsl(var(--primary))'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'hsla(224, 71%, 20%, 0.6)'}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept=".pdf"
              onChange={handleFileUpload} 
            />
            {uploading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <RefreshCw size={24} className="pulsing-glow" style={{ animation: 'spin 2s linear infinite', color: 'hsl(var(--primary))' }} />
                <span style={{ fontSize: '13px' }}>Uploading to storage...</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <Upload size={24} style={{ color: 'hsl(var(--text-muted))' }} />
                <span style={{ fontSize: '13px', fontWeight: 500 }}>Upload PDF Document</span>
                <span style={{ fontSize: '10px', color: 'hsl(var(--text-muted))' }}>Up to 50MB</span>
              </div>
            )}
          </div>
          {uploadError && (
            <p style={{ color: 'hsl(var(--danger))', fontSize: '11px', marginTop: '-10px', textAlign: 'center' }}>{uploadError}</p>
          )}

          {/* File Lists */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto' }}>
            <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--text-muted))' }}>Uploaded Files ({files.length})</h3>
            
            {files.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'hsl(var(--text-muted))', fontSize: '13px' }}>
                No files uploaded yet.
              </div>
            ) : (
              files.map(file => (
                <div 
                  key={file.filename} 
                  className="glass-card" 
                  style={{ 
                    padding: '12px', 
                    borderRadius: '10px', 
                    border: '1px solid hsla(224, 71%, 20%, 0.25)', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '8px',
                    background: fileA === file.filename ? 'hsla(263, 90%, 50%, 0.08)' : fileB === file.filename ? 'hsla(190, 90%, 50%, 0.08)' : 'hsla(224, 71%, 8%, 0.35)',
                    borderColor: fileA === file.filename ? 'hsla(263, 90%, 50%, 0.5)' : fileB === file.filename ? 'hsla(190, 90%, 50%, 0.5)' : 'hsla(224, 71%, 20%, 0.25)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyItems: 'space-between', gap: '8px' }}>
                    <FileText size={18} style={{ color: 'hsl(var(--text-muted))', marginTop: '2px', flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={file.displayName}>
                      {file.displayName}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'hsl(var(--text-muted))' }}>
                    <span>{formatBytes(file.size)}</span>
                    <a 
                      href={`${API_BASE}/download/${file.filename}`}
                      style={{ color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                      title="Download original file"
                    >
                      <Download size={12} /> Download
                    </a>
                  </div>

                  {/* Document Selection Hooks */}
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                    <button 
                      onClick={() => setFileA(fileA === file.filename ? null : file.filename)}
                      style={{ 
                        flex: 1, 
                        padding: '4px 0', 
                        fontSize: '11px', 
                        borderRadius: '6px', 
                        cursor: 'pointer',
                        background: fileA === file.filename ? 'hsl(263, 90%, 50%)' : 'hsla(224, 71%, 20%, 0.4)',
                        border: 'none',
                        color: '#fff',
                        fontWeight: 600,
                        transition: 'all 0.2s'
                      }}
                    >
                      Original (A)
                    </button>
                    <button 
                      onClick={() => setFileB(fileB === file.filename ? null : file.filename)}
                      style={{ 
                        flex: 1, 
                        padding: '4px 0', 
                        fontSize: '11px', 
                        borderRadius: '6px', 
                        cursor: 'pointer',
                        background: fileB === file.filename ? 'hsl(190, 90%, 50%)' : 'hsla(224, 71%, 20%, 0.4)',
                        border: 'none',
                        color: '#fff',
                        fontWeight: 600,
                        transition: 'all 0.2s'
                      }}
                    >
                      Revised (B)
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Action Trigger */}
          <button 
            onClick={handleCompare}
            disabled={!fileA || !fileB || isLoading}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {isLoading ? (
              <>
                <RefreshCw size={16} className="spin" style={{ animation: 'spin 2s linear infinite' }} />
                <span>Auditing Documents...</span>
              </>
            ) : (
              <>
                <span>Compare Documents</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </section>

        {/* Main Content Workspace */}
        <section className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
          
          {/* 1. Loading Screen */}
          {isLoading && (
            <div style={{ position: 'absolute', inset: 0, background: 'hsla(224, 71%, 4%, 0.85)', backdropFilter: 'blur(8px)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '40px', borderRadius: 'var(--border-radius)' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ width: '12px', height: '12px', background: 'hsl(var(--primary))', borderRadius: '50%', animation: 'bounce 0.6s infinite alternate' }}></span>
                <span style={{ width: '12px', height: '12px', background: 'hsl(var(--secondary))', borderRadius: '50%', animation: 'bounce 0.6s infinite alternate 0.2s' }}></span>
                <span style={{ width: '12px', height: '12px', background: '#fff', borderRadius: '50%', animation: 'bounce 0.6s infinite alternate 0.4s' }}></span>
              </div>
              <div style={{ textAlign: 'center', maxWidth: '400px' }}>
                <h3 style={{ fontSize: '18px', marginBottom: '8px' }} className="glow-text-primary">Gemini Compare Agent Active</h3>
                <p style={{ fontSize: '13px', color: 'hsl(var(--text-muted))', minHeight: '40px', lineBreak: 'anywhere' }}>
                  {progressMsg}
                </p>
              </div>
            </div>
          )}

          {/* 2. Default Welcome State */}
          {!report && !isLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '20px', textAlign: 'center', padding: '40px' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'hsla(263, 90%, 50%, 0.15)', border: '1px solid hsla(263, 90%, 50%, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }} className="pulsing-glow">
                <FileCheck size={40} style={{ color: 'hsl(var(--primary-glow))' }} />
              </div>
              <div style={{ maxWidth: '500px' }}>
                <h2 style={{ fontSize: '24px', marginBottom: '10px' }}>Welcome to AlloCapUpdates</h2>
                <p style={{ fontSize: '14px', color: 'hsl(var(--text-muted))', lineHeight: 1.6 }}>
                  Select an **Original Document** (from the left menu) and a **Revised Document**, and run the agent audit. Gemini 3.5 Flash will compare text, table cells, and visual changes.
                </p>
              </div>
              
              {/* Feature boxes */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', width: '100%', maxWidth: '800px', marginTop: '24px' }}>
                <div className="glass-card" style={{ padding: '16px', textAlign: 'left' }}>
                  <FileText size={20} style={{ color: 'hsl(var(--primary-glow))', marginBottom: '8px' }} />
                  <h4 style={{ fontSize: '14px', marginBottom: '4px' }}>Text Comparison</h4>
                  <p style={{ fontSize: '12px', color: 'hsl(var(--text-muted))' }}>Audits edits, deletions, additions and dates.</p>
                </div>
                <div className="glass-card" style={{ padding: '16px', textAlign: 'left' }}>
                  <Table size={20} style={{ color: 'hsl(var(--secondary))', marginBottom: '8px' }} />
                  <h4 style={{ fontSize: '14px', marginBottom: '4px' }}>Table Auditing</h4>
                  <p style={{ fontSize: '12px', color: 'hsl(var(--text-muted))' }}>Tracks column shifts and cell modifications.</p>
                </div>
                <div className="glass-card" style={{ padding: '16px', textAlign: 'left' }}>
                  <Layers size={20} style={{ color: 'hsl(var(--success))', marginBottom: '8px' }} />
                  <h4 style={{ fontSize: '14px', marginBottom: '4px' }}>Visual Changes</h4>
                  <p style={{ fontSize: '12px', color: 'hsl(var(--text-muted))' }}>Checks layout blocks, logo edits, and diagrams.</p>
                </div>
              </div>
            </div>
          )}

          {/* 3. Comparison Report State */}
          {report && !isLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              
              {/* Tab selectors */}
              <div style={{ display: 'flex', borderBottom: '1px solid hsla(224, 71%, 20%, 0.4)', paddingBottom: '12px', gap: '8px', marginBottom: '16px' }}>
                <button 
                  onClick={() => setActiveTab('summary')}
                  className={activeTab === 'summary' ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '8px' }}
                >
                  <LayoutGrid size={16} /> Summary
                </button>
                <button 
                  onClick={() => setActiveTab('text')}
                  className={activeTab === 'text' ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '8px' }}
                >
                  <FileText size={16} /> Text Changes ({report.textChanges.length})
                </button>
                <button 
                  onClick={() => setActiveTab('tables')}
                  className={activeTab === 'tables' ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '8px' }}
                >
                  <Table size={16} /> Tables ({report.tableChanges.length})
                </button>
                <button 
                  onClick={() => setActiveTab('visuals')}
                  className={activeTab === 'visuals' ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '8px' }}
                >
                  <Layers size={16} /> Visuals ({report.visualChanges.length})
                </button>

                {/* Floating Chat Trigger */}
                <button 
                  onClick={() => setIsChatOpen(true)}
                  className="btn-secondary"
                  style={{ marginLeft: 'auto', padding: '8px 16px', fontSize: '13px', borderRadius: '8px', borderColor: 'hsla(var(--border-glow), 0.3)', color: 'hsl(var(--primary-glow))' }}
                >
                  <MessageSquare size={16} /> Chat with Agent
                </button>
              </div>

              {/* Tab Contents */}
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                
                {/* A. Summary Tab */}
                {activeTab === 'summary' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '20px' }}>
                      <div className="glass-card" style={{ padding: '20px' }}>
                        <h3 style={{ fontSize: '16px', marginBottom: '10px', color: 'hsl(var(--primary-glow))' }}>Executive Summary</h3>
                        <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'hsl(var(--text-primary))' }}>
                          {report.overallSummary}
                        </p>
                      </div>

                      <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
                        <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>Risk Rating</h4>
                        <div 
                          style={{ 
                            fontSize: '24px', 
                            fontWeight: 700, 
                            textTransform: 'uppercase', 
                            color: getSeverityColor(report.riskRating),
                            textShadow: `0 0 10px ${getSeverityColor(report.riskRating)}40`,
                            border: `2px solid ${getSeverityColor(report.riskRating)}`,
                            padding: '8px 24px',
                            borderRadius: '30px'
                          }}
                        >
                          {report.riskRating}
                        </div>
                        <span style={{ fontSize: '11px', color: 'hsl(var(--text-muted))', textAlign: 'center' }}>Based on clause shifts</span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                      <div className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
                        <h4 style={{ fontSize: '28px', color: 'hsl(var(--primary-glow))', fontWeight: 700 }}>{report.textChanges.length}</h4>
                        <p style={{ fontSize: '12px', color: 'hsl(var(--text-muted))' }}>Text Modifications</p>
                      </div>
                      <div className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
                        <h4 style={{ fontSize: '28px', color: 'hsl(var(--secondary))', fontWeight: 700 }}>{report.tableChanges.length}</h4>
                        <p style={{ fontSize: '12px', color: 'hsl(var(--text-muted))' }}>Table Modifications</p>
                      </div>
                      <div className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
                        <h4 style={{ fontSize: '28px', color: 'hsl(var(--success))', fontWeight: 700 }}>{report.visualChanges.length}</h4>
                        <p style={{ fontSize: '12px', color: 'hsl(var(--text-muted))' }}>Visual & Logo Changes</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* B. Text Changes Tab */}
                {activeTab === 'text' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {report.textChanges.length === 0 ? (
                      <div style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>No text modifications found.</div>
                    ) : (
                      report.textChanges.map((change, index) => (
                        <div key={index} className="glass-card" style={{ padding: '16px', borderLeft: `4px solid ${getSeverityColor(change.severity)}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '4px', background: 'hsla(224, 71%, 15%, 0.6)', fontWeight: 600 }}>Page {change.page}</span>
                              <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: change.type === 'added' ? 'hsl(var(--success))' : change.type === 'deleted' ? 'hsl(var(--danger))' : 'hsl(var(--secondary))' }}>
                                {change.type}
                              </span>
                            </div>
                            <span style={{ fontSize: '10px', textTransform: 'uppercase', color: getSeverityColor(change.severity), fontWeight: 700 }}>{change.severity} risk</span>
                          </div>
                          
                          <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>{change.description}</p>
                          
                          {change.originalText && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                              <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px' }}>
                                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'rgb(239, 68, 68)', fontWeight: 600, marginBottom: '4px' }}>Original Document</div>
                                <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{change.originalText}</div>
                              </div>
                              <div style={{ padding: '10px', background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: '6px' }}>
                                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'rgb(34, 197, 94)', fontWeight: 600, marginBottom: '4px' }}>Revised Document</div>
                                <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{change.revisedText}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* C. Table Changes Tab */}
                {activeTab === 'tables' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {report.tableChanges.length === 0 ? (
                      <div style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>No table layout/value changes found.</div>
                    ) : (
                      report.tableChanges.map((change, index) => (
                        <div key={index} className="glass-card" style={{ padding: '16px', borderLeft: `4px solid ${getSeverityColor(change.severity)}` }}>
                          <div style={{ display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '4px', background: 'hsla(224, 71%, 15%, 0.6)', fontWeight: 600 }}>Page {change.page}</span>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: 'hsl(var(--secondary))' }}>{change.tableName}</span>
                            </div>
                            <span style={{ fontSize: '10px', textTransform: 'uppercase', color: getSeverityColor(change.severity), fontWeight: 700 }}>{change.severity} risk</span>
                          </div>
                          
                          <div style={{ fontSize: '13px', color: 'hsl(var(--text-primary))', marginTop: '6px' }}>
                            <strong>Modification Type:</strong> <span style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>{change.type}</span>
                          </div>
                          <p style={{ fontSize: '13px', color: 'hsl(var(--text-muted))', marginTop: '8px' }}>
                            {change.description}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* D. Visual Changes Tab */}
                {activeTab === 'visuals' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {report.visualChanges.length === 0 ? (
                      <div style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>No visual layout or image shifts found.</div>
                    ) : (
                      report.visualChanges.map((change, index) => (
                        <div key={index} className="glass-card" style={{ padding: '16px', borderLeft: `4px solid ${getSeverityColor(change.severity)}` }}>
                          <div style={{ display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '4px', background: 'hsla(224, 71%, 15%, 0.6)', fontWeight: 600 }}>Page {change.page}</span>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: 'hsl(var(--success))', textTransform: 'uppercase' }}>{change.type.replace('_', ' ')}</span>
                            </div>
                            <span style={{ fontSize: '10px', textTransform: 'uppercase', color: getSeverityColor(change.severity), fontWeight: 700 }}>{change.severity} risk</span>
                          </div>
                          
                          <p style={{ fontSize: '13px', color: 'hsl(var(--text-primary))', marginTop: '8px' }}>
                            {change.description}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}

              </div>
            </div>
          )}

        </section>
      </main>

      {/* Floating Chat Drawer (Agent chat assistant) */}
      <div 
        style={{ 
          position: 'fixed',
          top: 0,
          right: isChatOpen ? 0 : '-420px',
          width: '400px',
          height: '100vh',
          background: 'hsla(224, 71%, 6%, 0.95)',
          backdropFilter: 'blur(16px)',
          borderLeft: '1px solid hsla(224, 71%, 20%, 0.4)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
          transition: 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {/* Drawer Header */}
        <div style={{ padding: '20px', borderBottom: '1px solid hsla(224, 71%, 20%, 0.4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={18} style={{ color: 'hsl(var(--primary-glow))' }} /> Audit Chatbot
            </h3>
            <p style={{ fontSize: '11px', color: 'hsl(var(--text-muted))' }}>Ask follow-up questions about files</p>
          </div>
          <button 
            onClick={() => setIsChatOpen(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Chat History */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {chatMessages.map((msg, index) => (
            <div 
              key={index} 
              style={{ 
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                background: msg.role === 'user' ? 'hsl(var(--primary))' : 'hsla(224, 71%, 15%, 0.5)',
                color: '#fff',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                fontSize: '13px',
                lineHeight: 1.4,
                border: msg.role === 'user' ? 'none' : '1px solid hsla(224, 71%, 30%, 0.2)'
              }}
            >
              {msg.content}
            </div>
          ))}
          {isChatLoading && (
            <div 
              style={{ 
                alignSelf: 'flex-start',
                background: 'hsla(224, 71%, 15%, 0.5)',
                padding: '10px 14px',
                borderRadius: '14px 14px 14px 2px',
                fontSize: '13px',
                color: 'hsl(var(--text-muted))',
                border: '1px solid hsla(224, 71%, 30%, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <RefreshCw size={12} className="spin" style={{ animation: 'spin 2s linear infinite' }} />
              Thinking...
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Chat input */}
        <form onSubmit={handleSendMessage} style={{ padding: '20px', borderTop: '1px solid hsla(224, 71%, 20%, 0.4)', display: 'flex', gap: '8px' }}>
          <input 
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={!fileA || !fileB ? "Select documents first..." : "Ask about the changes..."}
            disabled={!fileA || !fileB || isChatLoading}
            style={{ 
              flex: 1, 
              background: 'hsla(224, 71%, 4%, 0.6)', 
              border: '1px solid hsla(224, 71%, 20%, 0.6)', 
              borderRadius: '8px', 
              padding: '10px 14px',
              color: '#fff',
              fontSize: '13px',
              outline: 'none'
            }}
          />
          <button 
            type="submit"
            disabled={!chatInput.trim() || isChatLoading}
            className="btn-primary"
            style={{ padding: '10px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Send size={14} />
          </button>
        </form>
      </div>

    </div>
  );
}

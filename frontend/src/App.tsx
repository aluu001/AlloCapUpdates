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
  originalText?: string;
  revisedText?: string;
  severity: 'low' | 'medium' | 'high';
}

interface VisualChange {
  page: string;
  type: string;
  description: string;
  originalText?: string;
  revisedText?: string;
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
      revisedText: "",
      severity: "medium"
    },
    {
      page: "6",
      type: "added",
      description: "Indemnification clause added for parking space damages.",
      originalText: "",
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
      originalText: "Electricity: [x] Landlord  [ ] Tenant",
      revisedText: "Electricity: [ ] Landlord  [x] Tenant",
      severity: "high"
    },
    {
      page: "3",
      tableName: "Utility Responsibilities Schedule",
      type: "row_added",
      description: "Added a row for High-Speed Fiber Internet fee structure ($50/mo flat fee).",
      originalText: "",
      revisedText: "+ Fiber Internet | Flat Fee | $50.00/mo | Tenant",
      severity: "medium"
    }
  ],
  visualChanges: [
    {
      page: "1",
      type: "logo_replaced",
      description: "Landlord logo updated from 'Apex Holdings LLC' to 'Aegis Property Management Group'.",
      originalText: "Image Logo: 'Apex Holdings' with blue triangle symbol.",
      revisedText: "Image Logo: 'Aegis Property Management' with clean minimalist shield emblem.",
      severity: "low"
    },
    {
      page: "4",
      type: "layout_shifted",
      description: "Signature block moved from page 5 to page 4 due to compact margins.",
      originalText: "Signature blocks printed on separate Page 5 lease rider.",
      revisedText: "Signature blocks condensed and shifted to bottom of Page 4.",
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
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isConfigured, setIsConfigured] = useState(true);
  const [thinkingText, setThinkingText] = useState('');

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<'summary' | 'text' | 'tables' | 'visuals'>('summary');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const thinkingConsoleRef = useRef<HTMLDivElement>(null);

  const [loadingStep, setLoadingStep] = useState(0);

  // Auto-scroll thinking console to bottom
  useEffect(() => {
    if (thinkingConsoleRef.current) {
      thinkingConsoleRef.current.scrollTop = thinkingConsoleRef.current.scrollHeight;
    }
  }, [thinkingText]);

  useEffect(() => {
    let interval: any;
    if (isLoading && isDemoMode) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep((prev) => Math.min(prev + 1, 4));
      }, 2500);
    } else if (isLoading && !isDemoMode) {
      setLoadingStep(0);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isLoading, isDemoMode]);

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

  // Compare documents handler (supporting streaming thoughts)
  const handleCompare = async () => {
    if (!fileA || !fileB) return;

    // Demo Mode trigger if API not configured
    if (!isConfigured) {
      setIsLoading(true);
      setIsDemoMode(true);
      setThinkingText('');
      
      const steps = [
        "Uploading Original File to virtual repository...",
        "Uploading Revised File to virtual repository...",
        "Identifying document sections and layouts...",
        "Comparing clauses, definitions, and formatting...",
        "Generating visual change summary...",
        "Structuring differences into JSON format..."
      ];

      const thinkingQuotes = [
        "Analyzing Document A: Apex Lease Agreement v1...\n- Detected 6 distinct pages\n- Identified Table 'Utility Responsibilities' on page 3.\n\n",
        "Analyzing Document B: revised_lease_v2_signed...\n- Detected 6 distinct pages\n- Layout is slightly more compact; margins decreased to 0.75 in.\n\n",
        "Starting visual audit (Multimodal comparison mode):\n- Comparing logo headers on Page 1... Brand changed to 'Aegis Property Management Group'.\n- Comparing signatures on page 5... block has shifted to bottom of page 4 due to margin changes.\n\n",
        "Scanning text & clauses verbatim:\n- Page 1 clause 1.4: Security deposit changed from $2,000 to $2,300. (Calculated delta: +$300)\n- Page 2 clause 2.1: Grace period reduced from 5 days to 3 days.\n- Page 5: Pet policy lease rider has been deleted completely.\n- Page 6: New parking indemnification clause found in Revised file.\n\n",
        "Auditing table cells page 3:\n- Row 2 'Electricity': landlord obligation has changed to tenant obligation.\n- Row 5 'Fiber Internet': new row added with fee $50/mo.\n\n",
        "Formulating final audit report in JSON..."
      ];

      // We run both stepper and typing streams together
      const totalSteps = steps.length;
      for (let i = 0; i < totalSteps; i++) {
        // Stream text
        const quote = thinkingQuotes[i];
        for (let c = 0; c < quote.length; c++) {
          setThinkingText((prev) => prev + quote[c]);
          await new Promise((r) => setTimeout(r, 12));
        }
        await new Promise((r) => setTimeout(r, 700));
      }

      setReport(mockReport);
      setChatMessages([
        { role: 'agent', content: "Hello! I am your Comparison Agent. I have successfully analyzed the differences between your two documents. Ask me anything about the changes!" }
      ]);
      setIsLoading(false);
      setActiveTab('summary');
      return;
    }

    setIsLoading(true);
    setIsDemoMode(false);
    setThinkingText('');

    try {
      const response = await fetch(`${API_BASE}/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filenameA: fileA, filenameB: fileB })
      });

      if (!response.body) {
        throw new Error('Readable stream not supported or empty body.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Hold onto incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === 'progress') {
              // Stepper checklist ticks off on specific logs
              if (data.message.includes('Uploading Revised')) {
                setLoadingStep(1);
              } else if (data.message.includes('Waiting for Original')) {
                setLoadingStep(2);
              } else if (data.message.includes('Comparing documents')) {
                setLoadingStep(3);
              } else if (data.message.includes('Parsing comparison')) {
                setLoadingStep(4);
              }
            } else if (data.type === 'thought') {
              setThinkingText((prev) => prev + data.text);
            } else if (data.type === 'report') {
              if (data.success && data.report) {
                setReport(data.report);
                setChatMessages([
                  { role: 'agent', content: `Hello! I have completed a detailed analysis between "${files.find(f => f.filename === fileA)?.displayName}" and "${files.find(f => f.filename === fileB)?.displayName}". How can I help you digest these updates?` }
                ]);
                setActiveTab('summary');
              } else {
                alert(data.error || "Comparison failed");
              }
            } else if (data.type === 'error') {
              alert(`Agent Comparison Error: ${data.error}`);
            }
          } catch (err) {
            console.error("JSON parse error on stream line", err, line);
          }
        }
      }
    } catch (err: any) {
      alert(`Error reaching backend: ${err.message}. Check if the server is running on port 5001.`);
    } finally {
      setIsLoading(false);
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
              files.map(file => {
                const isSelectedA = fileA === file.filename;
                const isSelectedB = fileB === file.filename;
                
                return (
                  <div 
                    key={file.filename} 
                    className="glass-card" 
                    style={{ 
                      padding: '12px', 
                      borderRadius: '10px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '8px',
                      background: isSelectedA ? 'hsla(263, 90%, 50%, 0.08)' : isSelectedB ? 'hsla(190, 90%, 50%, 0.08)' : 'hsla(224, 71%, 8%, 0.35)',
                      borderColor: isSelectedA ? 'hsl(263 90% 50%)' : isSelectedB ? 'hsl(190 90% 50%)' : 'hsla(224, 71%, 20%, 0.25)',
                      boxShadow: isSelectedA ? '0 0 10px hsla(263, 90%, 50%, 0.2)' : isSelectedB ? '0 0 10px hsla(190, 90%, 50%, 0.2)' : 'none'
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

                    {/* Selection Controls */}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                      <button 
                        onClick={() => {
                          setFileA(isSelectedA ? null : file.filename);
                          if (isSelectedB) setFileB(null); // prevent selecting same file for both
                        }}
                        style={{ 
                          flex: 1, 
                          padding: '6px 0', 
                          fontSize: '11px', 
                          borderRadius: '6px', 
                          cursor: 'pointer',
                          background: isSelectedA ? 'hsl(263, 90%, 50%)' : 'hsla(224, 71%, 20%, 0.2)',
                          border: isSelectedA ? 'none' : '1px solid hsla(224, 71%, 30%, 0.3)',
                          color: '#fff',
                          fontWeight: 600,
                          transition: 'all 0.2s'
                        }}
                      >
                        {isSelectedA ? 'Selected A' : 'Set Original (A)'}
                      </button>
                      <button 
                        onClick={() => {
                          setFileB(isSelectedB ? null : file.filename);
                          if (isSelectedA) setFileA(null);
                        }}
                        style={{ 
                          flex: 1, 
                          padding: '6px 0', 
                          fontSize: '11px', 
                          borderRadius: '6px', 
                          cursor: 'pointer',
                          background: isSelectedB ? 'hsl(190, 90%, 50%)' : 'hsla(224, 71%, 20%, 0.2)',
                          border: isSelectedB ? 'none' : '1px solid hsla(190, 90%, 50%, 0.3)',
                          color: '#fff',
                          fontWeight: 600,
                          transition: 'all 0.2s'
                        }}
                      >
                        {isSelectedB ? 'Selected B' : 'Set Revised (B)'}
                      </button>
                    </div>
                  </div>
                );
              })
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
            <div style={{ position: 'absolute', inset: 0, background: 'hsla(224, 71%, 4%, 0.96)', backdropFilter: 'blur(16px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', borderRadius: 'var(--border-radius)', overflowY: 'auto' }}>
              
              <div style={{ maxWidth: '860px', width: '100%', display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '32px', alignItems: 'start' }}>
                
                {/* Left Column: Progress status & Checklist */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {/* Spinner ring */}
                    <div style={{ position: 'relative', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <div style={{ position: 'absolute', inset: 0, border: '3px solid hsla(263, 90%, 50%, 0.15)', borderRadius: '50%' }}></div>
                      <div style={{ position: 'absolute', inset: 0, border: '3px solid transparent', borderTopColor: 'hsl(var(--primary-glow))', borderRightColor: 'hsl(var(--secondary))', borderRadius: '50%', animation: 'spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite' }}></div>
                      <Sparkles size={16} style={{ color: 'hsl(var(--primary-glow))' }} />
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', margin: 0 }} className="glow-text-primary">
                        Auditing Comparison
                      </h3>
                      <p style={{ fontSize: '12px', color: 'hsl(var(--text-muted))', margin: '4px 0 0 0' }}>Gemini AI Agent is auditing your documents</p>
                    </div>
                  </div>

                  {/* Stepper progress list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left', background: 'hsla(224, 71%, 8%, 0.5)', border: '1px solid hsla(224, 71%, 20%, 0.35)', padding: '20px', borderRadius: '12px' }}>
                    {[
                      "Staging documents in workspace storage...",
                      "Uploading files to Gemini Secure Gateway...",
                      "Performing multimodal structural layout audit...",
                      "Scanning clause differences & textual modifications...",
                      "Synthesizing results and formulating JSON audit..."
                    ].map((step, idx) => {
                      const isDone = loadingStep > idx;
                      const isActive = loadingStep === idx;
                      
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: isDone ? 1 : isActive ? 1 : 0.4, transition: 'opacity 0.3s' }}>
                          {isDone ? (
                            <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'hsl(var(--success))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: 'bold', flexShrink: 0 }}>✓</div>
                          ) : isActive ? (
                            <RefreshCw size={14} className="spin" style={{ animation: 'spin 2s linear infinite', color: 'hsl(var(--primary-glow))', transformOrigin: 'center', display: 'inline-block', flexShrink: 0 }} />
                          ) : (
                            <RefreshCw size={14} style={{ color: 'hsla(224, 71%, 20%, 0.6)', display: 'inline-block', flexShrink: 0 }} />
                          )}
                          <span style={{ fontSize: '13px', color: isActive ? '#fff' : 'hsl(var(--text-muted))', fontWeight: isActive ? 600 : 400 }}>{step}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Column: Live Agent Reasoning console */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left', width: '100%' }}>
                  <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'hsl(var(--secondary))', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} className="spin" style={{ animation: 'spin 2s linear infinite', transformOrigin: 'center', display: 'inline-block' }} /> Live Agent Reasoning
                  </div>
                  <div 
                    ref={thinkingConsoleRef}
                    style={{ 
                      fontFamily: 'monospace', 
                      fontSize: '12px', 
                      background: 'rgba(0, 0, 0, 0.45)', 
                      border: '1px solid hsla(190, 90%, 50%, 0.15)', 
                      padding: '16px', 
                      borderRadius: '12px', 
                      color: 'hsl(190, 90%, 80%)', 
                      height: '350px', 
                      overflowY: 'auto', 
                      whiteSpace: 'pre-wrap',
                      boxShadow: 'inset 0 0 15px rgba(0,0,0,0.6)',
                      lineHeight: 1.5
                    }}
                  >
                    {thinkingText || "Waiting for model reasoning logs to stream..."}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* 2. Top-level Document Slot Selection (Active Configuration) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 12px 1fr', gap: '12px', marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid hsla(224, 71%, 20%, 0.3)', alignItems: 'center' }}>
            {/* Slot A: Original */}
            <div 
              className="glass-card" 
              style={{ 
                padding: '16px', 
                borderStyle: fileA ? 'solid' : 'dashed', 
                borderWidth: '1.5px',
                borderColor: fileA ? 'hsl(263 90% 50% / 0.4)' : 'hsla(224, 71%, 20%, 0.6)',
                background: fileA ? 'hsla(263, 90%, 50%, 0.04)' : 'hsla(224, 71%, 4%, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderRadius: '12px',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: fileA ? 'hsl(263 90% 50%)' : 'hsla(224, 71%, 20%, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText size={16} color="#fff" />
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Original Document (A)</div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: fileA ? '#fff' : 'hsl(var(--text-muted))', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {fileA ? files.find(f => f.filename === fileA)?.displayName : "No file selected"}
                  </div>
                </div>
              </div>
              {fileA && (
                <button onClick={() => setFileA(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))', display: 'flex', padding: '4px' }} title="Clear Selection">
                  <X size={16} />
                </button>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', color: 'hsla(224, 71%, 20%, 0.6)', fontWeight: 600, fontSize: '14px' }}>VS</div>

            {/* Slot B: Revised */}
            <div 
              className="glass-card" 
              style={{ 
                padding: '16px', 
                borderStyle: fileB ? 'solid' : 'dashed', 
                borderWidth: '1.5px',
                borderColor: fileB ? 'hsl(190 90% 50% / 0.4)' : 'hsla(224, 71%, 20%, 0.6)',
                background: fileB ? 'hsla(190, 90%, 50%, 0.04)' : 'hsla(224, 71%, 4%, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderRadius: '12px',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: fileB ? 'hsl(190 90% 50%)' : 'hsla(224, 71%, 20%, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText size={16} color="#fff" />
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Revised Document (B)</div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: fileB ? '#fff' : 'hsl(var(--text-muted))', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {fileB ? files.find(f => f.filename === fileB)?.displayName : "No file selected"}
                  </div>
                </div>
              </div>
              {fileB && (
                <button onClick={() => setFileB(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))', display: 'flex', padding: '4px' }} title="Clear Selection">
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* 3. Default Welcome State */}
          {!report && !isLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '20px', textAlign: 'center', padding: '40px' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'hsla(263, 90%, 50%, 0.15)', border: '1px solid hsla(263, 90%, 50%, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }} className="pulsing-glow">
                <FileCheck size={40} style={{ color: 'hsl(var(--primary-glow))' }} />
              </div>
              <div style={{ maxWidth: '500px' }}>
                <h2 style={{ fontSize: '24px', marginBottom: '10px' }}>Welcome to AlloCapUpdates</h2>
                <p style={{ fontSize: '14px', color: 'hsl(var(--text-muted))', lineHeight: 1.6 }}>
                  Choose your documents in the left **Document Storage** sidebar to set the **Original (A)** and **Revised (B)** targets, then hit **Compare Documents** to launch the analysis.
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

          {/* 4. Comparison Report State */}
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
                          
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                              {/* Before (Original) */}
                              <div style={{ padding: '10px', background: change.type === 'added' ? 'transparent' : 'rgba(239, 68, 68, 0.08)', border: change.type === 'added' ? '1px dashed hsla(224, 71%, 20%, 0.6)' : '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: change.type === 'added' ? 'hsl(var(--text-muted))' : 'rgb(239, 68, 68)', fontWeight: 600, marginBottom: '4px' }}>Before (Original)</div>
                                {change.type === 'added' ? (
                                  <div style={{ color: 'hsl(var(--text-muted))', fontStyle: 'italic', margin: 'auto 0' }}>[No text existed in original document]</div>
                                ) : (
                                  <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{change.originalText}</div>
                                )}
                              </div>
                              
                              {/* After (Revised) */}
                              <div style={{ padding: '10px', background: change.type === 'deleted' ? 'transparent' : 'rgba(34, 197, 94, 0.08)', border: change.type === 'deleted' ? '1px dashed hsla(224, 71%, 20%, 0.6)' : '1px solid rgba(34, 197, 94, 0.2)', borderRadius: '6px', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: change.type === 'deleted' ? 'hsl(var(--text-muted))' : 'rgb(34, 197, 94)', fontWeight: 600, marginBottom: '4px' }}>After (Revised)</div>
                                {change.type === 'deleted' ? (
                                  <div style={{ color: 'hsl(var(--text-muted))', fontStyle: 'italic', margin: 'auto 0' }}>[Clause deleted in revised document]</div>
                                ) : (
                                  <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{change.revisedText}</div>
                                )}
                              </div>
                            </div>
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
                          <div style={{ display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '4px', background: 'hsla(224, 71%, 15%, 0.6)', fontWeight: 600 }}>Page {change.page}</span>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: 'hsl(var(--secondary))' }}>{change.tableName}</span>
                              <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'hsl(var(--text-muted))' }}>
                                ({change.type.replace('_', ' ')})
                              </span>
                            </div>
                            <span style={{ fontSize: '10px', textTransform: 'uppercase', color: getSeverityColor(change.severity), fontWeight: 700 }}>{change.severity} risk</span>
                          </div>
                          
                          <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>{change.description}</p>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                            {/* Before (Original) */}
                            <div style={{ padding: '10px', background: !change.originalText ? 'transparent' : 'rgba(239, 68, 68, 0.08)', border: !change.originalText ? '1px dashed hsla(224, 71%, 20%, 0.6)' : '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', display: 'flex', flexDirection: 'column' }}>
                              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: !change.originalText ? 'hsl(var(--text-muted))' : 'rgb(239, 68, 68)', fontWeight: 600, marginBottom: '4px' }}>Before (Original Table)</div>
                              {!change.originalText ? (
                                <div style={{ color: 'hsl(var(--text-muted))', fontStyle: 'italic', margin: 'auto 0' }}>[No entry existed in original table]</div>
                              ) : (
                                <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{change.originalText}</div>
                              )}
                            </div>
                            
                            {/* After (Revised) */}
                            <div style={{ padding: '10px', background: !change.revisedText ? 'transparent' : 'rgba(34, 197, 94, 0.08)', border: !change.revisedText ? '1px dashed hsla(224, 71%, 20%, 0.6)' : '1px solid rgba(34, 197, 94, 0.2)', borderRadius: '6px', display: 'flex', flexDirection: 'column' }}>
                              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: !change.revisedText ? 'hsl(var(--text-muted))' : 'rgb(34, 197, 94)', fontWeight: 600, marginBottom: '4px' }}>After (Revised Table)</div>
                              {!change.revisedText ? (
                                <div style={{ color: 'hsl(var(--text-muted))', fontStyle: 'italic', margin: 'auto 0' }}>[Row/cell deleted in revised table]</div>
                              ) : (
                                <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{change.revisedText}</div>
                              )}
                            </div>
                          </div>
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
                          <div style={{ display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '4px', background: 'hsla(224, 71%, 15%, 0.6)', fontWeight: 600 }}>Page {change.page}</span>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: 'hsl(var(--success))', textTransform: 'uppercase' }}>{change.type.replace('_', ' ')}</span>
                            </div>
                            <span style={{ fontSize: '10px', textTransform: 'uppercase', color: getSeverityColor(change.severity), fontWeight: 700 }}>{change.severity} risk</span>
                          </div>
                          
                          <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>{change.description}</p>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                            {/* Before (Original) */}
                            <div style={{ padding: '10px', background: !change.originalText ? 'transparent' : 'rgba(239, 68, 68, 0.08)', border: !change.originalText ? '1px dashed hsla(224, 71%, 20%, 0.6)' : '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', display: 'flex', flexDirection: 'column' }}>
                              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: !change.originalText ? 'hsl(var(--text-muted))' : 'rgb(239, 68, 68)', fontWeight: 600, marginBottom: '4px' }}>Before (Original Visual Layout)</div>
                              {!change.originalText ? (
                                <div style={{ color: 'hsl(var(--text-muted))', fontStyle: 'italic', margin: 'auto 0' }}>[No visual element in original layout]</div>
                              ) : (
                                <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{change.originalText}</div>
                              )}
                            </div>
                            
                            {/* After (Revised) */}
                            <div style={{ padding: '10px', background: !change.revisedText ? 'transparent' : 'rgba(34, 197, 94, 0.08)', border: !change.revisedText ? '1px dashed hsla(224, 71%, 20%, 0.6)' : '1px solid rgba(34, 197, 94, 0.2)', borderRadius: '6px', display: 'flex', flexDirection: 'column' }}>
                              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: !change.revisedText ? 'hsl(var(--text-muted))' : 'rgb(34, 197, 94)', fontWeight: 600, marginBottom: '4px' }}>After (Revised Visual Layout)</div>
                              {!change.revisedText ? (
                                <div style={{ color: 'hsl(var(--text-muted))', fontStyle: 'italic', margin: 'auto 0' }}>[Visual element deleted in revised layout]</div>
                              ) : (
                                <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{change.revisedText}</div>
                              )}
                            </div>
                          </div>
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

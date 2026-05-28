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
  Trash2
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
  const [isStorageOpen, setIsStorageOpen] = useState(false);
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

  // Helper to format streaming markdown/plain-text thoughts into beautiful HTML
  const renderFormattedThinking = (text: string) => {
    if (!text.trim()) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontStyle: 'italic', fontSize: '13px' }}>
          <RefreshCw size={12} className="spin" style={{ animation: 'spin 2s linear infinite', transformOrigin: 'center', display: 'inline-block', color: '#007E9E' }} />
          <span>Waiting for comparison analysis to stream...</span>
        </div>
      );
    }

    // Split into paragraphs by double line breaks
    const paragraphs = text.split(/\n\s*\n/);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {paragraphs.map((para, paraIdx) => {
          const trimmedPara = para.trim();
          if (!trimmedPara) return null;

          // Check if paragraph is a list
          if (trimmedPara.startsWith('- ') || trimmedPara.startsWith('* ')) {
            const items = trimmedPara.split('\n');
            return (
              <div key={paraIdx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {items.map((item, itemIdx) => {
                  const cleanedItem = item.trim().replace(/^[-*]\s*/, '');
                  const parts = cleanedItem.split(/(\*\*.*?\*\*)/g);
                  const isLastLine = paraIdx === paragraphs.length - 1 && itemIdx === items.length - 1;

                  const content = parts.map((part, partIdx) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                      return <strong key={partIdx} style={{ color: '#fff', fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
                    }
                    if (part.startsWith('**')) {
                      return <strong key={partIdx} style={{ color: '#fff', fontWeight: 600 }}>{part.slice(2)}</strong>;
                    }
                    return part;
                  });

                  return (
                    <div key={itemIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', paddingLeft: '4px' }}>
                      <span style={{ color: 'hsl(var(--secondary))', fontSize: '10px', marginTop: '3px', flexShrink: 0 }}>•</span>
                      <span style={{ fontSize: '13px', color: 'hsla(210, 40%, 98%, 0.85)', lineHeight: 1.4 }}>
                        {content}
                        {isLastLine && (
                          <span style={{
                            display: 'inline-block',
                            width: '8px',
                            height: '14px',
                            background: 'hsl(var(--secondary))',
                            marginLeft: '6px',
                            verticalAlign: 'middle',
                            animation: 'pulse 1.5s infinite ease-in-out',
                            borderRadius: '1px',
                            boxShadow: '0 0 8px hsl(var(--secondary))'
                          }} />
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          }

          // Check if paragraph is a single line header
          const lines = trimmedPara.split('\n');
          const firstLine = lines[0].trim();
          
          let isHeader = false;
          let headerText = '';
          
          if (firstLine.startsWith('#')) {
            isHeader = true;
            headerText = firstLine.replace(/^#+\s*/, '');
          } else if (firstLine.startsWith('**') && firstLine.endsWith('**') && lines.length === 1) {
            isHeader = true;
            headerText = firstLine.slice(2, -2);
          } else if (firstLine.startsWith('**') && !firstLine.includes('**', 2) && lines.length === 1) {
            isHeader = true;
            headerText = firstLine.slice(2);
          }

          if (isHeader) {
            const isLastLine = paraIdx === paragraphs.length - 1;
            return (
              <div key={paraIdx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: 600, 
                  color: 'hsl(var(--secondary))', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  paddingBottom: '6px',
                  marginTop: paraIdx > 0 ? '8px' : '0'
                }}>
                  <span style={{ width: '3px', height: '14px', background: 'hsl(var(--secondary))', borderRadius: '1.5px', flexShrink: 0 }}></span>
                  <span>
                    {headerText}
                    {isLastLine && lines.length === 1 && (
                      <span style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '14px',
                        background: 'hsl(var(--secondary))',
                        marginLeft: '6px',
                        verticalAlign: 'middle',
                        animation: 'pulse 1.5s infinite ease-in-out',
                        borderRadius: '1px',
                        boxShadow: '0 0 8px hsl(var(--secondary))'
                      }} />
                    )}
                  </span>
                </div>
                {lines.slice(1).map((line, lineIdx) => {
                  const parts = line.split(/(\*\*.*?\*\*)/g);
                  const isLastLineOfAll = paraIdx === paragraphs.length - 1 && lineIdx === lines.length - 2;
                  
                  const content = parts.map((part, partIdx) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                      return <strong key={partIdx} style={{ color: '#fff', fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
                    }
                    if (part.startsWith('**')) {
                      return <strong key={partIdx} style={{ color: '#fff', fontWeight: 600 }}>{part.slice(2)}</strong>;
                    }
                    return part;
                  });

                  return (
                    <p key={lineIdx} style={{ margin: 0, fontSize: '13px', color: 'hsla(210, 40%, 98%, 0.85)', lineHeight: 1.5 }}>
                      {content}
                      {isLastLineOfAll && (
                        <span style={{
                          display: 'inline-block',
                          width: '8px',
                          height: '14px',
                          background: 'hsl(var(--secondary))',
                          marginLeft: '6px',
                          verticalAlign: 'middle',
                          animation: 'pulse 1.5s infinite ease-in-out',
                          borderRadius: '1px',
                          boxShadow: '0 0 8px hsl(var(--secondary))'
                        }} />
                      )}
                    </p>
                  );
                })}
              </div>
            );
          }

          // Default paragraph rendering
          return (
            <div key={paraIdx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {lines.map((line, lineIdx) => {
                const parts = line.split(/(\*\*.*?\*\*)/g);
                const isLastLine = paraIdx === paragraphs.length - 1 && lineIdx === lines.length - 1;

                const content = parts.map((part, partIdx) => {
                  if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={partIdx} style={{ color: '#fff', fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
                  }
                  if (part.startsWith('**')) {
                    return <strong key={partIdx} style={{ color: '#fff', fontWeight: 600 }}>{part.slice(2)}</strong>;
                  }
                  return part;
                });

                return (
                  <p key={lineIdx} style={{ margin: 0, fontSize: '13px', color: 'hsla(210, 40%, 98%, 0.85)', lineHeight: 1.5 }}>
                    {content}
                    {isLastLine && (
                      <span style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '14px',
                        background: 'hsl(var(--secondary))',
                        marginLeft: '6px',
                        verticalAlign: 'middle',
                        animation: 'pulse 1.5s infinite ease-in-out',
                        borderRadius: '1px',
                        boxShadow: '0 0 8px hsl(var(--secondary))'
                      }} />
                    )}
                  </p>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

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

  // Delete file handler
  const handleDeleteFile = async (filename: string) => {
    try {
      const res = await fetch(`${API_BASE}/files/${filename}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Clear active selection if the deleted file was selected
        if (fileA === filename) setFileA(null);
        if (fileB === filename) setFileB(null);
        await fetchFiles();
      } else {
        alert(data.error || "Failed to delete file.");
      }
    } catch (err) {
      alert("Error contacting server to delete file.");
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
        "Initializing Original Document...",
        "Initializing Revised Document...",
        "Analyzing document layout...",
        "Comparing text and clauses...",
        "Analyzing visual modifications...",
        "Generating comparison report..."
      ];

      const thinkingQuotes = [
        "Analyzing Document A: Apex Lease Agreement v1...\n- Detected 6 distinct pages\n- Identified Table 'Utility Responsibilities' on page 3.\n\n",
        "Analyzing Document B: revised_lease_v2_signed...\n- Detected 6 distinct pages\n- Layout is slightly more compact; margins decreased to 0.75 in.\n\n",
        "Starting layout comparison:\n- Comparing headers on Page 1... Brand changed to 'Aegis Property Management Group'.\n- Comparing signatures on page 5... block has shifted to bottom of page 4 due to margin changes.\n\n",
        "Scanning text and clauses:\n- Page 1 clause 1.4: Security deposit changed from $2,000 to $2,300. (Calculated delta: +$300)\n- Page 2 clause 2.1: Grace period reduced from 5 days to 3 days.\n- Page 5: Pet policy lease rider has been deleted completely.\n- Page 6: New parking indemnification clause found in Revised file.\n\n",
        "Analyzing table details on Page 3:\n- Row 2 'Electricity': landlord obligation has changed to tenant obligation.\n- Row 5 'Fiber Internet': new row added with fee $50/mo.\n\n",
        "Compiling final comparison report..."
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
        { role: 'agent', content: "Hello! I have completed a detailed analysis between the select documents. Ask me anything about the changes!" }
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
              alert(`Comparison Error: ${data.error}`);
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f2f3', color: '#323639' }}>
      
      {/* Header Bar */}
      <header className="glass-container" style={{ padding: '8px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '55px', zIndex: 30 }}>
        {/* Left: AlloCAP Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg width="150" height="35" viewBox="0 0 150 35" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g transform="translate(0, 2)">
              <path d="M4 28V10C4 8.89543 4.89543 8 6 8H9C10.1046 8 11 8.89543 11 10V28" stroke="#21874c" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M11 28V6C11 4.89543 11.8954 4 13 4H16C17.1046 4 18 4.89543 18 6V28" stroke="#015294" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M18 28V14C18 12.8954 18.8954 12 20 12H23C24.1046 12 25 12.8954 25 14V28" stroke="#21874c" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M2 30H27" stroke="#015294" strokeWidth="2" strokeLinecap="round" />
            </g>
            <text x="34" y="24" fill="#015294" fontFamily="'Raleway', sans-serif" fontSize="18" fontWeight="800">Allo</text>
            <text x="72" y="24" fill="#21874c" fontFamily="'Raleway', sans-serif" fontSize="18" fontWeight="800">CAP</text>
            <text x="114" y="16" fill="#21874c" fontFamily="'Raleway', sans-serif" fontSize="6" fontWeight="700">TM</text>
          </svg>
        </div>

        {/* Center: Client / Version Context */}
        <div style={{ textAlign: 'center', flex: 1, paddingRight: '60px' }}>
          <h2 style={{ fontSize: '14px', color: '#905F5F', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>PCC Demo Instance</h2>
          <p style={{ fontSize: '10px', color: '#64748b', margin: '2px 0 0', fontWeight: 500 }}>Q2 2026, Version: Audit 2.0</p>
        </div>

        {/* Right: Actions Menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#64748b' }}>
          {!isConfigured && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fef3c7', border: '1px solid #fcd34d', padding: '3px 8px', borderRadius: '4px', color: '#d97706', marginRight: '10px' }}>
              <AlertTriangle size={10} />
              <span>Demo Mode</span>
            </div>
          )}
          <a href="#final" style={{ color: '#4b5563', textDecoration: 'none' }}>Final Version</a>
          <span>|</span>
          <a href="#rename" style={{ color: '#4b5563', textDecoration: 'none' }}>Rename Version</a>
          <span>|</span>
          <a href="#lock" style={{ color: '#4b5563', textDecoration: 'none' }}>Lock</a>
          <span>|</span>
          <a href="#client" style={{ color: '#4b5563', textDecoration: 'none' }}>Change Client</a>
          <span>|</span>
          <a href="#quarter" style={{ color: '#4b5563', textDecoration: 'none' }}>Change Quarter</a>
          <span>|</span>
          <a href="#logout" style={{ color: '#905F5F', textDecoration: 'none', fontWeight: 600 }}>Log Out</a>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="dashboard-grid">
        
        {/* Left Navigation Sidebar */}
        <aside className="app-sidebar">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', padding: '12px 0' }}>
            
            <button className="nav-menu-item">
              <span style={{ fontSize: '13px' }}>🏠</span> Home
            </button>
            
            <button className="nav-menu-item">
              <span>+</span> Import Data
            </button>
            
            <button className="nav-menu-item">
              <span>+</span> Payroll Data Management
            </button>
            
            <button className="nav-menu-item">
              <span>+</span> Expenditure Data Management
            </button>
            
            <button className="nav-menu-item">
              <span>+</span> Final Grouper
            </button>
            
            {/* Prepare Data - Expanded Section */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <button className="nav-menu-item" style={{ fontWeight: 700, color: '#015294', background: '#f8fafc' }}>
                <span>−</span> Prepare Data
              </button>
              
              <button className="nav-sub-item">
                Department Types
              </button>
              
              <button className="nav-sub-item">
                Allocation Types
              </button>
              
              {/* Compare Workspace - Active Item */}
              <button className="nav-sub-item active">
                Compare Workspace
              </button>
              
              {/* Document Storage Slide Toggler */}
              <button 
                className="nav-sub-item" 
                onClick={() => setIsStorageOpen(!isStorageOpen)}
                style={{ 
                  background: isStorageOpen ? 'rgba(0, 126, 158, 0.08)' : 'transparent',
                  color: isStorageOpen ? '#007E9E' : '#4b5563',
                  fontWeight: isStorageOpen ? 700 : 500
                }}
              >
                📂 Document Storage {isStorageOpen ? '◀' : '▶'}
              </button>
              
              <button className="nav-sub-item">
                Allocation
              </button>
              
              <button className="nav-sub-item">
                Capped / Enhanced Funding Crosswalk
              </button>
            </div>
            
            <button className="nav-menu-item">
              <span>+</span> Process
            </button>
            
            <button className="nav-menu-item">
              <span>+</span> Reports
            </button>
            
          </div>
        </aside>

        {/* Slide-out Storage Drawer */}
        <div className={`storage-drawer ${isStorageOpen ? 'open' : ''}`}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: '#203865' }}>Document Storage</h3>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0' }}>Upload and select documents</p>
            </div>
            <button 
              onClick={() => setIsStorageOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', padding: '4px' }}
            >
              <X size={18} />
            </button>
          </div>
          
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', flex: 1 }}>
            {/* Upload Drop Zone */}
            <div 
              style={{ 
                border: '2px dashed #cbd5e1', 
                borderRadius: '6px', 
                padding: '20px 16px', 
                textAlign: 'center',
                cursor: 'pointer',
                background: '#f8fafc',
                transition: 'var(--transition-smooth)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = '#015294'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
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
                  <RefreshCw size={24} className="spin" style={{ color: '#015294' }} />
                  <span style={{ fontSize: '12px', color: '#4b5563' }}>Uploading to storage...</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <Upload size={24} style={{ color: '#94a3b8' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Upload PDF Document</span>
                  <span style={{ fontSize: '10px', color: '#64748b' }}>Up to 50MB</span>
                </div>
              )}
            </div>
            {uploadError && (
              <p style={{ color: '#ef4444', fontSize: '11px', marginTop: '-10px', textAlign: 'center' }}>{uploadError}</p>
            )}
            
            {/* Files List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '4px' }}>
                Uploaded Files ({files.length})
              </h4>
              
              {files.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '35px 10px', color: '#94a3b8', fontSize: '12px', border: '1px dashed #cbd5e1', borderRadius: '6px', background: '#f8fafc' }}>
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
                        padding: '10px 12px', 
                        borderRadius: '6px', 
                        display: 'flex', 
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        background: isSelectedA ? 'rgba(1, 82, 148, 0.04)' : isSelectedB ? 'rgba(0, 126, 158, 0.04)' : '#ffffff',
                        borderColor: isSelectedA ? '#015294' : isSelectedB ? '#007E9E' : '#cbd5e1',
                        boxShadow: isSelectedA ? '0 0 8px rgba(1, 82, 148, 0.1)' : isSelectedB ? '0 0 8px rgba(0, 126, 158, 0.1)' : 'none',
                        transition: 'all 0.2s'
                      }}
                    >
                      {/* Left: Icon and wrapped filename */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                        <FileText size={15} style={{ color: isSelectedA ? '#015294' : isSelectedB ? '#007E9E' : '#64748b', flexShrink: 0 }} />
                        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', minWidth: 0, flex: 1 }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b', whiteSpace: 'normal', wordBreak: 'break-all', lineHeight: '1.3' }}>
                            {file.displayName}
                          </span>
                          <span style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{formatBytes(file.size)}</span>
                        </div>
                      </div>
                      
                      {/* Right: Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        <button
                          onClick={() => {
                            setFileA(isSelectedA ? null : file.filename);
                            if (isSelectedB) setFileB(null);
                          }}
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            fontSize: '9px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: isSelectedA ? 'none' : '1px solid rgba(1, 82, 148, 0.4)',
                            background: isSelectedA ? '#015294' : 'transparent',
                            color: isSelectedA ? '#fff' : '#015294',
                            transition: 'all 0.2s'
                          }}
                          title={isSelectedA ? "Unselect Original" : "Set as Original (A)"}
                        >
                          A
                        </button>
                        
                        <button
                          onClick={() => {
                            setFileB(isSelectedB ? null : file.filename);
                            if (isSelectedA) setFileA(null);
                          }}
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            fontSize: '9px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: isSelectedB ? 'none' : '1px solid rgba(0, 126, 158, 0.4)',
                            background: isSelectedB ? '#007E9E' : 'transparent',
                            color: isSelectedB ? '#fff' : '#007E9E',
                            transition: 'all 0.2s'
                          }}
                          title={isSelectedB ? "Unselect Revised" : "Set as Revised (B)"}
                        >
                          B
                        </button>
                        
                        <a 
                          href={`${API_BASE}/download/${file.filename}`}
                          style={{ 
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            color: '#64748b',
                            transition: 'all 0.2s',
                            cursor: 'pointer'
                          }}
                          title="Download file"
                        >
                          <Download size={10} />
                        </a>
                        
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm(`Are you sure you want to delete ${file.displayName}?`)) {
                              await handleDeleteFile(file.filename);
                            }
                          }}
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#fef2f2',
                            border: '1px solid #fee2e2',
                            color: '#ef4444',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          className="delete-btn-hover"
                          title="Delete document"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Workspace Content Panel */}
        <div className="workspace-content">
          
          {/* Top-level Configuration Card (Slots A/B & Compare Button) */}
          <div className="glass-card" style={{ padding: '16px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              
              {/* Slot A: Original */}
              <div 
                style={{ 
                  padding: '12px 16px', 
                  border: '1px solid',
                  borderColor: fileA ? '#015294' : '#cbd5e1',
                  background: fileA ? 'rgba(1, 82, 148, 0.04)' : '#f8fafc',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden', flex: 1 }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '4px', background: fileA ? '#015294' : '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText size={14} color="#fff" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Original Document (A)</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: fileA ? '#1e293b' : '#94a3b8', whiteSpace: 'normal', wordBreak: 'break-all' }}>
                      {fileA ? files.find(f => f.filename === fileA)?.displayName : "No document selected"}
                    </div>
                  </div>
                </div>
                {fileA && (
                  <button onClick={() => setFileA(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', padding: '4px' }}>
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Slot B: Revised */}
              <div 
                style={{ 
                  padding: '12px 16px', 
                  border: '1px solid',
                  borderColor: fileB ? '#007E9E' : '#cbd5e1',
                  background: fileB ? 'rgba(0, 126, 158, 0.04)' : '#f8fafc',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden', flex: 1 }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '4px', background: fileB ? '#007E9E' : '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText size={14} color="#fff" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Revised Document (B)</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: fileB ? '#1e293b' : '#94a3b8', whiteSpace: 'normal', wordBreak: 'break-all' }}>
                      {fileB ? files.find(f => f.filename === fileB)?.displayName : "No document selected"}
                    </div>
                  </div>
                </div>
                {fileB && (
                  <button onClick={() => setFileB(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', padding: '4px' }}>
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Main Action Button */}
            <button 
              onClick={handleCompare}
              disabled={!fileA || !fileB || isLoading}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '10px 0', fontSize: '13px', borderRadius: '4px' }}
            >
              {isLoading ? (
                <>
                  <RefreshCw size={14} className="spin" style={{ color: '#fff' }} />
                  <span>Auditing Comparison...</span>
                </>
              ) : (
                <>
                  <span>Compare Documents</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>

          {/* Core Content Area */}
          <div style={{ position: 'relative', minHeight: '400px' }}>
            
            {/* 1. Loading Panel */}
            {isLoading && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(240, 242, 243, 0.96)', backdropFilter: 'blur(8px)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', borderRadius: 'var(--border-radius)' }}>
                <div style={{ maxWidth: '860px', width: '100%', display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '32px', alignItems: 'start' }}>
                  
                  {/* Left: Progress stepper */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ position: 'relative', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <div style={{ position: 'absolute', inset: 0, border: '3px solid rgba(1, 82, 148, 0.1)', borderRadius: '50%' }}></div>
                        <div style={{ position: 'absolute', inset: 0, border: '3px solid transparent', borderTopColor: '#015294', borderRightColor: '#007E9E', borderRadius: '50%', animation: 'spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite' }}></div>
                        <FileCheck size={16} style={{ color: '#015294' }} />
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#203865', margin: 0 }}>
                          Comparing Documents
                        </h3>
                        <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0' }}>Analyzing clauses & structures...</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left', background: '#ffffff', border: '1px solid #cbd5e1', padding: '20px', borderRadius: '6px' }}>
                      {[
                        "Initializing Original Document...",
                        "Initializing Revised Document...",
                        "Analyzing document layout...",
                        "Comparing text and clauses...",
                        "Generating comparison report..."
                      ].map((step, idx) => {
                        const isDone = loadingStep > idx;
                        const isActive = loadingStep === idx;
                        
                        return (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: isDone || isActive ? 1 : 0.4, transition: 'opacity 0.3s' }}>
                            {isDone ? (
                              <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#21874c', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: 'bold', flexShrink: 0 }}>✓</div>
                            ) : isActive ? (
                              <RefreshCw size={14} className="spin" style={{ color: '#015294', display: 'inline-block', flexShrink: 0 }} />
                            ) : (
                              <RefreshCw size={14} style={{ color: '#cbd5e1', display: 'inline-block', flexShrink: 0 }} />
                            )}
                            <span style={{ fontSize: '12.5px', color: isActive ? '#015294' : '#64748b', fontWeight: isActive ? 600 : 400 }}>{step}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right: Console thoughts */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left', width: '100%' }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#007E9E', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.5px' }}>
                      <RefreshCw size={12} className="spin" style={{ color: '#007E9E' }} /> Comparison Analysis Log
                    </div>
                    <div 
                      ref={thinkingConsoleRef}
                      style={{ 
                        background: '#0f172a', 
                        border: '1px solid #334155', 
                        padding: '16px', 
                        borderRadius: '6px', 
                        height: '320px', 
                        overflowY: 'auto', 
                        boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.2)',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      {renderFormattedThinking(thinkingText)}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* 2. Welcome State */}
            {!report && !isLoading && (
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '20px', textAlign: 'center' }}>
                <div style={{ width: '70px', height: '70px', borderRadius: '18px', background: 'rgba(1, 82, 148, 0.05)', border: '1px solid rgba(1, 82, 148, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }} className="pulsing-glow">
                  <FileCheck size={36} style={{ color: '#015294' }} />
                </div>
                <div style={{ maxWidth: '520px' }}>
                  <h2 style={{ fontSize: '20px', color: '#203865', marginBottom: '8px' }}>Automated Comparison Workspace</h2>
                  <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.6 }}>
                    Open the **Document Storage** drawer to upload files. Select the **Original (A)** and **Revised (B)** documents, then click **Compare Documents** to run the comparison.
                  </p>
                </div>
                
                {/* Feature details grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', width: '100%', maxWidth: '780px', marginTop: '16px' }}>
                  <div className="glass-card" style={{ padding: '16px', textAlign: 'left', background: '#f8fafc' }}>
                    <FileText size={20} style={{ color: '#015294', marginBottom: '8px' }} />
                    <h4 style={{ fontSize: '13px', color: '#203865', marginBottom: '4px' }}>Text Comparison</h4>
                    <p style={{ fontSize: '11px', color: '#64748b' }}>Audits edits, deletions, additions and dates.</p>
                  </div>
                  <div className="glass-card" style={{ padding: '16px', textAlign: 'left', background: '#f8fafc' }}>
                    <Table size={20} style={{ color: '#007E9E', marginBottom: '8px' }} />
                    <h4 style={{ fontSize: '13px', color: '#203865', marginBottom: '4px' }}>Table Auditing</h4>
                    <p style={{ fontSize: '11px', color: '#64748b' }}>Tracks column shifts and cell modifications.</p>
                  </div>
                  <div className="glass-card" style={{ padding: '16px', textAlign: 'left', background: '#f8fafc' }}>
                    <Layers size={20} style={{ color: '#21874c', marginBottom: '8px' }} />
                    <h4 style={{ fontSize: '13px', color: '#203865', marginBottom: '4px' }}>Visual Changes</h4>
                    <p style={{ fontSize: '11px', color: '#64748b' }}>Checks layout blocks, logo edits, and diagrams.</p>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Report Details State */}
            {report && !isLoading && (
              <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                
                {/* Tab selections */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
                  <button 
                    onClick={() => setActiveTab('summary')}
                    className={activeTab === 'summary' ? 'btn-primary' : 'btn-secondary'}
                    style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '4px' }}
                  >
                    <LayoutGrid size={14} /> Summary
                  </button>
                  <button 
                    onClick={() => setActiveTab('text')}
                    className={activeTab === 'text' ? 'btn-primary' : 'btn-secondary'}
                    style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '4px' }}
                  >
                    <FileText size={14} /> Text Changes ({report.textChanges.length})
                  </button>
                  <button 
                    onClick={() => setActiveTab('tables')}
                    className={activeTab === 'tables' ? 'btn-primary' : 'btn-secondary'}
                    style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '4px' }}
                  >
                    <Table size={14} /> Tables ({report.tableChanges.length})
                  </button>
                  <button 
                    onClick={() => setActiveTab('visuals')}
                    className={activeTab === 'visuals' ? 'btn-primary' : 'btn-secondary'}
                    style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '4px' }}
                  >
                    <Layers size={14} /> Visuals ({report.visualChanges.length})
                  </button>

                  <button 
                    onClick={() => setIsChatOpen(true)}
                    className="btn-secondary"
                    style={{ marginLeft: 'auto', padding: '6px 12px', fontSize: '12px', borderRadius: '4px', borderColor: '#cbd5e1', color: '#007E9E' }}
                  >
                    <MessageSquare size={14} /> Ask Assistant
                  </button>
                </div>

                {/* Tab Contents */}
                <div style={{ overflowY: 'auto', paddingRight: '4px' }}>
                  
                  {/* Summary Tab */}
                  {activeTab === 'summary' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: '20px' }}>
                        <div className="glass-card" style={{ padding: '16px', borderLeft: '4px solid #015294' }}>
                          <h3 style={{ fontSize: '14px', marginBottom: '8px', color: '#203865' }}>Executive Summary</h3>
                          <p style={{ fontSize: '13px', lineHeight: 1.5, color: '#334155' }}>
                            {report.overallSummary}
                          </p>
                        </div>

                        <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '8px', background: '#f8fafc' }}>
                          <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Risk Rating</h4>
                          <div 
                            style={{ 
                              fontSize: '18px', 
                              fontWeight: 800, 
                              textTransform: 'uppercase', 
                              color: getSeverityColor(report.riskRating),
                              border: `2px solid ${getSeverityColor(report.riskRating)}`,
                              padding: '4px 16px',
                              borderRadius: '20px',
                              background: '#ffffff'
                            }}
                          >
                            {report.riskRating}
                          </div>
                          <span style={{ fontSize: '10px', color: '#64748b' }}>Based on clause shifts</span>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                        <div className="glass-card" style={{ padding: '12px', textAlign: 'center', background: '#f8fafc' }}>
                          <h4 style={{ fontSize: '24px', color: '#015294', fontWeight: 700 }}>{report.textChanges.length}</h4>
                          <p style={{ fontSize: '11px', color: '#64748b' }}>Text Modifications</p>
                        </div>
                        <div className="glass-card" style={{ padding: '12px', textAlign: 'center', background: '#f8fafc' }}>
                          <h4 style={{ fontSize: '24px', color: '#007E9E', fontWeight: 700 }}>{report.tableChanges.length}</h4>
                          <p style={{ fontSize: '11px', color: '#64748b' }}>Table Modifications</p>
                        </div>
                        <div className="glass-card" style={{ padding: '12px', textAlign: 'center', background: '#f8fafc' }}>
                          <h4 style={{ fontSize: '24px', color: '#21874c', fontWeight: 700 }}>{report.visualChanges.length}</h4>
                          <p style={{ fontSize: '11px', color: '#64748b' }}>Visual & Logo Changes</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Text Changes Tab */}
                  {activeTab === 'text' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {report.textChanges.length === 0 ? (
                        <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>No text modifications found.</div>
                      ) : (
                        report.textChanges.map((change, index) => (
                          <div key={index} className="glass-card" style={{ padding: '16px', borderLeft: `4px solid ${getSeverityColor(change.severity)}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: '#e2e8f0', fontWeight: 700, color: '#334155' }}>Page {change.page}</span>
                                <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, color: change.type === 'added' ? '#21874c' : change.type === 'deleted' ? '#ef4444' : '#007E9E' }}>
                                  {change.type}
                                </span>
                              </div>
                              <span style={{ fontSize: '10px', textTransform: 'uppercase', color: getSeverityColor(change.severity), fontWeight: 700 }}>{change.severity} risk</span>
                            </div>
                            
                            <p style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '10px' }}>{change.description}</p>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '11.5px' }}>
                              {/* Before (Original) */}
                              <div style={{ padding: '10px', background: change.type === 'added' ? 'transparent' : '#fef2f2', border: change.type === 'added' ? '1px dashed #cbd5e1' : '1px solid #fee2e2', borderRadius: '4px', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontSize: '9px', textTransform: 'uppercase', color: change.type === 'added' ? '#64748b' : '#ef4444', fontWeight: 700, marginBottom: '4px' }}>Before (Original)</div>
                                {change.type === 'added' ? (
                                  <div style={{ color: '#94a3b8', fontStyle: 'italic', margin: 'auto 0' }}>[No text existed in original document]</div>
                                ) : (
                                  <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#1e293b' }}>{change.originalText}</div>
                                )}
                              </div>
                              
                              {/* After (Revised) */}
                              <div style={{ padding: '10px', background: change.type === 'deleted' ? 'transparent' : '#f0fdf4', border: change.type === 'deleted' ? '1px dashed #cbd5e1' : '1px solid #dcfce7', borderRadius: '4px', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontSize: '9px', textTransform: 'uppercase', color: change.type === 'deleted' ? '#64748b' : '#21874c', fontWeight: 700, marginBottom: '4px' }}>After (Revised)</div>
                                {change.type === 'deleted' ? (
                                  <div style={{ color: '#94a3b8', fontStyle: 'italic', margin: 'auto 0' }}>[Clause deleted in revised document]</div>
                                ) : (
                                  <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#1e293b' }}>{change.revisedText}</div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Table Changes Tab */}
                  {activeTab === 'tables' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {report.tableChanges.length === 0 ? (
                        <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>No table layout or value changes found.</div>
                      ) : (
                        report.tableChanges.map((change, index) => (
                          <div key={index} className="glass-card" style={{ padding: '16px', borderLeft: `4px solid ${getSeverityColor(change.severity)}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: '#e2e8f0', fontWeight: 700, color: '#334155' }}>Page {change.page}</span>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: '#203865' }}>{change.tableName}</span>
                                <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, color: '#64748b' }}>
                                  ({change.type.replace('_', ' ')})
                                </span>
                              </div>
                              <span style={{ fontSize: '10px', textTransform: 'uppercase', color: getSeverityColor(change.severity), fontWeight: 700 }}>{change.severity} risk</span>
                            </div>
                            
                            <p style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '10px' }}>{change.description}</p>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '11.5px' }}>
                              {/* Before (Original) */}
                              <div style={{ padding: '10px', background: !change.originalText ? 'transparent' : '#fef2f2', border: !change.originalText ? '1px dashed #cbd5e1' : '1px solid #fee2e2', borderRadius: '4px', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontSize: '9px', textTransform: 'uppercase', color: !change.originalText ? '#64748b' : '#ef4444', fontWeight: 700, marginBottom: '4px' }}>Before (Original Table)</div>
                                {!change.originalText ? (
                                  <div style={{ color: '#94a3b8', fontStyle: 'italic', margin: 'auto 0' }}>[No entry existed in original table]</div>
                                ) : (
                                  <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#1e293b' }}>{change.originalText}</div>
                                )}
                              </div>
                              
                              {/* After (Revised) */}
                              <div style={{ padding: '10px', background: !change.revisedText ? 'transparent' : '#f0fdf4', border: !change.revisedText ? '1px dashed #cbd5e1' : '1px solid #dcfce7', borderRadius: '4px', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontSize: '9px', textTransform: 'uppercase', color: !change.revisedText ? '#64748b' : '#21874c', fontWeight: 700, marginBottom: '4px' }}>After (Revised Table)</div>
                                {!change.revisedText ? (
                                  <div style={{ color: '#94a3b8', fontStyle: 'italic', margin: 'auto 0' }}>[Row/cell deleted in revised table]</div>
                                ) : (
                                  <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#1e293b' }}>{change.revisedText}</div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Visual Changes Tab */}
                  {activeTab === 'visuals' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {report.visualChanges.length === 0 ? (
                        <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>No visual layout or image shifts found.</div>
                      ) : (
                        report.visualChanges.map((change, index) => (
                          <div key={index} className="glass-card" style={{ padding: '16px', borderLeft: `4px solid ${getSeverityColor(change.severity)}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: '#e2e8f0', fontWeight: 700, color: '#334155' }}>Page {change.page}</span>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#21874c', textTransform: 'uppercase' }}>{change.type.replace('_', ' ')}</span>
                              </div>
                              <span style={{ fontSize: '10px', textTransform: 'uppercase', color: getSeverityColor(change.severity), fontWeight: 700 }}>{change.severity} risk</span>
                            </div>
                            
                            <p style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '10px' }}>{change.description}</p>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '11.5px' }}>
                              {/* Before (Original) */}
                              <div style={{ padding: '10px', background: !change.originalText ? 'transparent' : '#fef2f2', border: !change.originalText ? '1px dashed #cbd5e1' : '1px solid #fee2e2', borderRadius: '4px', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontSize: '9px', textTransform: 'uppercase', color: !change.originalText ? '#64748b' : '#ef4444', fontWeight: 700, marginBottom: '4px' }}>Before (Original Visual Layout)</div>
                                {!change.originalText ? (
                                  <div style={{ color: '#94a3b8', fontStyle: 'italic', margin: 'auto 0' }}>[No visual element in original layout]</div>
                                ) : (
                                  <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#1e293b' }}>{change.originalText}</div>
                                )}
                              </div>
                              
                              {/* After (Revised) */}
                              <div style={{ padding: '10px', background: !change.revisedText ? 'transparent' : '#f0fdf4', border: !change.revisedText ? '1px dashed #cbd5e1' : '1px solid #dcfce7', borderRadius: '4px', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontSize: '9px', textTransform: 'uppercase', color: !change.revisedText ? '#64748b' : '#21874c', fontWeight: 700, marginBottom: '4px' }}>After (Revised Visual Layout)</div>
                                {!change.revisedText ? (
                                  <div style={{ color: '#94a3b8', fontStyle: 'italic', margin: 'auto 0' }}>[Visual element deleted in revised layout]</div>
                                ) : (
                                  <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#1e293b' }}>{change.revisedText}</div>
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

          </div>
        </div>
      </main>

      {/* Floating Chat Drawer (Assistant chat panel) */}
      <div 
        style={{ 
          position: 'fixed',
          top: '55px',
          bottom: '40px',
          right: isChatOpen ? 0 : '-420px',
          width: '400px',
          background: '#ffffff',
          borderLeft: '1px solid #cbd5e1',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.05)',
          transition: 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {/* Drawer Header */}
        <div style={{ padding: '20px', borderBottom: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#203865', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={16} style={{ color: '#007E9E' }} /> Comparison Assistant
            </h3>
            <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0' }}>Ask questions about the audit report</p>
          </div>
          <button 
            onClick={() => setIsChatOpen(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1' }}
          >
            <X size={20} style={{ color: '#64748b' }} />
          </button>
        </div>

        {/* Chat History */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', background: '#f8fafc' }}>
          {chatMessages.map((msg, index) => (
            <div 
              key={index} 
              style={{ 
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                background: msg.role === 'user' ? '#015294' : '#ffffff',
                color: msg.role === 'user' ? '#ffffff' : '#323639',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                fontSize: '12.5px',
                lineHeight: 1.4,
                border: msg.role === 'user' ? 'none' : '1px solid #cbd5e1',
                boxShadow: msg.role === 'user' ? '0 1px 3px rgba(1, 82, 148, 0.2)' : '0 1px 3px rgba(0,0,0,0.05)'
              }}
            >
              {msg.content}
            </div>
          ))}
          {isChatLoading && (
            <div 
              style={{ 
                alignSelf: 'flex-start',
                background: '#ffffff',
                padding: '10px 14px',
                borderRadius: '12px 12px 12px 2px',
                fontSize: '12.5px',
                color: '#64748b',
                border: '1px solid #cbd5e1',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <RefreshCw size={12} className="spin" style={{ color: '#007E9E' }} />
              <span>Analyzing...</span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Chat input */}
        <form onSubmit={handleSendMessage} style={{ padding: '20px', borderTop: '1px solid #cbd5e1', display: 'flex', gap: '8px', background: '#ffffff' }}>
          <input 
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={!fileA || !fileB ? "Select documents first..." : "Ask about the changes..."}
            disabled={!fileA || !fileB || isChatLoading}
            style={{ 
              flex: 1, 
              background: '#f8fafc', 
              border: '1px solid #cbd5e1', 
              borderRadius: '4px', 
              padding: '10px 14px',
              color: '#323639',
              fontSize: '13px',
              outline: 'none'
            }}
          />
          <button 
            type="submit"
            disabled={!chatInput.trim() || isChatLoading}
            className="btn-primary"
            style={{ padding: '10px 14px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Send size={14} />
          </button>
        </form>
      </div>

      {/* PCG Branded Footer */}
      <footer style={{ height: '40px', background: '#002A5D', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', fontSize: '11px', borderTop: '1px solid #004080', zIndex: 40, position: 'fixed', bottom: 0, left: 0, right: 0 }}>
        <div>
          <span>AlloCap Updates 2.0 | PCC Demo Instance</span>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="120" height="24" viewBox="0 0 180 35" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g transform="translate(0, 2)">
                <rect x="2" y="26" width="26" height="3" rx="0.5" fill="#FFFFFF" />
                <rect x="4" y="24" width="22" height="2" rx="0.5" fill="#FFFFFF" />
                <path d="M15 2L3 8H27L15 2Z" fill="#FFFFFF" />
                <rect x="5" y="8" width="20" height="2" fill="#FFFFFF" />
                <rect x="7" y="10" width="3" height="14" fill="#FFFFFF" />
                <rect x="13" y="10" width="4" height="14" fill="#FFFFFF" />
                <rect x="20" y="10" width="3" height="14" fill="#FFFFFF" />
              </g>
              <text x="38" y="18" fill="#FFFFFF" fontFamily="'Raleway', sans-serif" fontSize="11" fontWeight="700" letterSpacing="1">PUBLIC</text>
              <text x="38" y="28" fill="#A0B0C0" fontFamily="'Raleway', sans-serif" fontSize="8" fontWeight="500" letterSpacing="1.5">CONSULTING GROUP</text>
            </svg>
          </div>
        </div>
      </footer>

    </div>
  );
}

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
  potentialImpact?: string;
}

interface TableChange {
  page: string;
  tableName: string;
  type: string;
  description: string;
  originalText?: string;
  revisedText?: string;
  severity: 'low' | 'medium' | 'high';
  potentialImpact?: string;
}

interface VisualChange {
  page: string;
  type: string;
  description: string;
  originalText?: string;
  revisedText?: string;
  severity: 'low' | 'medium' | 'high';
  potentialImpact?: string;
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

interface DiffSegment {
  type: 'added' | 'removed' | 'common';
  text: string;
}

// LCS word diff helper
const computeWordDiff = (original: string, revised: string): { originalSegments: DiffSegment[], revisedSegments: DiffSegment[] } => {
  const normOriginal = original || '';
  const normRevised = revised || '';

  if (!normOriginal) {
    return {
      originalSegments: [],
      revisedSegments: [{ type: 'added', text: normRevised }]
    };
  }
  if (!normRevised) {
    return {
      originalSegments: [{ type: 'removed', text: normOriginal }],
      revisedSegments: []
    };
  }

  // Tokenize by word boundary or space/punctuation
  const tokenize = (str: string) => {
    return str.match(/\w+|[^\w\s]|\s+/g) || [];
  };

  const words1 = tokenize(normOriginal);
  const words2 = tokenize(normRevised);

  const n = words1.length;
  const m = words2.length;
  
  // DP table
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (words1[i - 1].toLowerCase().trim() === words2[j - 1].toLowerCase().trim()) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const originalSegments: DiffSegment[] = [];
  const revisedSegments: DiffSegment[] = [];

  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && words1[i - 1].toLowerCase().trim() === words2[j - 1].toLowerCase().trim()) {
      const text = words1[i - 1];
      originalSegments.unshift({ type: 'common', text });
      revisedSegments.unshift({ type: 'common', text });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      revisedSegments.unshift({ type: 'added', text: words2[j - 1] });
      j--;
    } else {
      originalSegments.unshift({ type: 'removed', text: words1[i - 1] });
      i--;
    }
  }

  const mergeSegments = (segs: DiffSegment[]) => {
    const merged: DiffSegment[] = [];
    for (const seg of segs) {
      if (merged.length > 0 && merged[merged.length - 1].type === seg.type) {
        merged[merged.length - 1].text += seg.text;
      } else {
        merged.push({ ...seg });
      }
    }
    return merged;
  };

  return {
    originalSegments: mergeSegments(originalSegments),
    revisedSegments: mergeSegments(revisedSegments)
  };
};

const renderOriginalDiffText = (origText: string, revText: string) => {
  const { originalSegments } = computeWordDiff(origText, revText);
  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif", fontSize: '12.5px', lineHeight: '1.6', whiteSpace: 'pre-wrap', color: '#334155' }}>
      {originalSegments.map((seg, idx) => {
        if (seg.type === 'removed') {
          return (
            <span key={idx} className="print-highlight-removed" style={{ background: '#ffe2e2', color: '#b91c1c', textDecoration: 'line-through', padding: '1px 3px', borderRadius: '2px', fontWeight: 600 }}>
              {seg.text}
            </span>
          );
        }
        return <span key={idx}>{seg.text}</span>;
      })}
    </div>
  );
};

const renderRevisedDiffText = (origText: string, revText: string) => {
  const { revisedSegments } = computeWordDiff(origText, revText);
  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif", fontSize: '12.5px', lineHeight: '1.6', whiteSpace: 'pre-wrap', color: '#334155' }}>
      {revisedSegments.map((seg, idx) => {
        if (seg.type === 'added') {
          return (
            <span key={idx} className="print-highlight-added" style={{ background: '#fef08a', color: '#713f12', padding: '1px 3px', borderRadius: '2px', fontWeight: 600 }}>
              {seg.text}
            </span>
          );
        }
        return <span key={idx}>{seg.text}</span>;
      })}
    </div>
  );
};

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
      severity: "high",
      potentialImpact: "Increases the initial cash requirement for the tenant by 15%. Verify if this aligns with local statutory caps on security deposits."
    },
    {
      page: "2",
      type: "modified",
      description: "Late fee grace period shortened.",
      originalText: "Late fees will apply if rent is unpaid by the 5th day of the month.",
      revisedText: "Late fees will apply if rent is unpaid by the 3rd day of the month.",
      severity: "medium",
      potentialImpact: "Accelerates late fee triggers. Recommend adjusting automated payroll/accounts payable schedules to avoid late fee penalties."
    },
    {
      page: "5",
      type: "deleted",
      description: "Pet policy lease rider removed.",
      originalText: "Tenant is permitted to keep one domestic cat under 15 lbs on the premises.",
      revisedText: "",
      severity: "medium",
      potentialImpact: "Removes explicit permission to harbor pets. Confirm if the current tenant occupies the space with a pet to avoid immediate lease default."
    },
    {
      page: "6",
      type: "added",
      description: "Indemnification clause added for parking space damages.",
      originalText: "",
      revisedText: "Tenant agrees to indemnify landlord for any claims arising from parking space usage.",
      severity: "low",
      potentialImpact: "Shifts liability for parking space damage onto the tenant. Confirm tenant's commercial general liability insurance covers parking structure incidents."
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
      severity: "high",
      potentialImpact: "Shifts operational utility costs directly to the tenant, increasing overall monthly occupancy expenses. Adjust operational budgets accordingly."
    },
    {
      page: "3",
      tableName: "Utility Responsibilities Schedule",
      type: "row_added",
      description: "Added a row for High-Speed Fiber Internet fee structure ($50/mo flat fee).",
      originalText: "",
      revisedText: "+ Fiber Internet | Flat Fee | $50.00/mo | Tenant",
      severity: "medium",
      potentialImpact: "Introduces a mandatory flat monthly fee. Check if the internet speed aligns with business-class requirements before signing."
    }
  ],
  visualChanges: [
    {
      page: "1",
      type: "logo_replaced",
      description: "Landlord logo updated from 'Apex Holdings LLC' to 'Aegis Property Management Group'.",
      originalText: "Image Logo: 'Apex Holdings' with blue triangle symbol.",
      revisedText: "Image Logo: 'Aegis Property Management' with clean minimalist shield emblem.",
      severity: "low",
      potentialImpact: "Indicates corporate branding or manager transition. Update notice dispatch addresses and invoicing systems to reflect the new management group."
    },
    {
      page: "4",
      type: "layout_shifted",
      description: "Signature block moved from page 5 to page 4 due to compact margins.",
      originalText: "Signature blocks printed on separate Page 5 lease rider.",
      revisedText: "Signature blocks condensed and shifted to bottom of Page 4.",
      severity: "low",
      potentialImpact: "Purely structural layout optimization to save space. No legal risk identified, but verify all signatures land on the final execution page."
    }
  ]
};

const parseInlineMarkdown = (text: string) => {
  const tokenRegex = /(\*\*.*?\*\*|\*.*?\*)/g;
  const rawParts = text.split(tokenRegex);
  
  return rawParts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} style={{ color: '#0f172a', fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index} style={{ fontStyle: 'italic', color: '#4b5563' }}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
};

const renderMarkdownAsHtml = (md: string) => {
  if (!md) return null;
  
  const lines = md.split('\n');
  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif", color: '#334155', lineHeight: '1.7', fontSize: '13.5px', textAlign: 'left' }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        
        // Horizontal Rule
        if (trimmed === '---') {
          return <hr key={idx} style={{ border: 'none', borderTop: '2px solid #cbd5e1', margin: '20px 0' }} />;
        }
        
        // H1
        if (trimmed.startsWith('# ')) {
          return <h1 key={idx} style={{ fontSize: '24px', color: '#002A5D', fontWeight: 800, margin: '24px 0 12px', borderBottom: '2px solid #002A5D', paddingBottom: '8px', fontFamily: "'Raleway', sans-serif" }}>{trimmed.slice(2)}</h1>;
        }
        
        // H2
        if (trimmed.startsWith('## ')) {
          return <h2 key={idx} style={{ fontSize: '16px', color: '#002A5D', fontWeight: 700, margin: '20px 0 10px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', fontFamily: "'Raleway', sans-serif" }}>{trimmed.slice(3)}</h2>;
        }
        
        // H3
        if (trimmed.startsWith('### ')) {
          const content = trimmed.slice(4);
          return (
            <h3 key={idx} style={{ fontSize: '13px', color: '#475569', fontWeight: 700, margin: '16px 0 8px' }}>
              {parseInlineMarkdown(content)}
            </h3>
          );
        }
        
        // List Item
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
          const content = trimmed.slice(2);
          return (
            <div key={idx} style={{ paddingLeft: '20px', textIndent: '-20px', margin: '8px 0', color: '#334155' }}>
              <span style={{ color: '#007E9E', marginRight: '8px', fontWeight: 'bold' }}>•</span>
              {parseInlineMarkdown(content)}
            </div>
          );
        }
        
        // Empty Line
        if (!trimmed) {
          return <div key={idx} style={{ height: '8px' }} />;
        }
        
        // Regular Paragraph
        return (
          <p key={idx} style={{ margin: '0 0 10px 0', color: '#334155' }}>
            {parseInlineMarkdown(line)}
          </p>
        );
      })}
    </div>
  );
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
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  // Chat State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isStorageOpen, setIsStorageOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<'summary' | 'text' | 'tables' | 'visuals'>('summary');

  // Navigation Page State
  const [activePage, setActivePage] = useState<'compare' | 'publisher'>('compare');

  // Publisher Metadata State
  const [publisherTitle, setPublisherTitle] = useState('PCG Document Comparison Report');
  const [auditDate, setAuditDate] = useState(new Date().toISOString().split('T')[0]);
  const [auditNotes, setAuditNotes] = useState('The documents have been compared and reviewed. All identified modifications, deletions, and additions have been logged below. The final version is approved for SharePoint filing.');
  const [includeTextChanges, setIncludeTextChanges] = useState(true);
  const [includeTableChanges, setIncludeTableChanges] = useState(true);
  const [includeVisualChanges, setIncludeVisualChanges] = useState(true);
  const [showPotentialImpact, setShowPotentialImpact] = useState(true);
  const [comparisonMode, setComparisonMode] = useState<'standard' | 'thorough'>('standard');
  const [isCopied, setIsCopied] = useState(false);
  const [isCopiedMd, setIsCopiedMd] = useState(false);
  const [publisherViewMode, setPublisherViewMode] = useState<'html' | 'markdown' | 'database' | 'interactive'>('html');
  const [isCopiedJson, setIsCopiedJson] = useState(false);
  const [isCopiedSql, setIsCopiedSql] = useState(false);
  const [dbJson, setDbJson] = useState('');
  const [dbSql, setDbSql] = useState('');
  const [isRefreshingDb, setIsRefreshingDb] = useState(false);
  const [changeChats, setChangeChats] = useState<Record<string, ChatMessage[]>>({});
  const [changeInputs, setChangeInputs] = useState<Record<string, string>>({});
  const [changeLoading, setChangeLoading] = useState<Record<string, boolean>>({});
  const [expandedExplainer, setExpandedExplainer] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const thinkingConsoleRef = useRef<HTMLDivElement>(null);

  const [loadingStep, setLoadingStep] = useState(0);

  // Helper to format streaming markdown/plain-text thoughts into beautiful HTML
  const renderFormattedThinking = (text: string) => {
    if (!text.trim()) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontStyle: 'italic', fontSize: '13px' }}>
          <RefreshCw size={12} className="spin" style={{ animation: 'spin 2s linear infinite', transformOrigin: 'center', display: 'inline-block', color: '#015294' }} />
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
                      return <strong key={partIdx} style={{ color: '#0f172a', fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
                    }
                    if (part.startsWith('**')) {
                      return <strong key={partIdx} style={{ color: '#0f172a', fontWeight: 600 }}>{part.slice(2)}</strong>;
                    }
                    return part;
                  });

                  return (
                    <div key={itemIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', paddingLeft: '4px' }}>
                      <span style={{ color: '#015294', fontSize: '10px', marginTop: '3px', flexShrink: 0 }}>•</span>
                      <span style={{ fontSize: '13px', color: '#334155', lineHeight: 1.4 }}>
                        {content}
                        {isLastLine && (
                          <span style={{
                            display: 'inline-block',
                            width: '8px',
                            height: '14px',
                            background: '#015294',
                            marginLeft: '6px',
                            verticalAlign: 'middle',
                            animation: 'pulse 1.5s infinite ease-in-out',
                            borderRadius: '1px'
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
                  color: '#015294', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  borderBottom: '1px solid #e2e8f0',
                  paddingBottom: '6px',
                  marginTop: paraIdx > 0 ? '8px' : '0'
                }}>
                  <span style={{ width: '3px', height: '14px', background: '#015294', borderRadius: '1.5px', flexShrink: 0 }}></span>
                  <span>
                    {headerText}
                    {isLastLine && lines.length === 1 && (
                      <span style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '14px',
                        background: '#015294',
                        marginLeft: '6px',
                        verticalAlign: 'middle',
                        animation: 'pulse 1.5s infinite ease-in-out',
                        borderRadius: '1px'
                      }} />
                    )}
                  </span>
                </div>
                {lines.slice(1).map((line, lineIdx) => {
                  const parts = line.split(/(\*\*.*?\*\*)/g);
                  const isLastLineOfAll = paraIdx === paragraphs.length - 1 && lineIdx === lines.length - 2;
                  
                  const content = parts.map((part, partIdx) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                      return <strong key={partIdx} style={{ color: '#0f172a', fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
                    }
                    if (part.startsWith('**')) {
                      return <strong key={partIdx} style={{ color: '#0f172a', fontWeight: 600 }}>{part.slice(2)}</strong>;
                    }
                    return part;
                  });

                  return (
                    <p key={lineIdx} style={{ margin: 0, fontSize: '13px', color: '#334155', lineHeight: 1.5 }}>
                      {content}
                      {isLastLineOfAll && (
                        <span style={{
                          display: 'inline-block',
                          width: '8px',
                          height: '14px',
                          background: '#015294',
                          marginLeft: '6px',
                          verticalAlign: 'middle',
                          animation: 'pulse 1.5s infinite ease-in-out',
                          borderRadius: '1px'
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
                    return <strong key={partIdx} style={{ color: '#0f172a', fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
                  }
                  if (part.startsWith('**')) {
                    return <strong key={partIdx} style={{ color: '#0f172a', fontWeight: 600 }}>{part.slice(2)}</strong>;
                  }
                  return part;
                });

                return (
                  <p key={lineIdx} style={{ margin: 0, fontSize: '13px', color: '#334155', lineHeight: 1.5 }}>
                    {content}
                    {isLastLine && (
                      <span style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '14px',
                        background: '#015294',
                        marginLeft: '6px',
                        verticalAlign: 'middle',
                        animation: 'pulse 1.5s infinite ease-in-out',
                        borderRadius: '1px'
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

  useEffect(() => {
    if (report) {
      setDbJson(generateJSONPayload());
      setDbSql(generateSQLScript());
    }
  }, [report, publisherTitle, auditDate, auditNotes, includeTextChanges, includeTableChanges, includeVisualChanges, showPotentialImpact]);

  const handleRefreshDatabaseExport = () => {
    setIsRefreshingDb(true);
    setTimeout(() => {
      setDbJson(generateJSONPayload());
      setDbSql(generateSQLScript());
      setIsRefreshingDb(false);
    }, 400);
  };

  const getSemanticDetails = (description: string = '', originalText: string = '', revisedText: string = '', severity: string = '', type: string = '') => {
    const descLower = description.toLowerCase();
    const origLower = (originalText || '').toLowerCase();
    const revLower = (revisedText || '').toLowerCase();
    const textCombo = `${descLower} ${origLower} ${revLower}`;

    let category = 'Stylistic & Clarification';
    let categoryDesc = 'Refines clause descriptions or updates definitions without altering basic duties.';
    let icon = '📝';
    let color = '#475569';
    let bg = '#f1f5f9';

    let obligation = 'Obligation Neutral';
    let obligationIcon = '🔄';
    let obligationColor = '#475569';

    // Categories
    if (textCombo.includes('late fee') || textCombo.includes('billing') || textCombo.includes('payment') || textCombo.includes('rate') || textCombo.includes('price') || textCombo.includes('cost') || textCombo.includes('dollar') || textCombo.includes('rent') || textCombo.includes('$') || textCombo.includes('amount') || textCombo.includes('interest')) {
      category = 'Financial Liability';
      categoryDesc = 'Affects billing rate, payment obligation, rent costs, or currency terms.';
      icon = '💼';
      color = '#007E9E';
      bg = 'rgba(0, 126, 158, 0.08)';
    } else if (textCombo.includes('date') || textCombo.includes('period') || textCombo.includes('day') || textCombo.includes('days') || textCombo.includes('month') || textCombo.includes('timeline') || textCombo.includes('schedule') || textCombo.includes('calendar') || textCombo.includes('term') || textCombo.includes('duration') || textCombo.includes('renew') || textCombo.includes('grace')) {
      category = 'Operational Timeline';
      categoryDesc = 'Adjusts operational timelines, lease durations, grace periods, or schedules.';
      icon = '⏱️';
      color = '#21874c';
      bg = 'rgba(33, 135, 76, 0.08)';
    } else if (textCombo.includes('indemni') || textCombo.includes('liability') || textCombo.includes('legal') || textCombo.includes('law') || textCombo.includes('breach') || textCombo.includes('force majeure') || textCombo.includes('jurisdiction') || textCombo.includes('court') || textCombo.includes('govern') || textCombo.includes('arbitration') || textCombo.includes('dispute') || textCombo.includes('severability')) {
      category = 'Legal & Liability Shift';
      categoryDesc = 'Modifies legal risk allocation, indemnification, or legal governance clauses.';
      icon = '⚖️';
      color = '#015294';
      bg = 'rgba(1, 82, 148, 0.08)';
    } else if (textCombo.includes('logo') || textCombo.includes('font') || textCombo.includes('spacing') || textCombo.includes('layout') || textCombo.includes('column') || textCombo.includes('look') || textCombo.includes('style') || textCombo.includes('format') || textCombo.includes('color') || textCombo.includes('chart') || textCombo.includes('diagram') || textCombo.includes('image') || textCombo.includes('visual')) {
      category = 'Visual & Aesthetic';
      categoryDesc = 'Alters logo placement, typography styles, layout formatting, or charts.';
      icon = '🎨';
      color = '#a21caf';
      bg = 'rgba(162, 28, 175, 0.08)';
    }

    // Obligation Shift
    const isHighMed = severity === 'high' || severity === 'medium';
    if (type === 'added' || type === 'modified' || type === 'row_added' || type === 'value_modified') {
      if (isHighMed) {
        obligation = 'Burden Increased';
        obligationIcon = '📈';
        obligationColor = '#dc2626';
      } else {
        obligation = 'Minor Obligation Shift';
        obligationIcon = '↗️';
        obligationColor = '#d97706';
      }
    } else if (type === 'deleted' || type === 'row_deleted') {
      obligation = 'Obligation Reduced';
      obligationIcon = '📉';
      obligationColor = '#16a34a';
    }

    return { category, categoryDesc, icon, color, bg, obligation, obligationIcon, obligationColor };
  };

  const handleSendChangeMessage = async (cardKey: string, questionText: string, category: string, change: any) => {
    if (!questionText.trim() || !fileA || !fileB) return;

    const userMsg = { role: 'user' as const, content: questionText };
    setChangeChats(prev => ({
      ...prev,
      [cardKey]: [...(prev[cardKey] || []), userMsg]
    }));

    setChangeInputs(prev => ({
      ...prev,
      [cardKey]: ''
    }));

    setChangeLoading(prev => ({
      ...prev,
      [cardKey]: true
    }));

    const customPrompt = `Regarding this specific document difference:
- Category: ${category}
- Page: ${change.page}
- Description: ${change.description}
- Original Text: ${change.originalText || "N/A"}
- Revised Text: ${change.revisedText || "N/A"}
- Potential Impact: ${change.potentialImpact || "N/A"}

User question about this specific difference: ${questionText}`;

    if (isDemoMode) {
      setTimeout(() => {
        let reply = `Based on the document context, this revision represents a shift in terms. Let me know if you would like me to analyze liability or operational impact in detail.`;
        const lowQ = questionText.toLowerCase();
        if (lowQ.includes('risk') || lowQ.includes('liability')) {
          reply = `From a risk standpoint, this change is classified as ${change.severity} severity. The potential impact is: "${change.potentialImpact || 'No specific impact logged.'}" It may require operational review.`;
        } else if (lowQ.includes('summarize') || lowQ.includes('simple')) {
          reply = `In simple terms: The original document state "${change.originalText || '[None]'}" was replaced with "${change.revisedText || '[None]'}" because of the following change: "${change.description}".`;
        } else if (lowQ.includes('why') || lowQ.includes('reason')) {
          reply = `This change is part of the document revisions to update terms. The description states: "${change.description}".`;
        }
        const agentMsg = { role: 'agent' as const, content: reply };
        setChangeChats(prev => ({
          ...prev,
          [cardKey]: [...(prev[cardKey] || []), agentMsg]
        }));
        setChangeLoading(prev => ({
          ...prev,
          [cardKey]: false
        }));
      }, 1000);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filenameA: fileA,
          filenameB: fileB,
          messages: changeChats[cardKey] || [],
          message: customPrompt
        })
      });

      const data = await res.json();
      if (res.ok && data.reply) {
        const agentMsg = { role: 'agent' as const, content: data.reply };
        setChangeChats(prev => ({
          ...prev,
          [cardKey]: [...(prev[cardKey] || []), agentMsg]
        }));
      } else {
        const errorMsg = { role: 'agent' as const, content: `Error: ${data.error || "Failed to get response."}` };
        setChangeChats(prev => ({
          ...prev,
          [cardKey]: [...(prev[cardKey] || []), errorMsg]
        }));
      }
    } catch (err) {
      const errorMsg = { role: 'agent' as const, content: "Error communicating with comparison chatbot backend." };
      setChangeChats(prev => ({
        ...prev,
        [cardKey]: [...(prev[cardKey] || []), errorMsg]
      }));
    } finally {
      setChangeLoading(prev => ({
        ...prev,
        [cardKey]: false
      }));
    }
  };

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
    setComparisonError(null);

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
        body: JSON.stringify({ filenameA: fileA, filenameB: fileB, mode: comparisonMode })
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
                setComparisonError(data.error || "Comparison failed");
              }
            } else if (data.type === 'error') {
              setComparisonError(`Comparison Error: ${data.error}`);
            }
          } catch (err) {
            console.error("JSON parse error on stream line", err, line);
          }
        }
      }
    } catch (err: any) {
      setComparisonError(`Error reaching backend: ${err.message}. Check if the server is running on port 5001.`);
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

  const copyHTMLReport = () => {
    if (!report) return;

    let htmlSecText = 0;
    let htmlSecTable = 0;
    let htmlSecVisual = 0;
    let htmlSecSignoff = 0;
    let currentHtmlNum = 1;
    if (includeTextChanges) { currentHtmlNum++; htmlSecText = currentHtmlNum; }
    if (includeTableChanges) { currentHtmlNum++; htmlSecTable = currentHtmlNum; }
    if (includeVisualChanges) { currentHtmlNum++; htmlSecVisual = currentHtmlNum; }
    if (auditNotes.trim()) { currentHtmlNum++; htmlSecSignoff = currentHtmlNum; }

    const getSeverityColorHex = (sev: 'low' | 'medium' | 'high') => {
      switch (sev) {
        case 'high': return '#dc2626';
        case 'medium': return '#d97706';
        default: return '#16a34a';
      }
    };

    const escapeHtml = (text: string) => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    const getDiffHtml = (origText: string, revText: string, side: 'orig' | 'rev') => {
      const { originalSegments, revisedSegments } = computeWordDiff(origText, revText);
      const segments = side === 'orig' ? originalSegments : revisedSegments;
      return segments.map(seg => {
        if (seg.type === 'removed' && side === 'orig') {
          return `<span style="background-color: #ffe2e2; color: #b91c1c; text-decoration: line-through; padding: 1px 3px; border-radius: 2px; font-weight: 600;">${escapeHtml(seg.text)}</span>`;
        }
        if (seg.type === 'added' && side === 'rev') {
          return `<span style="background-color: #fef08a; color: #713f12; padding: 1px 3px; border-radius: 2px; font-weight: 600;">${escapeHtml(seg.text)}</span>`;
        }
        return escapeHtml(seg.text);
      }).join('');
    };

    let html = `
      <div style="font-family: Arial, sans-serif; color: #323639; max-width: 800px; margin: 0 auto; padding: 20px; text-align: left; background-color: #ffffff;">
        <div style="border-bottom: 2px solid #002A5D; padding-bottom: 15px; margin-bottom: 20px;">
          <h1 style="font-family: Arial, sans-serif; font-size: 24px; color: #002A5D; margin: 0; font-weight: bold;">${escapeHtml(publisherTitle)}</h1>
          <p style="font-size: 13px; color: #475569; margin: 5px 0 0 0;">Formal comparison report of corporate documentation.</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
          <tr style="background-color: #f8fafc;">
            <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold; color: #475569; width: 20%;">Original File</td>
            <td style="padding: 10px; border: 1px solid #cbd5e1; color: #0f172a;">${escapeHtml(files.find(f => f.filename === fileA)?.displayName || fileA || '')}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold; color: #475569;">Revised File</td>
            <td style="padding: 10px; border: 1px solid #cbd5e1; color: #0f172a;">${escapeHtml(files.find(f => f.filename === fileB)?.displayName || fileB || '')}</td>
          </tr>
          <tr style="background-color: #f8fafc;">
            <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold; color: #475569;">Comparison Date</td>
            <td style="padding: 10px; border: 1px solid #cbd5e1; color: #0f172a;">${escapeHtml(auditDate)}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold; color: #475569;">Prepared By</td>
            <td style="padding: 10px; border: 1px solid #cbd5e1; color: #0f172a;">
              Anthony Luu
            </td>
          </tr>
        </table>

        <div style="margin-bottom: 25px;">
          <h2 style="font-size: 16px; color: #002A5D; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; font-weight: bold;">1. Executive Summary</h2>
          <p style="font-size: 13px; line-height: 1.6; color: #334155; margin: 10px 0 0 0;">${escapeHtml(report.overallSummary)}</p>
        </div>
    `;

    if (includeTextChanges) {
      html += `
        <div style="margin-bottom: 25px;">
          <h2 style="font-size: 16px; color: #002A5D; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; font-weight: bold;">${htmlSecText}. Text Modifications</h2>
      `;
      if (report.textChanges.length === 0) {
        html += `<p style="font-size: 13px; color: #64748b; font-style: italic;">No text modifications identified.</p>`;
      } else {
        report.textChanges.forEach((change, idx) => {
          html += `
            <div style="border: 1px solid #cbd5e1; border-radius: 4px; padding: 12px; margin-top: 15px; font-size: 13px;">
              <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; color: #475569; margin-bottom: 8px;">
                <span>Page ${escapeHtml(change.page)} • Change #${idx + 1}</span>
                <span style="color: ${getSeverityColorHex(change.severity)}; text-transform: uppercase;">${change.severity} Severity</span>
              </div>
              <p style="font-weight: bold; color: #0f172a; margin: 0 0 10px 0;">${escapeHtml(change.description)}</p>
              <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <tr>
                  <td style="width: 50%; padding: 8px; border: 1px solid #cbd5e1; vertical-align: top; background-color: ${change.type === 'added' ? 'transparent' : '#fef2f2'};">
                    <div style="font-size: 10px; font-weight: bold; color: ${change.type === 'added' ? '#64748b' : '#ef4444'}; text-transform: uppercase; margin-bottom: 4px;">Original</div>
                    ${change.type === 'added' ? '<span style="color: #94a3b8; font-style: italic;">[No text existed]</span>' : getDiffHtml(change.originalText || '', change.revisedText || '', 'orig')}
                  </td>
                  <td style="width: 50%; padding: 8px; border: 1px solid #cbd5e1; vertical-align: top; background-color: ${change.type === 'deleted' ? 'transparent' : '#f0fdf4'};">
                    <div style="font-size: 10px; font-weight: bold; color: ${change.type === 'deleted' ? '#64748b' : '#21874c'}; text-transform: uppercase; margin-bottom: 4px;">Revised</div>
                    ${change.type === 'deleted' ? '<span style="color: #94a3b8; font-style: italic;">[Clause deleted]</span>' : getDiffHtml(change.originalText || '', change.revisedText || '', 'rev')}
                  </td>
                </tr>
              </table>
              ${showPotentialImpact && change.potentialImpact ? `
                <div style="margin-top: 10px; padding: 8px 12px; background-color: #f8fafc; border-left: 3px solid #007E9E; font-size: 12px; color: #475569;">
                  <strong>💡 Context & Potential Impact:</strong> ${escapeHtml(change.potentialImpact)}
                </div>
              ` : ''}
            </div>
          `;
        });
      }
      html += `</div>`;
    }

    if (includeTableChanges) {
      html += `
        <div style="margin-bottom: 25px;">
          <h2 style="font-size: 16px; color: #002A5D; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; font-weight: bold;">${htmlSecTable}. Table Modifications</h2>
      `;
      if (report.tableChanges.length === 0) {
        html += `<p style="font-size: 13px; color: #64748b; font-style: italic;">No table modifications identified.</p>`;
      } else {
        report.tableChanges.forEach((change) => {
          html += `
            <div style="border: 1px solid #cbd5e1; border-radius: 4px; padding: 12px; margin-top: 15px; font-size: 13px;">
              <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; color: #475569; margin-bottom: 8px;">
                <span>Page ${escapeHtml(change.page)} • ${escapeHtml(change.tableName)}</span>
                <span style="color: ${getSeverityColorHex(change.severity)}; text-transform: uppercase;">${change.severity} Severity</span>
              </div>
              <p style="font-weight: bold; color: #0f172a; margin: 0 0 10px 0;">${escapeHtml(change.description)}</p>
              <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <tr>
                  <td style="width: 50%; padding: 8px; border: 1px solid #cbd5e1; vertical-align: top; background-color: ${!change.originalText ? 'transparent' : '#fef2f2'};">
                    <div style="font-size: 10px; font-weight: bold; color: ${!change.originalText ? '#64748b' : '#ef4444'}; text-transform: uppercase; margin-bottom: 4px;">Original</div>
                    ${!change.originalText ? '<span style="color: #94a3b8; font-style: italic;">[No row/cell existed]</span>' : getDiffHtml(change.originalText || '', change.revisedText || '', 'orig')}
                  </td>
                  <td style="width: 50%; padding: 8px; border: 1px solid #cbd5e1; vertical-align: top; background-color: ${!change.revisedText ? 'transparent' : '#f0fdf4'};">
                    <div style="font-size: 10px; font-weight: bold; color: ${!change.revisedText ? '#64748b' : '#21874c'}; text-transform: uppercase; margin-bottom: 4px;">Revised</div>
                    ${!change.revisedText ? '<span style="color: #94a3b8; font-style: italic;">[Row/cell deleted]</span>' : getDiffHtml(change.originalText || '', change.revisedText || '', 'rev')}
                  </td>
                </tr>
              </table>
              ${showPotentialImpact && change.potentialImpact ? `
                <div style="margin-top: 10px; padding: 8px 12px; background-color: #f8fafc; border-left: 3px solid #007E9E; font-size: 12px; color: #475569;">
                  <strong>💡 Context & Potential Impact:</strong> ${escapeHtml(change.potentialImpact)}
                </div>
              ` : ''}
            </div>
          `;
        });
      }
      html += `</div>`;
    }

    if (includeVisualChanges) {
      html += `
        <div style="margin-bottom: 25px;">
          <h2 style="font-size: 16px; color: #002A5D; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; font-weight: bold;">${htmlSecVisual}. Visual & Layout Modifications</h2>
      `;
      if (report.visualChanges.length === 0) {
        html += `<p style="font-size: 13px; color: #64748b; font-style: italic;">No visual modifications identified.</p>`;
      } else {
        report.visualChanges.forEach((change) => {
          html += `
            <div style="border: 1px solid #cbd5e1; border-radius: 4px; padding: 12px; margin-top: 15px; font-size: 13px;">
              <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; color: #475569; margin-bottom: 8px;">
                <span>Page ${escapeHtml(change.page)} • ${escapeHtml(change.type.replace('_', ' ').toUpperCase())}</span>
                <span style="color: ${getSeverityColorHex(change.severity)}; text-transform: uppercase;">${change.severity} Severity</span>
              </div>
              <p style="font-weight: bold; color: #0f172a; margin: 0 0 10px 0;">${escapeHtml(change.description)}</p>
              <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <tr>
                  <td style="width: 50%; padding: 8px; border: 1px solid #cbd5e1; vertical-align: top; background-color: ${!change.originalText ? 'transparent' : '#fef2f2'};">
                    <div style="font-size: 10px; font-weight: bold; color: ${!change.originalText ? '#64748b' : '#ef4444'}; text-transform: uppercase; margin-bottom: 4px;">Original</div>
                    ${!change.originalText ? '<span style="color: #94a3b8; font-style: italic;">[No visual element existed]</span>' : getDiffHtml(change.originalText || '', change.revisedText || '', 'orig')}
                  </td>
                  <td style="width: 50%; padding: 8px; border: 1px solid #cbd5e1; vertical-align: top; background-color: ${!change.revisedText ? 'transparent' : '#f0fdf4'};">
                    <div style="font-size: 10px; font-weight: bold; color: ${!change.revisedText ? '#64748b' : '#21874c'}; text-transform: uppercase; margin-bottom: 4px;">Revised</div>
                    ${!change.revisedText ? '<span style="color: #94a3b8; font-style: italic;">[Visual element deleted]</span>' : getDiffHtml(change.originalText || '', change.revisedText || '', 'rev')}
                  </td>
                </tr>
              </table>
              ${showPotentialImpact && change.potentialImpact ? `
                <div style="margin-top: 10px; padding: 8px 12px; background-color: #f8fafc; border-left: 3px solid #007E9E; font-size: 12px; color: #475569;">
                  <strong>💡 Context & Potential Impact:</strong> ${escapeHtml(change.potentialImpact)}
                </div>
              ` : ''}
            </div>
          `;
        });
      }
      html += `</div>`;
    }

    if (auditNotes.trim()) {
      html += `
        <div style="margin-top: 30px; border-top: 2px solid #cbd5e1; padding-top: 15px;">
          <h2 style="font-size: 16px; color: #002A5D; font-weight: bold; margin-bottom: 10px;">${htmlSecSignoff}. Comparison Notes & Sign-Off</h2>
          <p style="font-size: 13px; line-height: 1.6; color: #334155; margin: 0 0 20px 0; font-style: italic;">${escapeHtml(auditNotes)}</p>
          
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr>
              <td style="width: 50%; padding-top: 30px; padding-bottom: 5px; border-bottom: 1px solid #cbd5e1;"></td>
              <td style="width: 10%; padding-top: 30px; padding-bottom: 5px;"></td>
              <td style="width: 40%; padding-top: 30px; padding-bottom: 5px; border-bottom: 1px solid #cbd5e1;"></td>
            </tr>
            <tr>
              <td style="font-size: 11px; color: #475569; padding-top: 5px;">Authorized Signature: Lead Reviewer</td>
              <td></td>
              <td style="font-size: 11px; color: #475569; padding-top: 5px;">Date: ${escapeHtml(auditDate)}</td>
            </tr>
          </table>
        </div>
      `;
    }

    html += `
      </div>
    `;

    try {
      const blob = new Blob([html], { type: 'text/html' });
      const textBlob = new Blob([html.replace(/<[^>]+>/g, '')], { type: 'text/plain' });
      const item = new (window as any).ClipboardItem({
        'text/html': blob,
        'text/plain': textBlob
      });
      (navigator.clipboard as any).write([item]).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 3000);
      });
    } catch (err) {
      navigator.clipboard.writeText(html).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 3000);
      });
    }
  };

  const generateMarkdownReport = (): string => {
    if (!report) return '';

    let mdSecText = 0;
    let mdSecTable = 0;
    let mdSecVisual = 0;
    let mdSecSignoff = 0;
    let currentMdNum = 1;
    if (includeTextChanges) { currentMdNum++; mdSecText = currentMdNum; }
    if (includeTableChanges) { currentMdNum++; mdSecTable = currentMdNum; }
    if (includeVisualChanges) { currentMdNum++; mdSecVisual = currentMdNum; }
    if (auditNotes.trim()) { currentMdNum++; mdSecSignoff = currentMdNum; }

    const getSeverityLabel = (sev: 'low' | 'medium' | 'high') => {
      return sev.toUpperCase();
    };

    let md = `# ${publisherTitle}\n\n`;
    md += `**Original File:** ${files.find(f => f.filename === fileA)?.displayName || fileA || ''}\n`;
    md += `**Revised File:** ${files.find(f => f.filename === fileB)?.displayName || fileB || ''}\n`;
    md += `**Comparison Date:** ${auditDate}\n`;
    md += `**Prepared By:** Anthony Luu\n\n`;
    md += `---\n\n`;

    md += `## 1. Executive Summary\n`;
    md += `${report.overallSummary}\n\n`;

    if (includeTextChanges) {
      md += `## ${mdSecText}. Text Modifications\n\n`;
      if (report.textChanges.length === 0) {
        md += `No text modifications identified.\n\n`;
      } else {
        report.textChanges.forEach((change, idx) => {
          md += `### Page ${change.page} • Change #${idx + 1} (${getSeverityLabel(change.severity)} Severity)\n`;
          md += `**Description:** ${change.description}\n\n`;
          if (change.type !== 'added') {
            md += `* **Original Text:** ${change.originalText || ''}\n`;
          }
          if (change.type !== 'deleted') {
            md += `* **Revised Text:** ${change.revisedText || ''}\n`;
          }
          if (showPotentialImpact && change.potentialImpact) {
            md += `* **💡 Context & Potential Impact:** ${change.potentialImpact}\n`;
          }
          md += `\n`;
        });
      }
    }

    if (includeTableChanges) {
      md += `## ${mdSecTable}. Table Modifications\n\n`;
      if (report.tableChanges.length === 0) {
        md += `No table modifications identified.\n\n`;
      } else {
        report.tableChanges.forEach((change) => {
          md += `### Page ${change.page} • ${change.tableName} (${getSeverityLabel(change.severity)} Severity)\n`;
          md += `**Description:** ${change.description}\n\n`;
          if (change.originalText) {
            md += `* **Original Table Entry:** ${change.originalText}\n`;
          }
          if (change.revisedText) {
            md += `* **Revised Table Entry:** ${change.revisedText}\n`;
          }
          if (showPotentialImpact && change.potentialImpact) {
            md += `* **💡 Context & Potential Impact:** ${change.potentialImpact}\n`;
          }
          md += `\n`;
        });
      }
    }

    if (includeVisualChanges) {
      md += `## ${mdSecVisual}. Visual & Layout Modifications\n\n`;
      if (report.visualChanges.length === 0) {
        md += `No visual modifications identified.\n\n`;
      } else {
        report.visualChanges.forEach((change) => {
          md += `### Page ${change.page} • ${change.type.replace('_', ' ').toUpperCase()} (${getSeverityLabel(change.severity)} Severity)\n`;
          md += `**Description:** ${change.description}\n\n`;
          if (change.originalText) {
            md += `* **Original Visual Layout:** ${change.originalText}\n`;
          }
          if (change.revisedText) {
            md += `* **Revised Visual Layout:** ${change.revisedText}\n`;
          }
          if (showPotentialImpact && change.potentialImpact) {
            md += `* **💡 Context & Potential Impact:** ${change.potentialImpact}\n`;
          }
          md += `\n`;
        });
      }
    }

    if (auditNotes.trim()) {
      md += `---\n\n`;
      md += `## ${mdSecSignoff}. Comparison Notes & Sign-Off\n`;
      md += `*${auditNotes}*\n\n`;
      md += `**Authorized Signature:** ___________________________ (Lead Reviewer)\n\n`;
      md += `**Sign-off Date:** ${auditDate}\n`;
    }

    return md;
  };

  const copyMarkdownReport = () => {
    const md = generateMarkdownReport();
    if (!md) return;
    navigator.clipboard.writeText(md).then(() => {
      setIsCopiedMd(true);
      setTimeout(() => setIsCopiedMd(false), 3000);
    });
  };

  const downloadMarkdownReport = () => {
    const md = generateMarkdownReport();
    if (!md) return;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${publisherTitle.replace(/\s+/g, '_')}_Comparison_Report.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateJSONPayload = (): string => {
    if (!report) return '';
    
    const payload = {
      comparisonMetadata: {
        title: publisherTitle,
        originalDocument: files.find(f => f.filename === fileA)?.displayName || fileA || '',
        revisedDocument: files.find(f => f.filename === fileB)?.displayName || fileB || '',
        comparisonDate: auditDate,
        preparedBy: 'Anthony Luu',
        overallSummary: report.overallSummary,
        comparisonNotes: auditNotes
      },
      changes: [
        ...(includeTextChanges ? report.textChanges.map(c => ({
          category: 'text',
          page: c.page,
          type: c.type,
          description: c.description,
          originalText: c.originalText || null,
          revisedText: c.revisedText || null,
          severity: c.severity,
          potentialImpact: showPotentialImpact ? (c.potentialImpact || null) : null
        })) : []),
        ...(includeTableChanges ? report.tableChanges.map(c => ({
          category: 'table',
          page: c.page,
          type: c.type,
          tableName: c.tableName,
          description: c.description,
          originalText: c.originalText || null,
          revisedText: c.revisedText || null,
          severity: c.severity,
          potentialImpact: showPotentialImpact ? (c.potentialImpact || null) : null
        })) : []),
        ...(includeVisualChanges ? report.visualChanges.map(c => ({
          category: 'visual',
          page: c.page,
          type: c.type,
          description: c.description,
          originalText: c.originalText || null,
          revisedText: c.revisedText || null,
          severity: c.severity,
          potentialImpact: showPotentialImpact ? (c.potentialImpact || null) : null
        })) : [])
      ]
    };

    return JSON.stringify(payload, null, 2);
  };

  const generateSQLScript = (): string => {
    if (!report) return '';

    const escapeSQL = (str: string | null | undefined): string => {
      if (str === null || str === undefined) return 'NULL';
      return `'${str.replace(/'/g, "''")}'`;
    };

    const origDoc = files.find(f => f.filename === fileA)?.displayName || fileA || '';
    const revDoc = files.find(f => f.filename === fileB)?.displayName || fileB || '';

    let sql = `-- =========================================================\n`;
    sql += `-- PostgreSQL Migration Script for AlloCap Document Comparison\n`;
    sql += `-- Generated on: ${new Date().toISOString()}\n`;
    sql += `-- =========================================================\n\n`;

    sql += `BEGIN;\n\n`;
    
    sql += `-- 1. Insert the Comparison Run record\n`;
    sql += `INSERT INTO document_comparisons (report_title, original_document, revised_document, comparison_date, prepared_by, overall_summary, comparison_notes)\n`;
    sql += `VALUES (\n`;
    sql += `    ${escapeSQL(publisherTitle)},\n`;
    sql += `    ${escapeSQL(origDoc)},\n`;
    sql += `    ${escapeSQL(revDoc)},\n`;
    sql += `    ${escapeSQL(auditDate)},\n`;
    sql += `    'Anthony Luu',\n`;
    sql += `    ${escapeSQL(report.overallSummary)},\n`;
    sql += `    ${escapeSQL(auditNotes)}\n`;
    sql += `);\n\n`;

    sql += `-- 2. Insert individual change entries (using the latest comparison ID)\n`;
    sql += `DO $$\n`;
    sql += `DECLARE\n`;
    sql += `    v_comparison_id INT;\n`;
    sql += `BEGIN\n`;
    sql += `    SELECT id INTO v_comparison_id FROM document_comparisons ORDER BY id DESC LIMIT 1;\n\n`;

    let inserts = '';
    
    if (includeTextChanges) {
      report.textChanges.forEach(c => {
        inserts += `    INSERT INTO comparison_change_entries (comparison_id, change_category, page, change_type, table_name, description, original_text, revised_text, severity, potential_impact)\n`;
        inserts += `    VALUES (v_comparison_id, 'text', ${escapeSQL(c.page)}, ${escapeSQL(c.type)}, NULL, ${escapeSQL(c.description)}, ${escapeSQL(c.originalText)}, ${escapeSQL(c.revisedText)}, ${escapeSQL(c.severity)}, ${escapeSQL(showPotentialImpact ? c.potentialImpact : null)});\n\n`;
      });
    }

    if (includeTableChanges) {
      report.tableChanges.forEach(c => {
        inserts += `    INSERT INTO comparison_change_entries (comparison_id, change_category, page, change_type, table_name, description, original_text, revised_text, severity, potential_impact)\n`;
        inserts += `    VALUES (v_comparison_id, 'table', ${escapeSQL(c.page)}, ${escapeSQL(c.type)}, ${escapeSQL(c.tableName)}, ${escapeSQL(c.description)}, ${escapeSQL(c.originalText)}, ${escapeSQL(c.revisedText)}, ${escapeSQL(c.severity)}, ${escapeSQL(showPotentialImpact ? c.potentialImpact : null)});\n\n`;
      });
    }

    if (includeVisualChanges) {
      report.visualChanges.forEach(c => {
        inserts += `    INSERT INTO comparison_change_entries (comparison_id, change_category, page, change_type, table_name, description, original_text, revised_text, severity, potential_impact)\n`;
        inserts += `    VALUES (v_comparison_id, 'visual', ${escapeSQL(c.page)}, ${escapeSQL(c.type)}, NULL, ${escapeSQL(c.description)}, ${escapeSQL(c.originalText)}, ${escapeSQL(c.revisedText)}, ${escapeSQL(c.severity)}, ${escapeSQL(showPotentialImpact ? c.potentialImpact : null)});\n\n`;
      });
    }

    if (inserts) {
      sql += inserts;
    } else {
      sql += `    -- No changes selected to insert\n`;
    }

    sql += `END $$;\n\n`;
    sql += `COMMIT;\n`;

    return sql;
  };

  const copyJSONPayload = () => {
    const jsonStr = generateJSONPayload();
    if (!jsonStr) return;
    navigator.clipboard.writeText(jsonStr).then(() => {
      setIsCopiedJson(true);
      setTimeout(() => setIsCopiedJson(false), 3000);
    });
  };

  const downloadJSONPayload = () => {
    const jsonStr = generateJSONPayload();
    if (!jsonStr) return;
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${publisherTitle.replace(/\s+/g, '_')}_Comparison_Payload.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copySQLScript = () => {
    const sqlStr = generateSQLScript();
    if (!sqlStr) return;
    navigator.clipboard.writeText(sqlStr).then(() => {
      setIsCopiedSql(true);
      setTimeout(() => setIsCopiedSql(false), 3000);
    });
  };

  const downloadSQLScript = () => {
    const sqlStr = generateSQLScript();
    if (!sqlStr) return;
    const blob = new Blob([sqlStr], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${publisherTitle.replace(/\s+/g, '_')}_Comparison_Ingest.sql`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Dynamic section numbers for HTML print preview
  let printSecText = 0;
  let printSecTable = 0;
  let printSecVisual = 0;
  let printSecSignoff = 0;
  let currentNum = 1;
  if (includeTextChanges) { currentNum++; printSecText = currentNum; }
  if (includeTableChanges) { currentNum++; printSecTable = currentNum; }
  if (includeVisualChanges) { currentNum++; printSecVisual = currentNum; }
  if (auditNotes.trim()) { currentNum++; printSecSignoff = currentNum; }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f2f3', color: '#323639' }}>
      
      {/* Header Bar */}
      <header className="glass-container" style={{ padding: '8px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '55px', zIndex: 30 }}>
        {/* Left: Hamburger Toggle & AlloCAP Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#015294',
              display: 'flex',
              alignItems: 'center',
              padding: '6px',
              borderRadius: '4px',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            title={isSidebarOpen ? "Collapse Navigation" : "Expand Navigation"}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 5H17M3 10H17M3 15H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          <svg width="130" height="30" viewBox="0 0 150 35" fill="none" xmlns="http://www.w3.org/2000/svg">
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
          <h2 style={{ fontSize: '14px', color: '#905F5F', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>PCG Demo Instance</h2>
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
        <aside 
          className="app-sidebar"
          style={{
            marginLeft: isSidebarOpen ? '0' : '-240px',
            transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
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
              
              <button className="nav-sub-item">
                Department Types
              </button>
              
              <button className="nav-sub-item">
                Allocation Types
              </button>
              
              {/* Compare Workspace */}
              <button 
                className={`nav-sub-item ${activePage === 'compare' ? 'active' : ''}`}
                onClick={() => setActivePage('compare')}
              >
                Compare Workspace
              </button>

              {/* Comparison Report Publisher */}
              <button 
                className={`nav-sub-item ${activePage === 'publisher' ? 'active' : ''}`}
                onClick={() => setActivePage('publisher')}
              >
                📜 Comparison Report Publisher
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
        <div 
          className={`storage-drawer ${isStorageOpen ? 'open' : ''}`}
          style={{
            left: isSidebarOpen ? '240px' : '0px',
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), left 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
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
                        padding: '12px 14px', 
                        borderRadius: '6px', 
                        display: 'flex', 
                        flexDirection: 'column',
                        gap: '10px',
                        background: isSelectedA ? 'rgba(1, 82, 148, 0.04)' : isSelectedB ? 'rgba(0, 126, 158, 0.04)' : '#ffffff',
                        borderColor: isSelectedA ? '#015294' : isSelectedB ? '#007E9E' : '#cbd5e1',
                        boxShadow: isSelectedA ? '0 2px 8px rgba(1, 82, 148, 0.08)' : isSelectedB ? '0 2px 8px rgba(0, 126, 158, 0.08)' : '0 1px 3px rgba(0,0,0,0.02)',
                        transition: 'all 0.2s'
                      }}
                    >
                      {/* Top: Icon and wrapped filename */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', width: '100%' }}>
                        <FileText size={15} style={{ color: isSelectedA ? '#015294' : isSelectedB ? '#007E9E' : '#64748b', flexShrink: 0, marginTop: '2px' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', minWidth: 0, flex: 1 }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#1e293b', whiteSpace: 'normal', wordBreak: 'break-all', lineHeight: '1.4' }}>
                            {file.displayName}
                          </span>
                          <span style={{ fontSize: '9.5px', color: '#64748b', marginTop: '3px' }}>{formatBytes(file.size)}</span>
                        </div>
                      </div>
                      
                      {/* Divider Line */}
                      <div style={{ borderTop: '1px solid #e2e8f0', margin: '0 -2px' }}></div>
                      
                      {/* Bottom: Actions Row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        {/* Left: Original / Revised selection pills */}
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => {
                              setFileA(isSelectedA ? null : file.filename);
                              if (isSelectedB) setFileB(null);
                            }}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '9.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              border: isSelectedA ? 'none' : '1px solid rgba(1, 82, 148, 0.4)',
                              background: isSelectedA ? '#015294' : 'transparent',
                              color: isSelectedA ? '#fff' : '#015294',
                              transition: 'all 0.2s'
                            }}
                            title={isSelectedA ? "Unselect Original" : "Set as Original"}
                          >
                            Original
                          </button>
                          
                          <button
                            onClick={() => {
                              setFileB(isSelectedB ? null : file.filename);
                              if (isSelectedA) setFileA(null);
                            }}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '9.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              border: isSelectedB ? 'none' : '1px solid rgba(0, 126, 158, 0.4)',
                              background: isSelectedB ? '#007E9E' : 'transparent',
                              color: isSelectedB ? '#fff' : '#007E9E',
                              transition: 'all 0.2s'
                            }}
                            title={isSelectedB ? "Unselect Revised" : "Set as Revised"}
                          >
                            Revised
                          </button>
                        </div>
                        
                        {/* Right: Utility download / delete icons */}
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <a 
                            href={`${API_BASE}/download/${file.filename}`}
                            style={{ 
                              width: '24px',
                              height: '24px',
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
                            <Download size={11} />
                          </a>
                          
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (confirm(`Are you sure you want to delete ${file.displayName}?`)) {
                                await handleDeleteFile(file.filename);
                              }
                            }}
                            style={{
                              width: '24px',
                              height: '24px',
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
                            <Trash2 size={11} />
                          </button>
                        </div>
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
          {activePage === 'compare' ? (
            <>
              {/* Top-level Configuration Card (Slots selectors & Compare Button) */}
              <div className="glass-card" style={{ padding: '16px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  
                  {/* Slot: Original Select dropdown */}
                  <div 
                    style={{ 
                      padding: '12px 16px', 
                      border: '1px solid',
                      borderColor: fileA ? '#015294' : '#cbd5e1',
                      background: fileA ? 'rgba(1, 82, 148, 0.04)' : '#f8fafc',
                      borderRadius: '6px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '4px', background: fileA ? '#015294' : '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={12} color="#fff" />
                      </div>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>Original Document</span>
                    </div>
                    <select
                      value={fileA || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFileA(val ? val : null);
                        if (val === fileB) setFileB(null); // Clear conflict
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        fontSize: '12.5px',
                        color: '#323639',
                        fontWeight: 500,
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="">-- Choose Original File --</option>
                      {files.map(f => (
                        <option key={f.filename} value={f.filename}>{f.displayName}</option>
                      ))}
                    </select>
                  </div>

                  {/* Slot: Revised Select dropdown */}
                  <div 
                    style={{ 
                      padding: '12px 16px', 
                      border: '1px solid',
                      borderColor: fileB ? '#007E9E' : '#cbd5e1',
                      background: fileB ? 'rgba(0, 126, 158, 0.04)' : '#f8fafc',
                      borderRadius: '6px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '4px', background: fileB ? '#007E9E' : '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={12} color="#fff" />
                      </div>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>Revised Document</span>
                    </div>
                    <select
                      value={fileB || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFileB(val ? val : null);
                        if (val === fileA) setFileA(null); // Clear conflict
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        fontSize: '12.5px',
                        color: '#323639',
                        fontWeight: 500,
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="">-- Choose Revised File --</option>
                      {files.map(f => (
                        <option key={f.filename} value={f.filename}>{f.displayName}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Comparison Mode Selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Comparison Mode</label>
                  <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '6px', padding: '3px', border: '1px solid #e2e8f0' }}>
                    <button
                      onClick={() => setComparisonMode('standard')}
                      disabled={isLoading}
                      style={{
                        flex: 1,
                        padding: '6px 12px',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: comparisonMode === 'standard' ? '#015294' : 'transparent',
                        color: comparisonMode === 'standard' ? '#ffffff' : '#64748b',
                        boxShadow: comparisonMode === 'standard' ? '0 2px 4px rgba(1, 82, 148, 0.2)' : 'none',
                        transition: 'all 0.2s'
                      }}
                    >
                      Standard (Fast)
                    </button>
                    <button
                      onClick={() => setComparisonMode('thorough')}
                      disabled={isLoading}
                      style={{
                        flex: 1,
                        padding: '6px 12px',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: comparisonMode === 'thorough' ? '#015294' : 'transparent',
                        color: comparisonMode === 'thorough' ? '#ffffff' : '#64748b',
                        boxShadow: comparisonMode === 'thorough' ? '0 2px 4px rgba(1, 82, 148, 0.2)' : 'none',
                        transition: 'all 0.2s'
                      }}
                    >
                      Thorough (Page-by-Page)
                    </button>
                  </div>
                  
                  {/* Dynamic Mode Description Card */}
                  <div style={{ marginTop: '4px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px 14px', textAlign: 'left', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.01)' }}>
                    {comparisonMode === 'standard' ? (
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#015294', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>⚡ Standard Mode Active</div>
                        <p style={{ fontSize: '11.5px', color: '#475569', margin: 0, lineHeight: 1.4 }}>
                          Runs a fast, single-pass document scan. Best suited for general audits, formatting edits, and standard contract comparisons, optimized for rapid execution.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#007E9E', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>🔍 Thorough Mode Active</div>
                        <p style={{ fontSize: '11.5px', color: '#475569', margin: 0, lineHeight: 1.4 }}>
                          Executes an exhaustive, page-by-page visual and textual audit. Catching minor single-letter updates, spelling fixes, and layout adjustments. Crucially, this mode <strong>reads and analyzes inline comments, editor annotations, and sign-offs</strong> directly within the document layers.
                        </p>
                      </div>
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
              <div style={{ position: 'relative', minHeight: isLoading ? '600px' : '400px' }}>
                
                {/* Error Banner */}
                {comparisonError && (
                  <div 
                    style={{ 
                      background: '#fff1f2', 
                      border: '1px solid #fda4af', 
                      borderRadius: '8px', 
                      padding: '16px 20px', 
                      marginBottom: '20px',
                      display: 'flex', 
                      gap: '14px', 
                      alignItems: 'flex-start',
                      textAlign: 'left',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)'
                    }}
                  >
                    <div style={{ background: '#e11d48', color: '#fff', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold', flexShrink: 0, marginTop: '2px' }}>!</div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: '0 0 4px 0', color: '#9f1239', fontSize: '14px', fontWeight: 700 }}>Comparison Issue Flagged</h4>
                      <p style={{ margin: 0, fontSize: '13px', color: '#be123c', lineHeight: '1.5' }}>{comparisonError}</p>
                    </div>
                    <button 
                      onClick={() => setComparisonError(null)}
                      style={{ background: 'transparent', border: 'none', color: '#9f1239', cursor: 'pointer', fontWeight: 600, fontSize: '12px', padding: '2px 8px' }}
                    >
                      Dismiss
                    </button>
                  </div>
                )}
                
                {/* 1. Loading Panel */}
                {isLoading && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(255, 255, 255, 0.96)', backdropFilter: 'blur(8px)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', borderRadius: 'var(--border-radius)' }}>
                    <div style={{ maxWidth: '1500px', width: '95%', display: 'grid', gridTemplateColumns: '320px 1fr', gap: '32px', alignItems: 'start' }}>
                      
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

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left', background: '#f8fafc', border: '1px solid #cbd5e1', padding: '20px', borderRadius: '6px', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)' }}>
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
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#015294', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.5px' }}>
                          <RefreshCw size={12} className="spin" style={{ color: '#015294' }} /> Comparison Analysis Log
                        </div>
                        <div 
                          ref={thinkingConsoleRef}
                          style={{ 
                            background: '#f8fafc', 
                            border: '1px solid #cbd5e1', 
                            padding: '16px', 
                            borderRadius: '6px', 
                            height: '450px', 
                            overflowY: 'auto', 
                            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.05)',
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
                  <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '24px', textAlign: 'center' }}>
                    <div style={{ width: '70px', height: '70px', borderRadius: '18px', background: 'rgba(1, 82, 148, 0.05)', border: '1px solid rgba(1, 82, 148, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }} className="pulsing-glow">
                      <FileCheck size={36} style={{ color: '#015294' }} />
                    </div>
                    
                    <div style={{ maxWidth: '600px' }}>
                      <h2 style={{ fontSize: '20px', color: '#203865', marginBottom: '12px' }}>Automated Comparison Workspace</h2>
                      
                      {/* Premium Highlight Card for Instructions */}
                      <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px 20px', textAlign: 'left', display: 'flex', gap: '14px', alignItems: 'flex-start', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)' }}>
                        <div style={{ background: '#015294', color: '#fff', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', flexShrink: 0, marginTop: '2px' }}>i</div>
                        <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, margin: 0 }}>
                          Select the <strong style={{ color: '#015294' }}>Original Document</strong> and <strong style={{ color: '#007E9E' }}>Revised Document</strong> from the dropdowns above (or upload new files in the <strong style={{ color: '#334155' }}>Document Storage</strong> drawer on the left), then click <strong style={{ color: '#015294' }}>Compare Documents</strong> to run the comparison.
                        </p>
                      </div>
                    </div>
                    
                    {/* Feature details grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', width: '100%', maxWidth: '780px', marginTop: '8px' }}>
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
                              <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Prepared By</h4>
                              <div 
                                style={{ 
                                  fontSize: '15px', 
                                  fontWeight: 800, 
                                  color: '#015294',
                                  border: `2px solid #015294`,
                                  padding: '4px 16px',
                                  borderRadius: '20px',
                                  background: '#ffffff'
                                }}
                              >
                                Anthony Luu
                              </div>
                              <span style={{ fontSize: '10px', color: '#64748b' }}>Report Lead</span>
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
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: '#e2e8f0', fontWeight: 700, color: '#334155' }}>Page {change.page}</span>
                                    <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, color: change.type === 'added' ? '#21874c' : change.type === 'deleted' ? '#ef4444' : '#007E9E' }}>
                                      {change.type}
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '10px', textTransform: 'uppercase', color: getSeverityColor(change.severity), fontWeight: 700 }}>{change.severity} risk</span>
                                </div>
                                
                                {/* Highlighted one-sentence description */}
                                <div style={{ 
                                  padding: '8px 12px', 
                                  background: '#f8fafc', 
                                  borderLeft: `3px solid ${getSeverityColor(change.severity)}`, 
                                  borderRadius: '0 4px 4px 0', 
                                  marginBottom: '14px',
                                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.01)'
                                }}>
                                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', margin: 0, lineHeight: 1.4 }}>
                                    {change.description}
                                  </p>
                                </div>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '11.5px' }}>
                                  {/* Before (Original) */}
                                  <div style={{ padding: '12px', background: change.type === 'added' ? 'transparent' : '#fef2f2', border: change.type === 'added' ? '1px dashed #cbd5e1' : '1px solid #fee2e2', borderRadius: '6px', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ fontSize: '9px', textTransform: 'uppercase', color: change.type === 'added' ? '#64748b' : '#ef4444', fontWeight: 700, marginBottom: '6px' }}>Before (Original)</div>
                                    {change.type === 'added' ? (
                                      <div style={{ color: '#94a3b8', fontStyle: 'italic', margin: 'auto 0', fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif", fontSize: '12px' }}>[No text existed in original document]</div>
                                    ) : (
                                      renderOriginalDiffText(change.originalText || '', change.revisedText || '')
                                    )}
                                  </div>
                                  
                                  {/* After (Revised) */}
                                  <div style={{ padding: '12px', background: change.type === 'deleted' ? 'transparent' : '#f0fdf4', border: change.type === 'deleted' ? '1px dashed #cbd5e1' : '1px solid #dcfce7', borderRadius: '6px', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ fontSize: '9px', textTransform: 'uppercase', color: change.type === 'deleted' ? '#64748b' : '#21874c', fontWeight: 700, marginBottom: '6px' }}>After (Revised)</div>
                                    {change.type === 'deleted' ? (
                                      <div style={{ color: '#94a3b8', fontStyle: 'italic', margin: 'auto 0', fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif", fontSize: '12px' }}>[Clause deleted in revised document]</div>
                                    ) : (
                                      renderRevisedDiffText(change.originalText || '', change.revisedText || '')
                                    )}
                                  </div>
                                </div>
                                {showPotentialImpact && change.potentialImpact && (
                                  <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(0, 126, 158, 0.04)', border: '1px solid rgba(0, 126, 158, 0.15)', borderRadius: '6px', textAlign: 'left' }}>
                                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#007E9E', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>💡 Context & Potential Impact</div>
                                    <p style={{ fontSize: '12px', color: '#334155', margin: 0, lineHeight: 1.4 }}>{change.potentialImpact}</p>
                                  </div>
                                )}
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
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: '#e2e8f0', fontWeight: 700, color: '#334155' }}>Page {change.page}</span>
                                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#203865' }}>{change.tableName}</span>
                                    <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, color: '#64748b' }}>
                                      ({change.type.replace('_', ' ')})
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '10px', textTransform: 'uppercase', color: getSeverityColor(change.severity), fontWeight: 700 }}>{change.severity} risk</span>
                                </div>
                                
                                {/* Highlighted one-sentence description */}
                                <div style={{ 
                                  padding: '8px 12px', 
                                  background: '#f8fafc', 
                                  borderLeft: `3px solid ${getSeverityColor(change.severity)}`, 
                                  borderRadius: '0 4px 4px 0', 
                                  marginBottom: '14px',
                                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.01)'
                                }}>
                                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', margin: 0, lineHeight: 1.4 }}>
                                    {change.description}
                                  </p>
                                </div>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '11.5px' }}>
                                  {/* Before (Original) */}
                                  <div style={{ padding: '12px', background: !change.originalText ? 'transparent' : '#fef2f2', border: !change.originalText ? '1px dashed #cbd5e1' : '1px solid #fee2e2', borderRadius: '6px', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ fontSize: '9px', textTransform: 'uppercase', color: !change.originalText ? '#64748b' : '#ef4444', fontWeight: 700, marginBottom: '6px' }}>Before (Original Table)</div>
                                    {!change.originalText ? (
                                      <div style={{ color: '#94a3b8', fontStyle: 'italic', margin: 'auto 0', fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif", fontSize: '12px' }}>[No entry existed in original table]</div>
                                    ) : (
                                      renderOriginalDiffText(change.originalText || '', change.revisedText || '')
                                    )}
                                  </div>
                                  
                                  {/* After (Revised) */}
                                  <div style={{ padding: '12px', background: !change.revisedText ? 'transparent' : '#f0fdf4', border: !change.revisedText ? '1px dashed #cbd5e1' : '1px solid #dcfce7', borderRadius: '6px', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ fontSize: '9px', textTransform: 'uppercase', color: !change.revisedText ? '#64748b' : '#21874c', fontWeight: 700, marginBottom: '6px' }}>After (Revised Table)</div>
                                    {!change.revisedText ? (
                                      <div style={{ color: '#94a3b8', fontStyle: 'italic', margin: 'auto 0', fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif", fontSize: '12px' }}>[Row/cell deleted in revised table]</div>
                                    ) : (
                                      renderRevisedDiffText(change.originalText || '', change.revisedText || '')
                                    )}
                                  </div>
                                </div>
                                {showPotentialImpact && change.potentialImpact && (
                                  <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(0, 126, 158, 0.04)', border: '1px solid rgba(0, 126, 158, 0.15)', borderRadius: '6px', textAlign: 'left' }}>
                                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#007E9E', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>💡 Context & Potential Impact</div>
                                    <p style={{ fontSize: '12px', color: '#334155', margin: 0, lineHeight: 1.4 }}>{change.potentialImpact}</p>
                                  </div>
                                )}
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
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: '#e2e8f0', fontWeight: 700, color: '#334155' }}>Page {change.page}</span>
                                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#21874c', textTransform: 'uppercase' }}>{change.type.replace('_', ' ')}</span>
                                  </div>
                                  <span style={{ fontSize: '10px', textTransform: 'uppercase', color: getSeverityColor(change.severity), fontWeight: 700 }}>{change.severity} risk</span>
                                </div>
                                
                                {/* Highlighted one-sentence description */}
                                <div style={{ 
                                  padding: '8px 12px', 
                                  background: '#f8fafc', 
                                  borderLeft: `3px solid ${getSeverityColor(change.severity)}`, 
                                  borderRadius: '0 4px 4px 0', 
                                  marginBottom: '14px',
                                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.01)'
                                }}>
                                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', margin: 0, lineHeight: 1.4 }}>
                                    {change.description}
                                  </p>
                                </div>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '11.5px' }}>
                                  {/* Before (Original) */}
                                  <div style={{ padding: '12px', background: !change.originalText ? 'transparent' : '#fef2f2', border: !change.originalText ? '1px dashed #cbd5e1' : '1px solid #fee2e2', borderRadius: '6px', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ fontSize: '9px', textTransform: 'uppercase', color: !change.originalText ? '#64748b' : '#ef4444', fontWeight: 700, marginBottom: '6px' }}>Before (Original Visual Layout)</div>
                                    {!change.originalText ? (
                                      <div style={{ color: '#94a3b8', fontStyle: 'italic', margin: 'auto 0', fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif", fontSize: '12px' }}>[No visual element in original layout]</div>
                                    ) : (
                                      renderOriginalDiffText(change.originalText || '', change.revisedText || '')
                                    )}
                                  </div>
                                  
                                  {/* After (Revised) */}
                                  <div style={{ padding: '12px', background: !change.revisedText ? 'transparent' : '#f0fdf4', border: !change.revisedText ? '1px dashed #cbd5e1' : '1px solid #dcfce7', borderRadius: '6px', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ fontSize: '9px', textTransform: 'uppercase', color: !change.revisedText ? '#64748b' : '#21874c', fontWeight: 700, marginBottom: '6px' }}>After (Revised Visual Layout)</div>
                                    {!change.revisedText ? (
                                      <div style={{ color: '#94a3b8', fontStyle: 'italic', margin: 'auto 0', fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif", fontSize: '12px' }}>[Visual element deleted in revised layout]</div>
                                    ) : (
                                      renderRevisedDiffText(change.originalText || '', change.revisedText || '')
                                    )}
                                  </div>
                                </div>
                                {showPotentialImpact && change.potentialImpact && (
                                  <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(0, 126, 158, 0.04)', border: '1px solid rgba(0, 126, 158, 0.15)', borderRadius: '6px', textAlign: 'left' }}>
                                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#007E9E', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>💡 Context & Potential Impact</div>
                                    <p style={{ fontSize: '12px', color: '#334155', margin: 0, lineHeight: 1.4 }}>{change.potentialImpact}</p>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}

                    </div>
                  </div>
                )}

              </div>
            </>
          ) : (
            // Audit Report Publisher Page
            report ? (
              <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px', height: '100%', alignItems: 'start' }} className="no-print-grid">
                
                {/* Left Column: Report Customizer (Settings) */}
                <div className="glass-card report-settings-panel no-print" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <h3 style={{ fontSize: '15px', color: '#203865', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', fontWeight: 700 }}>Report Customizer</h3>
                  
                  {/* Title input */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Report Title</label>
                    <input 
                      type="text" 
                      value={publisherTitle}
                      onChange={(e) => setPublisherTitle(e.target.value)}
                      style={{ padding: '8px 10px', fontSize: '12.5px', border: '1px solid #cbd5e1', borderRadius: '4px', outline: 'none' }}
                    />
                  </div>

                  {/* Date input */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Comparison Date</label>
                    <input 
                      type="date" 
                      value={auditDate}
                      onChange={(e) => setAuditDate(e.target.value)}
                      style={{ padding: '8px 10px', fontSize: '12.5px', border: '1px solid #cbd5e1', borderRadius: '4px', outline: 'none' }}
                    />
                  </div>

                  {/* Auditor Notes input */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Comparison Notes & Sign-off Summary</label>
                    <textarea 
                      value={auditNotes}
                      onChange={(e) => setAuditNotes(e.target.value)}
                      rows={4}
                      style={{ padding: '8px 10px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                    />
                  </div>

                  {/* Section toggles */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Include Sections</span>
                    
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={includeTextChanges}
                        onChange={(e) => setIncludeTextChanges(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span>Text Modifications ({report.textChanges.length})</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={includeTableChanges}
                        onChange={(e) => setIncludeTableChanges(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span>Table Modifications ({report.tableChanges.length})</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={includeVisualChanges}
                        onChange={(e) => setIncludeVisualChanges(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span>Visual Modifications ({report.visualChanges.length})</span>
                    </label>

                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>Display Settings</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={showPotentialImpact}
                        onChange={(e) => setShowPotentialImpact(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span>Show Potential Impact</span>
                    </label>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                    <button 
                      onClick={() => window.print()} 
                      className="btn-primary" 
                      style={{ width: '100%', justifyContent: 'center', padding: '10px 0', fontSize: '13px' }}
                    >
                      <Download size={14} /> Export to PDF
                    </button>
                    
                    <button 
                      onClick={copyHTMLReport} 
                      className="btn-secondary" 
                      style={{ width: '100%', justifyContent: 'center', padding: '10px 0', fontSize: '13px', borderColor: '#007E9E', color: '#007E9E' }}
                    >
                      {isCopied ? "✓ Copied HTML!" : "📋 Copy HTML Report"}
                    </button>

                    <button 
                      onClick={copyMarkdownReport} 
                      className="btn-secondary" 
                      style={{ width: '100%', justifyContent: 'center', padding: '10px 0', fontSize: '13px', borderColor: '#21874c', color: '#21874c' }}
                    >
                      {isCopiedMd ? "✓ Copied Markdown!" : "📋 Copy Markdown"}
                    </button>

                    <button 
                      onClick={downloadMarkdownReport} 
                      className="btn-secondary" 
                      style={{ width: '100%', justifyContent: 'center', padding: '10px 0', fontSize: '13px', borderColor: '#475569', color: '#475569' }}
                    >
                      📥 Download Markdown
                    </button>
                  </div>
                </div>

                {/* Right Column: Paper/Markdown Document Preview */}
                <div className="report-preview-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
                  
                  {/* View Mode Switcher Tab Bar */}
                  <div className="no-print" style={{ display: 'flex', gap: '8px', background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(4px)', padding: '4px', borderRadius: '8px', border: '1px solid #cbd5e1', alignSelf: 'flex-start', marginLeft: 'auto', marginRight: 'auto' }}>
                    <button 
                      onClick={() => setPublisherViewMode('html')}
                      style={{
                        padding: '6px 16px',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: publisherViewMode === 'html' ? '#015294' : 'transparent',
                        color: publisherViewMode === 'html' ? '#ffffff' : '#64748b',
                        boxShadow: publisherViewMode === 'html' ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      📄 HTML Print Preview
                    </button>
                    <button 
                      onClick={() => setPublisherViewMode('markdown')}
                      style={{
                        padding: '6px 16px',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: publisherViewMode === 'markdown' ? '#015294' : 'transparent',
                        color: publisherViewMode === 'markdown' ? '#ffffff' : '#64748b',
                        boxShadow: publisherViewMode === 'markdown' ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      📝 Markdown View
                    </button>
                    <button 
                      onClick={() => setPublisherViewMode('database')}
                      style={{
                        padding: '6px 16px',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: publisherViewMode === 'database' ? '#015294' : 'transparent',
                        color: publisherViewMode === 'database' ? '#ffffff' : '#64748b',
                        boxShadow: publisherViewMode === 'database' ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      ⚙️ Database Export
                    </button>
                    <button 
                      onClick={() => setPublisherViewMode('interactive')}
                      style={{
                        padding: '6px 16px',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: publisherViewMode === 'interactive' ? '#015294' : 'transparent',
                        color: publisherViewMode === 'interactive' ? '#ffffff' : '#64748b',
                        boxShadow: publisherViewMode === 'interactive' ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      AlloCap AI
                    </button>
                  </div>

                  {/* HTML Report Sheet (always rendered, hidden on screen if in markdown mode) */}
                  <div className={`report-paper-page ${publisherViewMode === 'html' ? '' : 'hidden-screen'}`} id="printable-report">
                    
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #002A5D', paddingBottom: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <h1 style={{ fontSize: '22px', color: '#002A5D', fontWeight: 800, margin: 0 }}>{publisherTitle}</h1>
                        <p style={{ fontSize: '12px', color: '#475569', margin: 0 }}>Formal comparison report of corporate documentation.</p>
                      </div>
                      
                      {/* PCG Columns Logo */}
                      <div style={{ flexShrink: 0 }}>
                        <svg width="150" height="40" viewBox="0 0 180 35" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <g transform="translate(0, 2)">
                            <rect x="2" y="26" width="26" height="3" rx="0.5" fill="#002A5D" />
                            <rect x="4" y="24" width="22" height="2" rx="0.5" fill="#002A5D" />
                            <path d="M15 2L3 8H27L15 2Z" fill="#002A5D" />
                            <rect x="5" y="8" width="20" height="2" fill="#002A5D" />
                            <rect x="7" y="10" width="3" height="14" fill="#002A5D" />
                            <rect x="13" y="10" width="4" height="14" fill="#002A5D" />
                            <rect x="20" y="10" width="3" height="14" fill="#002A5D" />
                          </g>
                          <text x="38" y="18" fill="#002A5D" fontFamily="'Raleway', sans-serif" fontSize="11" fontWeight="700" letterSpacing="1">PUBLIC</text>
                          <text x="38" y="28" fill="#64748b" fontFamily="'Raleway', sans-serif" fontSize="8" fontWeight="500" letterSpacing="1.5">CONSULTING GROUP</text>
                        </svg>
                      </div>
                    </div>

                    {/* Metadata Grid */}
                    <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', fontSize: '12px' }}>
                      <div>
                        <span style={{ fontWeight: 600, color: '#475569', display: 'block', textTransform: 'uppercase', fontSize: '9.5px', letterSpacing: '0.5px' }}>Original Document</span>
                        <span style={{ color: '#0f172a', fontWeight: 500, wordBreak: 'break-all' }}>{files.find(f => f.filename === fileA)?.displayName || fileA}</span>
                      </div>
                      <div>
                        <span style={{ fontWeight: 600, color: '#475569', display: 'block', textTransform: 'uppercase', fontSize: '9.5px', letterSpacing: '0.5px' }}>Revised Document</span>
                        <span style={{ color: '#0f172a', fontWeight: 500, wordBreak: 'break-all' }}>{files.find(f => f.filename === fileB)?.displayName || fileB}</span>
                      </div>
                      <div>
                        <span style={{ fontWeight: 600, color: '#475569', display: 'block', textTransform: 'uppercase', fontSize: '9.5px', letterSpacing: '0.5px' }}>Comparison Date</span>
                        <span style={{ color: '#0f172a', fontWeight: 500 }}>{auditDate}</span>
                      </div>
                      <div>
                        <span style={{ fontWeight: 600, color: '#475569', display: 'block', textTransform: 'uppercase', fontSize: '9.5px', letterSpacing: '0.5px' }}>Prepared By</span>
                        <span style={{ color: '#0f172a', fontWeight: 500 }}>Anthony Luu</span>
                      </div>
                    </div>

                    {/* Section 1: Executive Summary */}
                    <div className="print-section" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <h3 style={{ fontSize: '14px', color: '#002A5D', fontWeight: 700, borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>1. Executive Summary</h3>
                      <p style={{ fontSize: '12.5px', color: '#334155', lineHeight: '1.6', margin: 0 }}>
                        {report.overallSummary}
                      </p>
                    </div>

                    {/* Section 2: Text Changes */}
                    {includeTextChanges && (
                      <div className="print-section" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <h3 style={{ fontSize: '14px', color: '#002A5D', fontWeight: 700, borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>{printSecText}. Text Modifications</h3>
                        {report.textChanges.length === 0 ? (
                          <p style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', margin: 0 }}>No text modifications identified.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {report.textChanges.map((change, idx) => (
                              <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                                  <span>Page {change.page} • Change #{idx + 1}</span>
                                  <span style={{ color: getSeverityColor(change.severity), textTransform: 'uppercase' }}>{change.severity} Severity</span>
                                </div>
                                
                                <p style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', margin: 0 }}>
                                  {change.description}
                                </p>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
                                  {/* Original */}
                                  <div className={change.type === 'added' ? '' : 'print-diff-box-removed'} style={{ background: change.type === 'added' ? 'transparent' : '#fef2f2', border: change.type === 'added' ? '1px dashed #cbd5e1' : '1px solid #fee2e2', padding: '8px', borderRadius: '4px' }}>
                                    <div style={{ fontSize: '8.5px', fontWeight: 700, color: change.type === 'added' ? '#64748b' : '#ef4444', textTransform: 'uppercase', marginBottom: '4px' }}>Original</div>
                                    {change.type === 'added' ? (
                                      <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>[No text existed]</span>
                                    ) : (
                                      renderOriginalDiffText(change.originalText || '', change.revisedText || '')
                                    )}
                                  </div>
                                  {/* Revised */}
                                  <div className={change.type === 'deleted' ? '' : 'print-diff-box-added'} style={{ background: change.type === 'deleted' ? 'transparent' : '#f0fdf4', border: change.type === 'deleted' ? '1px dashed #cbd5e1' : '1px solid #dcfce7', padding: '8px', borderRadius: '4px' }}>
                                    <div style={{ fontSize: '8.5px', fontWeight: 700, color: change.type === 'deleted' ? '#64748b' : '#21874c', textTransform: 'uppercase', marginBottom: '4px' }}>Revised</div>
                                    {change.type === 'deleted' ? (
                                      <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>[Clause deleted]</span>
                                    ) : (
                                      renderRevisedDiffText(change.originalText || '', change.revisedText || '')
                                    )}
                                  </div>
                                </div>
                                {showPotentialImpact && change.potentialImpact && (
                                  <div style={{ marginTop: '8px', padding: '6px 10px', background: '#f8fafc', borderLeft: '3px solid #007E9E', fontSize: '11.5px', color: '#4b5563', fontStyle: 'italic' }}>
                                    <strong>Potential Impact:</strong> {change.potentialImpact}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Section 3: Table Changes */}
                    {includeTableChanges && (
                      <div className="print-section" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <h3 style={{ fontSize: '14px', color: '#002A5D', fontWeight: 700, borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>{printSecTable}. Table Modifications</h3>
                        {report.tableChanges.length === 0 ? (
                          <p style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', margin: 0 }}>No table modifications identified.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {report.tableChanges.map((change, idx) => (
                              <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                                  <span>Page {change.page} • {change.tableName}</span>
                                  <span style={{ color: getSeverityColor(change.severity), textTransform: 'uppercase' }}>{change.severity} Severity</span>
                                </div>
                                
                                <p style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', margin: 0 }}>
                                  {change.description}
                                </p>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
                                  {/* Original */}
                                  <div className={!change.originalText ? '' : 'print-diff-box-removed'} style={{ background: !change.originalText ? 'transparent' : '#fef2f2', border: !change.originalText ? '1px dashed #cbd5e1' : '1px solid #fee2e2', padding: '8px', borderRadius: '4px' }}>
                                    <div style={{ fontSize: '8.5px', fontWeight: 700, color: !change.originalText ? '#64748b' : '#ef4444', textTransform: 'uppercase', marginBottom: '4px' }}>Original</div>
                                    {!change.originalText ? (
                                      <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>[No row/cell existed]</span>
                                    ) : (
                                      renderOriginalDiffText(change.originalText || '', change.revisedText || '')
                                    )}
                                  </div>
                                  {/* Revised */}
                                  <div className={!change.revisedText ? '' : 'print-diff-box-added'} style={{ background: !change.revisedText ? 'transparent' : '#f0fdf4', border: !change.revisedText ? '1px dashed #cbd5e1' : '1px solid #dcfce7', padding: '8px', borderRadius: '4px' }}>
                                    <div style={{ fontSize: '8.5px', fontWeight: 700, color: !change.revisedText ? '#64748b' : '#21874c', textTransform: 'uppercase', marginBottom: '4px' }}>Revised</div>
                                    {!change.revisedText ? (
                                      <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>[Row/cell deleted]</span>
                                    ) : (
                                      renderRevisedDiffText(change.originalText || '', change.revisedText || '')
                                    )}
                                  </div>
                                </div>
                                {showPotentialImpact && change.potentialImpact && (
                                  <div style={{ marginTop: '8px', padding: '6px 10px', background: '#f8fafc', borderLeft: '3px solid #007E9E', fontSize: '11.5px', color: '#4b5563', fontStyle: 'italic' }}>
                                    <strong>Potential Impact:</strong> {change.potentialImpact}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Section 4: Visual Changes */}
                    {includeVisualChanges && (
                      <div className="print-section" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <h3 style={{ fontSize: '14px', color: '#002A5D', fontWeight: 700, borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>{printSecVisual}. Visual & Layout Modifications</h3>
                        {report.visualChanges.length === 0 ? (
                          <p style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', margin: 0 }}>No visual modifications identified.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {report.visualChanges.map((change, idx) => (
                              <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                                  <span>Page {change.page} • {change.type.replace('_', ' ').toUpperCase()}</span>
                                  <span style={{ color: getSeverityColor(change.severity), textTransform: 'uppercase' }}>{change.severity} Severity</span>
                                </div>
                                
                                <p style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', margin: 0 }}>
                                  {change.description}
                                </p>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
                                  {/* Original */}
                                  <div className={!change.originalText ? '' : 'print-diff-box-removed'} style={{ background: !change.originalText ? 'transparent' : '#fef2f2', border: !change.originalText ? '1px dashed #cbd5e1' : '1px solid #fee2e2', padding: '8px', borderRadius: '4px' }}>
                                    <div style={{ fontSize: '8.5px', fontWeight: 700, color: !change.originalText ? '#64748b' : '#ef4444', textTransform: 'uppercase', marginBottom: '4px' }}>Original</div>
                                    {!change.originalText ? (
                                      <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>[No visual element existed]</span>
                                    ) : (
                                      renderOriginalDiffText(change.originalText || '', change.revisedText || '')
                                    )}
                                  </div>
                                  {/* Revised */}
                                  <div className={!change.revisedText ? '' : 'print-diff-box-added'} style={{ background: !change.revisedText ? 'transparent' : '#f0fdf4', border: !change.revisedText ? '1px dashed #cbd5e1' : '1px solid #dcfce7', padding: '8px', borderRadius: '4px' }}>
                                    <div style={{ fontSize: '8.5px', fontWeight: 700, color: !change.revisedText ? '#64748b' : '#21874c', textTransform: 'uppercase', marginBottom: '4px' }}>Revised</div>
                                    {!change.revisedText ? (
                                      <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>[Visual element deleted]</span>
                                    ) : (
                                      renderRevisedDiffText(change.originalText || '', change.revisedText || '')
                                    )}
                                  </div>
                                </div>
                                {showPotentialImpact && change.potentialImpact && (
                                  <div style={{ marginTop: '8px', padding: '6px 10px', background: '#f8fafc', borderLeft: '3px solid #007E9E', fontSize: '11.5px', color: '#4b5563', fontStyle: 'italic' }}>
                                    <strong>Potential Impact:</strong> {change.potentialImpact}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Section 5: Comparison Notes & Sign-off */}
                    {auditNotes.trim() && (
                      <div className="print-section" style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '2px solid #e2e8f0', paddingTop: '16px', marginTop: '12px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                        <h3 style={{ fontSize: '14px', color: '#002A5D', fontWeight: 700 }}>{printSecSignoff}. Comparison Notes & Sign-Off</h3>
                        <p style={{ fontSize: '12.5px', color: '#334155', lineHeight: '1.6', margin: 0, fontStyle: 'italic' }}>
                          {auditNotes}
                        </p>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '30px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ borderBottom: '1px solid #cbd5e1', height: '24px' }}></div>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Authorized Signature</span>
                            <span style={{ fontSize: '10px', color: '#64748b' }}>Lead Reviewer</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ borderBottom: '1px solid #cbd5e1', height: '24px' }}></div>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Sign-off Date</span>
                            <span style={{ fontSize: '10px', color: '#64748b' }}>{auditDate}</span>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Markdown Report Sheet (always rendered, hidden on screen if in html mode, never printed) */}
                  <div 
                    className={`report-paper-page markdown-preview-block ${publisherViewMode === 'markdown' ? '' : 'hidden-screen'}`}
                    style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)', padding: '40px 50px', width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '16px' }}
                  >
                    <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace', fontWeight: 600 }}>{publisherTitle.toLowerCase().replace(/\s+/g, '_')}_comparison_report.md</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          onClick={copyMarkdownReport}
                          style={{
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            color: '#334155',
                            padding: '5px 12px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s'
                          }}
                        >
                          {isCopiedMd ? "✓ Copied!" : "📋 Copy Raw Markdown"}
                        </button>
                        <button 
                          onClick={downloadMarkdownReport}
                          style={{
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            color: '#334155',
                            padding: '5px 12px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s'
                          }}
                        >
                          📥 Download Raw Markdown
                        </button>
                      </div>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      {renderMarkdownAsHtml(generateMarkdownReport())}
                    </div>
                  </div>

                  {/* Database Export Sheet (always rendered, hidden on screen if not in database mode, never printed) */}
                  <div 
                    className={`report-paper-page database-preview-block ${publisherViewMode === 'database' ? '' : 'hidden-screen'}`}
                    style={{ 
                      background: '#ffffff', 
                      border: '1px solid #cbd5e1', 
                      borderRadius: '4px', 
                      boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)', 
                      padding: '30px 40px', 
                      width: '100%', 
                      maxWidth: '1000px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '20px' 
                    }}
                  >
                    <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', gap: '20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
                        <h2 style={{ fontSize: '18px', color: '#002A5D', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>⚙️ Database Export Integration</span>
                        </h2>
                        <p style={{ fontSize: '12.5px', color: '#475569', margin: 0, lineHeight: '1.5' }}>
                          Integrate this comparison run directly with your system. We support two integration pathways: a structured <strong>JSON payload</strong> containing the comparison metadata & categorized change logs, or a transaction-wrapped <strong>PostgreSQL DML script</strong> to insert comparison entries (assuming tables exist).
                        </p>
                      </div>
                      <button 
                        onClick={handleRefreshDatabaseExport}
                        disabled={isRefreshingDb}
                        className="btn-primary"
                        style={{ 
                          flexShrink: 0, 
                          background: '#015294', 
                          border: '1px solid #004080', 
                          padding: '10px 16px', 
                          fontSize: '12.5px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          height: 'fit-content'
                        }}
                      >
                        <RefreshCw size={14} className={isRefreshingDb ? 'spin' : ''} />
                        {isRefreshingDb ? "Rerunning..." : "Rerun Export Generation"}
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
                      {/* Top Block: JSON Payload */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0, width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#002A5D', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ padding: '2px 6px', background: 'rgba(0, 126, 158, 0.1)', color: '#007E9E', borderRadius: '4px', fontSize: '10px' }}>JSON</span>
                            Ingestion Payload
                          </span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button 
                              onClick={copyJSONPayload}
                              style={{
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                color: '#334155',
                                padding: '4px 10px',
                                borderRadius: '4px',
                                fontSize: '10.5px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.2s'
                              }}
                            >
                              {isCopiedJson ? "✓ Copied" : "📋 Copy"}
                            </button>
                            <button 
                              onClick={downloadJSONPayload}
                              style={{
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                color: '#334155',
                                padding: '4px 10px',
                                borderRadius: '4px',
                                fontSize: '10.5px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.2s'
                              }}
                            >
                              📥 Download
                            </button>
                          </div>
                        </div>
                        <div style={{ position: 'relative', width: '100%' }}>
                          <pre style={{
                            margin: 0,
                            padding: '16px',
                            background: '#0f172a',
                            color: '#e2e8f0',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontFamily: 'Consolas, Monaco, monospace',
                            overflowX: 'auto',
                            overflowY: 'auto',
                            maxHeight: '450px',
                            border: '1px solid #1e293b',
                            lineHeight: '1.5',
                            textAlign: 'left',
                            width: '100%'
                          }}>
                            <code style={{ display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{dbJson}</code>
                          </pre>
                        </div>
                      </div>

                      {/* Bottom Block: SQL Migration */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0, width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#002A5D', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ padding: '2px 6px', background: 'rgba(33, 135, 76, 0.1)', color: '#21874c', borderRadius: '4px', fontSize: '10px' }}>SQL</span>
                            PostgreSQL Migration
                          </span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button 
                              onClick={copySQLScript}
                              style={{
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                color: '#334155',
                                padding: '4px 10px',
                                borderRadius: '4px',
                                fontSize: '10.5px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.2s'
                              }}
                            >
                              {isCopiedSql ? "✓ Copied" : "📋 Copy"}
                            </button>
                            <button 
                              onClick={downloadSQLScript}
                              style={{
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                color: '#334155',
                                padding: '4px 10px',
                                borderRadius: '4px',
                                fontSize: '10.5px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.2s'
                              }}
                            >
                              📥 Download
                            </button>
                          </div>
                        </div>
                        <div style={{ position: 'relative', width: '100%' }}>
                          <pre style={{
                            margin: 0,
                            padding: '16px',
                            background: '#0f172a',
                            color: '#e2e8f0',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontFamily: 'Consolas, Monaco, monospace',
                            overflowX: 'auto',
                            overflowY: 'auto',
                            maxHeight: '450px',
                            border: '1px solid #1e293b',
                            lineHeight: '1.5',
                            textAlign: 'left',
                            width: '100%'
                          }}>
                            <code style={{ display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{dbSql}</code>
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Interactive AI Analyst Sheet (always rendered, hidden on screen if not in interactive mode, never printed) */}
                  <div 
                    className={`report-paper-page interactive-preview-block ${publisherViewMode === 'interactive' ? '' : 'hidden-screen'}`}
                    style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)', padding: '40px 50px', width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '20px' }}
                  >
                    
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #002A5D', paddingBottom: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <h1 style={{ fontSize: '22px', color: '#002A5D', fontWeight: 800, margin: 0 }}>{publisherTitle}</h1>
                        <p style={{ fontSize: '12px', color: '#475569', margin: 0 }}>Interactive AI-Assisted Document Comparison Analyst & Smart Viewer</p>
                      </div>
                      
                      {/* PCG Columns Logo */}
                      <div style={{ flexShrink: 0 }}>
                        <svg width="150" height="40" viewBox="0 0 180 35" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <g transform="translate(0, 2)">
                            <rect x="2" y="26" width="26" height="3" rx="0.5" fill="#002A5D" />
                            <rect x="4" y="24" width="22" height="2" rx="0.5" fill="#002A5D" />
                            <path d="M15 2L3 8H27L15 2Z" fill="#002A5D" />
                            <rect x="5" y="8" width="20" height="2" fill="#002A5D" />
                            <rect x="7" y="10" width="3" height="14" fill="#002A5D" />
                            <rect x="13" y="10" width="4" height="14" fill="#002A5D" />
                            <rect x="20" y="10" width="3" height="14" fill="#002A5D" />
                          </g>
                          <text x="38" y="18" fill="#002A5D" fontFamily="'Raleway', sans-serif" fontSize="11" fontWeight="700" letterSpacing="1">PUBLIC</text>
                          <text x="38" y="28" fill="#64748b" fontFamily="'Raleway', sans-serif" fontSize="8" fontWeight="500" letterSpacing="1.5">CONSULTING GROUP</text>
                        </svg>
                      </div>
                    </div>

                    {/* Metadata Grid */}
                    <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', fontSize: '12px' }}>
                      <div>
                        <span style={{ fontWeight: 600, color: '#475569', display: 'block', textTransform: 'uppercase', fontSize: '9.5px', letterSpacing: '0.5px' }}>Original Document</span>
                        <span style={{ color: '#0f172a', fontWeight: 500, wordBreak: 'break-all' }}>{files.find(f => f.filename === fileA)?.displayName || fileA}</span>
                      </div>
                      <div>
                        <span style={{ fontWeight: 600, color: '#475569', display: 'block', textTransform: 'uppercase', fontSize: '9.5px', letterSpacing: '0.5px' }}>Revised Document</span>
                        <span style={{ color: '#0f172a', fontWeight: 500, wordBreak: 'break-all' }}>{files.find(f => f.filename === fileB)?.displayName || fileB}</span>
                      </div>
                      <div>
                        <span style={{ fontWeight: 600, color: '#475569', display: 'block', textTransform: 'uppercase', fontSize: '9.5px', letterSpacing: '0.5px' }}>Comparison Date</span>
                        <span style={{ color: '#0f172a', fontWeight: 500 }}>{auditDate}</span>
                      </div>
                      <div>
                        <span style={{ fontWeight: 600, color: '#475569', display: 'block', textTransform: 'uppercase', fontSize: '9.5px', letterSpacing: '0.5px' }}>Prepared By</span>
                        <span style={{ color: '#0f172a', fontWeight: 500 }}>Anthony Luu</span>
                      </div>
                    </div>

                    {/* Section 1: Executive Summary */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <h3 style={{ fontSize: '14px', color: '#002A5D', fontWeight: 700, borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>1. Executive Summary</h3>
                      <p style={{ fontSize: '12.5px', color: '#334155', lineHeight: '1.6', margin: 0 }}>
                        {report.overallSummary}
                      </p>
                    </div>

                    {/* Section 2: Text Changes */}
                    {includeTextChanges && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <h3 style={{ fontSize: '14px', color: '#002A5D', fontWeight: 700, borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>{printSecText}. Text Modifications</h3>
                        {report.textChanges.length === 0 ? (
                          <p style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', margin: 0 }}>No text modifications identified.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {report.textChanges.map((change, idx) => {
                              const sem = getSemanticDetails(change.description, change.originalText, change.revisedText, change.severity, change.type);
                              const cardKey = `text-${idx}`;
                              return (
                                <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', textAlign: 'left' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontWeight: 600, color: '#475569', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                                    <span>Page {change.page} • Change #{idx + 1}</span>
                                    <span style={{ color: getSeverityColor(change.severity), textTransform: 'uppercase', fontSize: '10px', background: 'rgba(0,0,0,0.02)', padding: '2px 6px', borderRadius: '4px' }}>{change.severity} Severity</span>
                                  </div>
                                  
                                  <p style={{ fontSize: '12.5px', fontWeight: 600, color: '#0f172a', margin: 0, padding: '8px 12px', background: '#f8fafc', borderLeft: `3px solid ${getSeverityColor(change.severity)}`, borderRadius: '0 4px 4px 0', lineHeight: '1.4' }}>
                                    {change.description}
                                  </p>

                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
                                    {/* Original */}
                                    <div className={change.type === 'added' ? '' : 'print-diff-box-removed'} style={{ background: change.type === 'added' ? 'transparent' : '#fef2f2', border: change.type === 'added' ? '1px dashed #cbd5e1' : '1px solid #fee2e2', padding: '10px', borderRadius: '4px' }}>
                                      <div style={{ fontSize: '8.5px', fontWeight: 700, color: change.type === 'added' ? '#64748b' : '#ef4444', textTransform: 'uppercase', marginBottom: '6px' }}>Original</div>
                                      {change.type === 'added' ? (
                                        <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>[No text existed]</span>
                                      ) : (
                                        renderOriginalDiffText(change.originalText || '', change.revisedText || '')
                                      )}
                                    </div>
                                    {/* Revised */}
                                    <div className={change.type === 'deleted' ? '' : 'print-diff-box-added'} style={{ background: change.type === 'deleted' ? 'transparent' : '#f0fdf4', border: change.type === 'deleted' ? '1px dashed #cbd5e1' : '1px solid #dcfce7', padding: '10px', borderRadius: '4px' }}>
                                      <div style={{ fontSize: '8.5px', fontWeight: 700, color: change.type === 'deleted' ? '#64748b' : '#21874c', textTransform: 'uppercase', marginBottom: '6px' }}>Revised</div>
                                      {change.type === 'deleted' ? (
                                        <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>[Clause deleted]</span>
                                      ) : (
                                        renderRevisedDiffText(change.originalText || '', change.revisedText || '')
                                      )}
                                    </div>
                                  </div>
                                  
                                  {showPotentialImpact && (
                                    <div style={{ marginTop: '4px', padding: '8px 12px', background: '#f0f9ff', borderLeft: '3px solid #0284c7', fontSize: '11.5px', color: '#0369a1', borderRadius: '0 4px 4px 0', lineHeight: '1.4' }}>
                                      <strong>Potential Impact ({sem.category} - {sem.obligation}):</strong> {change.potentialImpact || "No potential impact analysis logged."}
                                    </div>
                                  )}

                                  {/* AI Explainer */}
                                  <div style={{ marginTop: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                                    <button 
                                      onClick={() => setExpandedExplainer(prev => ({ ...prev, [cardKey]: !prev[cardKey] }))}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#015294',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        transition: 'background 0.2s',
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                                      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                    >
                                      <span>{expandedExplainer[cardKey] ? "Hide AlloCap AI" : "Ask AlloCap AI"}</span>
                                    </button>

                                    {expandedExplainer[cardKey] && (
                                      <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {/* Chat Message Thread */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', padding: '4px' }}>
                                          {(changeChats[cardKey] || []).length === 0 ? (
                                            <div style={{ fontSize: '11.5px', color: '#64748b', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                              <span>Ask a question about this change, or choose a suggested prompt below to analyze its details.</span>
                                            </div>
                                          ) : (
                                            (changeChats[cardKey] || []).map((msg, mIdx) => (
                                              <div key={mIdx} style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                                                <div style={{
                                                  padding: '6px 10px',
                                                  borderRadius: '8px',
                                                  fontSize: '11.5px',
                                                  lineHeight: '1.4',
                                                  background: msg.role === 'user' ? '#015294' : '#e2e8f0',
                                                  color: msg.role === 'user' ? '#ffffff' : '#1e293b',
                                                  border: msg.role === 'user' ? 'none' : '1px solid #cbd5e1'
                                                }}>
                                                  {msg.content}
                                                </div>
                                                <span style={{ fontSize: '9px', color: '#94a3b8', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', marginLeft: '4px', marginRight: '4px' }}>
                                                  {msg.role === 'user' ? 'You' : 'AlloCap AI'}
                                                </span>
                                              </div>
                                            ))
                                          )}
                                          {changeLoading[cardKey] && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start', background: '#e2e8f0', padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '11px', color: '#64748b' }}>
                                              <span>AlloCap AI is thinking...</span>
                                            </div>
                                          )}
                                        </div>

                                        {/* Suggested Questions */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                          <button 
                                            onClick={() => handleSendChangeMessage(cardKey, "Summarize this change in simple terms", sem.category, change)}
                                            disabled={changeLoading[cardKey]}
                                            style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '4px 10px', fontSize: '10px', cursor: 'pointer', color: '#334155', fontWeight: 500, transition: 'all 0.15s' }}
                                            onMouseEnter={(e) => e.currentTarget.style.borderColor = '#015294'}
                                            onMouseLeave={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                                          >
                                            Summarize change
                                          </button>
                                          <button 
                                            onClick={() => handleSendChangeMessage(cardKey, "What is the operational risk or timeline impact of this shift?", sem.category, change)}
                                            disabled={changeLoading[cardKey]}
                                            style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '4px 10px', fontSize: '10px', cursor: 'pointer', color: '#334155', fontWeight: 500, transition: 'all 0.15s' }}
                                            onMouseEnter={(e) => e.currentTarget.style.borderColor = '#015294'}
                                            onMouseLeave={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                                          >
                                            Operational risk?
                                          </button>
                                          <button 
                                            onClick={() => handleSendChangeMessage(cardKey, "Does this change increase legal liability or financial obligations?", sem.category, change)}
                                            disabled={changeLoading[cardKey]}
                                            style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '4px 10px', fontSize: '10px', cursor: 'pointer', color: '#334155', fontWeight: 500, transition: 'all 0.15s' }}
                                            onMouseEnter={(e) => e.currentTarget.style.borderColor = '#015294'}
                                            onMouseLeave={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                                          >
                                            How does this affect liability?
                                          </button>
                                        </div>

                                        {/* Chat Input box */}
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                          <input 
                                            type="text" 
                                            value={changeInputs[cardKey] || ''}
                                            onChange={(e) => setChangeInputs(prev => ({ ...prev, [cardKey]: e.target.value }))}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                handleSendChangeMessage(cardKey, changeInputs[cardKey] || '', sem.category, change);
                                              }
                                            }}
                                            placeholder="Ask a custom question..."
                                            disabled={changeLoading[cardKey]}
                                            style={{ flex: 1, padding: '6px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '11.5px', background: '#ffffff', color: '#0f172a' }}
                                          />
                                          <button 
                                            onClick={() => handleSendChangeMessage(cardKey, changeInputs[cardKey] || '', sem.category, change)}
                                            disabled={changeLoading[cardKey] || !(changeInputs[cardKey] || '').trim()}
                                            style={{
                                              background: '#015294',
                                              color: '#ffffff',
                                              border: 'none',
                                              padding: '6px 12px',
                                              borderRadius: '4px',
                                              fontSize: '11px',
                                              fontWeight: 600,
                                              cursor: 'pointer',
                                              display: 'flex',
                                              alignItems: 'center',
                                              opacity: (changeLoading[cardKey] || !(changeInputs[cardKey] || '').trim()) ? 0.6 : 1
                                            }}
                                          >
                                            Send
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Section 3: Table Changes */}
                    {includeTableChanges && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <h3 style={{ fontSize: '14px', color: '#002A5D', fontWeight: 700, borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>{printSecTable}. Table Modifications</h3>
                        {report.tableChanges.length === 0 ? (
                          <p style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', margin: 0 }}>No table modifications identified.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {report.tableChanges.map((change, idx) => {
                              const sem = getSemanticDetails(change.description, change.originalText, change.revisedText, change.severity, change.type);
                              const cardKey = `table-${idx}`;
                              return (
                                <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', textAlign: 'left' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontWeight: 600, color: '#475569', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                                    <span>Page {change.page} • {change.tableName}</span>
                                    <span style={{ color: getSeverityColor(change.severity), textTransform: 'uppercase', fontSize: '10px', background: 'rgba(0,0,0,0.02)', padding: '2px 6px', borderRadius: '4px' }}>{change.severity} Severity</span>
                                  </div>
                                  
                                  <p style={{ fontSize: '12.5px', fontWeight: 600, color: '#0f172a', margin: 0, padding: '8px 12px', background: '#f8fafc', borderLeft: `3px solid ${getSeverityColor(change.severity)}`, borderRadius: '0 4px 4px 0', lineHeight: '1.4' }}>
                                    {change.description}
                                  </p>

                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
                                    {/* Original */}
                                    <div className={!change.originalText ? '' : 'print-diff-box-removed'} style={{ background: !change.originalText ? 'transparent' : '#fef2f2', border: !change.originalText ? '1px dashed #cbd5e1' : '1px solid #fee2e2', padding: '10px', borderRadius: '4px' }}>
                                      <div style={{ fontSize: '8.5px', fontWeight: 700, color: !change.originalText ? '#64748b' : '#ef4444', textTransform: 'uppercase', marginBottom: '6px' }}>Original</div>
                                      {!change.originalText ? (
                                        <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>[No row/cell existed]</span>
                                      ) : (
                                        renderOriginalDiffText(change.originalText || '', change.revisedText || '')
                                      )}
                                    </div>
                                    {/* Revised */}
                                    <div className={!change.revisedText ? '' : 'print-diff-box-added'} style={{ background: !change.revisedText ? 'transparent' : '#f0fdf4', border: !change.revisedText ? '1px dashed #cbd5e1' : '1px solid #dcfce7', padding: '10px', borderRadius: '4px' }}>
                                      <div style={{ fontSize: '8.5px', fontWeight: 700, color: !change.revisedText ? '#64748b' : '#21874c', textTransform: 'uppercase', marginBottom: '6px' }}>Revised</div>
                                      {!change.revisedText ? (
                                        <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>[Row/cell deleted]</span>
                                      ) : (
                                        renderRevisedDiffText(change.originalText || '', change.revisedText || '')
                                      )}
                                    </div>
                                  </div>
                                  
                                  {showPotentialImpact && (
                                    <div style={{ marginTop: '4px', padding: '8px 12px', background: '#f0f9ff', borderLeft: '3px solid #0284c7', fontSize: '11.5px', color: '#0369a1', borderRadius: '0 4px 4px 0', lineHeight: '1.4' }}>
                                      <strong>Potential Impact ({sem.category} - {sem.obligation}):</strong> {change.potentialImpact || "No potential impact analysis logged."}
                                    </div>
                                  )}

                                  {/* AI Explainer */}
                                  <div style={{ marginTop: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                                    <button 
                                      onClick={() => setExpandedExplainer(prev => ({ ...prev, [cardKey]: !prev[cardKey] }))}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#015294',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        transition: 'background 0.2s',
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                                      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                    >
                                      <span>{expandedExplainer[cardKey] ? "Hide AlloCap AI" : "Ask AlloCap AI"}</span>
                                    </button>

                                    {expandedExplainer[cardKey] && (
                                      <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {/* Chat Message Thread */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', padding: '4px' }}>
                                          {(changeChats[cardKey] || []).length === 0 ? (
                                            <div style={{ fontSize: '11.5px', color: '#64748b', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                              <span>Ask a question about this change, or choose a suggested prompt below to analyze its details.</span>
                                            </div>
                                          ) : (
                                            (changeChats[cardKey] || []).map((msg, mIdx) => (
                                              <div key={mIdx} style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                                                <div style={{
                                                  padding: '6px 10px',
                                                  borderRadius: '8px',
                                                  fontSize: '11.5px',
                                                  lineHeight: '1.4',
                                                  background: msg.role === 'user' ? '#015294' : '#e2e8f0',
                                                  color: msg.role === 'user' ? '#ffffff' : '#1e293b',
                                                  border: msg.role === 'user' ? 'none' : '1px solid #cbd5e1'
                                                }}>
                                                  {msg.content}
                                                </div>
                                                <span style={{ fontSize: '9px', color: '#94a3b8', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', marginLeft: '4px', marginRight: '4px' }}>
                                                  {msg.role === 'user' ? 'You' : 'AlloCap AI'}
                                                </span>
                                              </div>
                                            ))
                                          )}
                                          {changeLoading[cardKey] && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start', background: '#e2e8f0', padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '11px', color: '#64748b' }}>
                                              <span>AlloCap AI is thinking...</span>
                                            </div>
                                          )}
                                        </div>

                                        {/* Suggested Questions */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                          <button 
                                            onClick={() => handleSendChangeMessage(cardKey, "Summarize this change in simple terms", sem.category, change)}
                                            disabled={changeLoading[cardKey]}
                                            style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '4px 10px', fontSize: '10px', cursor: 'pointer', color: '#334155', fontWeight: 500, transition: 'all 0.15s' }}
                                            onMouseEnter={(e) => e.currentTarget.style.borderColor = '#015294'}
                                            onMouseLeave={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                                          >
                                            Summarize change
                                          </button>
                                          <button 
                                            onClick={() => handleSendChangeMessage(cardKey, "What is the operational risk or timeline impact of this shift?", sem.category, change)}
                                            disabled={changeLoading[cardKey]}
                                            style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '4px 10px', fontSize: '10px', cursor: 'pointer', color: '#334155', fontWeight: 500, transition: 'all 0.15s' }}
                                            onMouseEnter={(e) => e.currentTarget.style.borderColor = '#015294'}
                                            onMouseLeave={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                                          >
                                            Operational risk?
                                          </button>
                                          <button 
                                            onClick={() => handleSendChangeMessage(cardKey, "Does this change increase legal liability or financial obligations?", sem.category, change)}
                                            disabled={changeLoading[cardKey]}
                                            style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '4px 10px', fontSize: '10px', cursor: 'pointer', color: '#334155', fontWeight: 500, transition: 'all 0.15s' }}
                                            onMouseEnter={(e) => e.currentTarget.style.borderColor = '#015294'}
                                            onMouseLeave={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                                          >
                                            How does this affect liability?
                                          </button>
                                        </div>

                                        {/* Chat Input box */}
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                          <input 
                                            type="text" 
                                            value={changeInputs[cardKey] || ''}
                                            onChange={(e) => setChangeInputs(prev => ({ ...prev, [cardKey]: e.target.value }))}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                handleSendChangeMessage(cardKey, changeInputs[cardKey] || '', sem.category, change);
                                              }
                                            }}
                                            placeholder="Ask a custom question..."
                                            disabled={changeLoading[cardKey]}
                                            style={{ flex: 1, padding: '6px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '11.5px', background: '#ffffff', color: '#0f172a' }}
                                          />
                                          <button 
                                            onClick={() => handleSendChangeMessage(cardKey, changeInputs[cardKey] || '', sem.category, change)}
                                            disabled={changeLoading[cardKey] || !(changeInputs[cardKey] || '').trim()}
                                            style={{
                                              background: '#015294',
                                              color: '#ffffff',
                                              border: 'none',
                                              padding: '6px 12px',
                                              borderRadius: '4px',
                                              fontSize: '11px',
                                              fontWeight: 600,
                                              cursor: 'pointer',
                                              display: 'flex',
                                              alignItems: 'center',
                                              opacity: (changeLoading[cardKey] || !(changeInputs[cardKey] || '').trim()) ? 0.6 : 1
                                            }}
                                          >
                                            Send
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Section 4: Visual Changes */}
                    {includeVisualChanges && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <h3 style={{ fontSize: '14px', color: '#002A5D', fontWeight: 700, borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>{printSecVisual}. Visual & Layout Modifications</h3>
                        {report.visualChanges.length === 0 ? (
                          <p style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', margin: 0 }}>No visual modifications identified.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {report.visualChanges.map((change, idx) => {
                              const sem = getSemanticDetails(change.description, change.originalText, change.revisedText, change.severity, change.type);
                              const cardKey = `visual-${idx}`;
                              return (
                                <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', textAlign: 'left' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontWeight: 600, color: '#475569', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                                    <span>Page {change.page} • {(change.type || '').replace('_', ' ').toUpperCase()}</span>
                                    <span style={{ color: getSeverityColor(change.severity), textTransform: 'uppercase', fontSize: '10px', background: 'rgba(0,0,0,0.02)', padding: '2px 6px', borderRadius: '4px' }}>{change.severity} Severity</span>
                                  </div>
                                  
                                  <p style={{ fontSize: '12.5px', fontWeight: 600, color: '#0f172a', margin: 0, padding: '8px 12px', background: '#f8fafc', borderLeft: `3px solid ${getSeverityColor(change.severity)}`, borderRadius: '0 4px 4px 0', lineHeight: '1.4' }}>
                                    {change.description}
                                  </p>

                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
                                    {/* Original */}
                                    <div className={!change.originalText ? '' : 'print-diff-box-removed'} style={{ background: !change.originalText ? 'transparent' : '#fef2f2', border: !change.originalText ? '1px dashed #cbd5e1' : '1px solid #fee2e2', padding: '10px', borderRadius: '4px' }}>
                                      <div style={{ fontSize: '8.5px', fontWeight: 700, color: !change.originalText ? '#64748b' : '#ef4444', textTransform: 'uppercase', marginBottom: '6px' }}>Original</div>
                                      {!change.originalText ? (
                                        <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>[No visual element existed]</span>
                                      ) : (
                                        renderOriginalDiffText(change.originalText || '', change.revisedText || '')
                                      )}
                                    </div>
                                    {/* Revised */}
                                    <div className={!change.revisedText ? '' : 'print-diff-box-added'} style={{ background: !change.revisedText ? 'transparent' : '#f0fdf4', border: !change.revisedText ? '1px dashed #cbd5e1' : '1px solid #dcfce7', padding: '10px', borderRadius: '4px' }}>
                                      <div style={{ fontSize: '8.5px', fontWeight: 700, color: !change.revisedText ? '#64748b' : '#21874c', textTransform: 'uppercase', marginBottom: '6px' }}>Revised</div>
                                      {!change.revisedText ? (
                                        <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>[Visual element deleted]</span>
                                      ) : (
                                        renderRevisedDiffText(change.originalText || '', change.revisedText || '')
                                      )}
                                    </div>
                                  </div>
                                  
                                  {showPotentialImpact && (
                                    <div style={{ marginTop: '4px', padding: '8px 12px', background: '#f0f9ff', borderLeft: '3px solid #0284c7', fontSize: '11.5px', color: '#0369a1', borderRadius: '0 4px 4px 0', lineHeight: '1.4' }}>
                                      <strong>Potential Impact ({sem.category} - {sem.obligation}):</strong> {change.potentialImpact || "No potential impact analysis logged."}
                                    </div>
                                  )}

                                  {/* AI Explainer */}
                                  <div style={{ marginTop: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                                    <button 
                                      onClick={() => setExpandedExplainer(prev => ({ ...prev, [cardKey]: !prev[cardKey] }))}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#015294',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        transition: 'background 0.2s',
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                                      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                    >
                                      <span>{expandedExplainer[cardKey] ? "Hide AlloCap AI" : "Ask AlloCap AI"}</span>
                                    </button>

                                    {expandedExplainer[cardKey] && (
                                      <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {/* Chat Message Thread */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', padding: '4px' }}>
                                          {(changeChats[cardKey] || []).length === 0 ? (
                                            <div style={{ fontSize: '11.5px', color: '#64748b', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                              <span>Ask a question about this change, or choose a suggested prompt below to analyze its details.</span>
                                            </div>
                                          ) : (
                                            (changeChats[cardKey] || []).map((msg, mIdx) => (
                                              <div key={mIdx} style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                                                <div style={{
                                                  padding: '6px 10px',
                                                  borderRadius: '8px',
                                                  fontSize: '11.5px',
                                                  lineHeight: '1.4',
                                                  background: msg.role === 'user' ? '#015294' : '#e2e8f0',
                                                  color: msg.role === 'user' ? '#ffffff' : '#1e293b',
                                                  border: msg.role === 'user' ? 'none' : '1px solid #cbd5e1'
                                                }}>
                                                  {msg.content}
                                                </div>
                                                <span style={{ fontSize: '9px', color: '#94a3b8', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', marginLeft: '4px', marginRight: '4px' }}>
                                                  {msg.role === 'user' ? 'You' : 'AlloCap AI'}
                                                </span>
                                              </div>
                                            ))
                                          )}
                                          {changeLoading[cardKey] && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start', background: '#e2e8f0', padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '11px', color: '#64748b' }}>
                                              <span>AlloCap AI is thinking...</span>
                                            </div>
                                          )}
                                        </div>

                                        {/* Suggested Questions */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                          <button 
                                            onClick={() => handleSendChangeMessage(cardKey, "Summarize this change in simple terms", sem.category, change)}
                                            disabled={changeLoading[cardKey]}
                                            style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '4px 10px', fontSize: '10px', cursor: 'pointer', color: '#334155', fontWeight: 500, transition: 'all 0.15s' }}
                                            onMouseEnter={(e) => e.currentTarget.style.borderColor = '#015294'}
                                            onMouseLeave={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                                          >
                                            Summarize change
                                          </button>
                                          <button 
                                            onClick={() => handleSendChangeMessage(cardKey, "What is the operational risk or timeline impact of this shift?", sem.category, change)}
                                            disabled={changeLoading[cardKey]}
                                            style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '4px 10px', fontSize: '10px', cursor: 'pointer', color: '#334155', fontWeight: 500, transition: 'all 0.15s' }}
                                            onMouseEnter={(e) => e.currentTarget.style.borderColor = '#015294'}
                                            onMouseLeave={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                                          >
                                            Operational risk?
                                          </button>
                                          <button 
                                            onClick={() => handleSendChangeMessage(cardKey, "Does this change increase legal liability or financial obligations?", sem.category, change)}
                                            disabled={changeLoading[cardKey]}
                                            style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '4px 10px', fontSize: '10px', cursor: 'pointer', color: '#334155', fontWeight: 500, transition: 'all 0.15s' }}
                                            onMouseEnter={(e) => e.currentTarget.style.borderColor = '#015294'}
                                            onMouseLeave={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                                          >
                                            How does this affect liability?
                                          </button>
                                        </div>

                                        {/* Chat Input box */}
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                          <input 
                                            type="text" 
                                            value={changeInputs[cardKey] || ''}
                                            onChange={(e) => setChangeInputs(prev => ({ ...prev, [cardKey]: e.target.value }))}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                handleSendChangeMessage(cardKey, changeInputs[cardKey] || '', sem.category, change);
                                              }
                                            }}
                                            placeholder="Ask a custom question..."
                                            disabled={changeLoading[cardKey]}
                                            style={{ flex: 1, padding: '6px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '11.5px', background: '#ffffff', color: '#0f172a' }}
                                          />
                                          <button 
                                            onClick={() => handleSendChangeMessage(cardKey, changeInputs[cardKey] || '', sem.category, change)}
                                            disabled={changeLoading[cardKey] || !(changeInputs[cardKey] || '').trim()}
                                            style={{
                                              background: '#015294',
                                              color: '#ffffff',
                                              border: 'none',
                                              padding: '6px 12px',
                                              borderRadius: '4px',
                                              fontSize: '11px',
                                              fontWeight: 600,
                                              cursor: 'pointer',
                                              display: 'flex',
                                              alignItems: 'center',
                                              opacity: (changeLoading[cardKey] || !(changeInputs[cardKey] || '').trim()) ? 0.6 : 1
                                            }}
                                          >
                                            Send
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Section 5: Comparison Notes & Sign-off */}
                    {auditNotes.trim() && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '2px solid #e2e8f0', paddingTop: '16px', marginTop: '12px' }}>
                        <h3 style={{ fontSize: '14px', color: '#002A5D', fontWeight: 700 }}>{printSecSignoff}. Comparison Notes & Sign-Off</h3>
                        <p style={{ fontSize: '12.5px', color: '#334155', lineHeight: '1.6', margin: 0, fontStyle: 'italic' }}>
                          {auditNotes}
                        </p>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '30px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ borderBottom: '1px solid #cbd5e1', height: '24px' }}></div>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Authorized Signature</span>
                            <span style={{ fontSize: '10px', color: '#64748b' }}>Lead Reviewer</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ borderBottom: '1px solid #cbd5e1', height: '24px' }}></div>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Sign-off Date</span>
                            <span style={{ fontSize: '10px', color: '#64748b' }}>{auditDate}</span>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>

                </div>

              </div>
            ) : (
              // No comparison report active
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '24px', textAlign: 'center' }}>
                <div style={{ width: '70px', height: '70px', borderRadius: '18px', background: 'rgba(1, 82, 148, 0.05)', border: '1px solid rgba(1, 82, 148, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }} className="pulsing-glow">
                  <FileCheck size={36} style={{ color: '#015294' }} />
                </div>
                
                <div style={{ maxWidth: '600px' }}>
                  <h2 style={{ fontSize: '20px', color: '#203865', marginBottom: '12px' }}>Comparison Report Publisher</h2>
                  
                  <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', padding: '16px 20px', textAlign: 'left', display: 'flex', gap: '14px', alignItems: 'flex-start', color: '#d97706' }}>
                    <AlertTriangle size={24} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <p style={{ fontSize: '13px', lineHeight: 1.5, margin: 0 }}>
                      <strong>No active comparison report found.</strong> Please select an original and a revised document and click <strong>Compare Documents</strong> in the Compare Workspace first, then navigate back here to publish the report.
                    </p>
                  </div>
                </div>
                
                <button 
                  onClick={() => setActivePage('compare')} 
                  className="btn-primary" 
                  style={{ padding: '10px 20px', fontSize: '13px' }}
                >
                  Go to Compare Workspace
                </button>
              </div>
            )
          )}
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
          <span>AlloCap Updates 2.0 | PCG Demo Instance</span>
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

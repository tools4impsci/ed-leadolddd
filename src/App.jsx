import React, { useState, useMemo, useEffect, useRef, useCallback, useDeferredValue, memo, forwardRef } from 'react';
import { Menu, Bookmark, Search, ChevronDown, ChevronRight, Database, Moon, Sun, Tag, X, FileText, Copy, ArrowUp, Hash, Calendar, Type, ToggleLeft, Check, List, Grid, Maximize, Minimize, Code, Download, Pin, Columns, MoveHorizontal, HelpCircle, User, Clock, Link, ShoppingCart, Filter, RefreshCw, SearchX } from 'lucide-react';
import dictData from './data/dictionary.json';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import FocusLock from 'react-focus-lock';
import toast, { Toaster } from 'react-hot-toast';
import Fuse from 'fuse.js';
import Highlighter from 'react-highlight-words';
import Papa from 'papaparse';

import './App.css';

// Custom hook for debouncing search input
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const PROGRAM_FULL_NAMES = {
  'ECR': 'Emergency Care Redesign (ECR)',
  'CPTI': 'Community Paramedic-led Transitions Intervention (CPTI)',
  'NLTC': 'Nurse-led Telephonic Care (NLTC)'
};

const SAP_AIMS = {
  'Primary Analysis': 'Evaluate the effect of ED-LEAD compared to usual care (UC) on ED utilization within 30 days among PLWD visiting the ED. (SAP version 1.0: ED-LEAD, 2024; p. 11)',
  'Secondary Analysis': 'Evaluate the effect of ED-LEAD compared to usual care (UC) on subsequent acute care utilization at 30 days and 6 months and time to nursing home placement among PLWD. (SAP version 1.0: ED-LEAD, 2024; p. 14)',
  'Covariates': 'Adjust for ED-level stratification variables and patient-level characteristics (age, gender, race/ethnicity, health severity) to provide more efficient estimates and explore subgroup moderations. (SAP version 1.0: ED-LEAD, 2024; p. 13)',
  'Implementation': 'Assess the feasibility, fidelity, and acceptability of the ED-LEAD intervention components across participating sites using mixed methods. (SAP version 1.0: ED-LEAD, 2024; p. 17)'
};

const UNIQUE_INSTRUMENTS = Array.from(new Set(dictData.map(d => d['Instrument / Source']).filter(Boolean))).sort();



const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard!', { position: 'bottom-right' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button 
      className="icon-btn copy-btn" 
      onClick={handleCopy} 
      data-tooltip={copied ? "Copied!" : "Copy to clipboard"}
      aria-label="Copy to clipboard"
    >
      {copied ? <Check size={14} className="success-icon" /> : <Copy size={14} />}
    </button>
  );
};


const getMLClass = (level) => {
  if (!level) return '';
  const l = String(level).toLowerCase();
  if (l.includes('ed')) return 'ml-ed';
  if (l.includes('site leader')) return 'ml-site-leaders';
  if (l.includes('provider')) return 'ml-provider';
  if (l.includes('care partner')) return 'ml-care-partner';
  if (l.includes('plwd')) return 'ml-plwd';
  if (l.includes('encounter')) return 'ml-encounter';
  return '';
};

const getDisplayFields = (item) => {
  const hasLabel = Boolean(item['Label'] && String(item['Label']).trim() !== '');
  const hasDesc = Boolean(item['Description'] && String(item['Description']).trim() !== '');
  let showLabel = hasLabel;
  let showDesc = hasDesc;
  if (hasLabel && hasDesc) {
    if (item['Data Type'] === 'Numeric') {
      showLabel = false;
    } else {
      showDesc = false;
    }
  }
  return { showLabel, showDesc };
};


const FormattedField = ({ value, isCoding, searchTerm }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!value) return null;
  const strValue = String(value);
  
  // Clean mojibake characters
  let cleaned = strValue.replace(/Ã[ƒÂ,Â]+/g, '').replace(/Â/g, '').replace(/Ã/g, '').trim();
  
  // Strip broken image tags
  cleaned = cleaned.replace(/<img[^>]*>/gi, '');

  // Strip inline styles to prevent unreadable text in dark mode (e.g. pale yellow backgrounds)
  cleaned = cleaned.replace(/ style="[^"]*"/gi, '');
  cleaned = cleaned.replace(/ style='[^']*'/gi, '');

  // Clean REDCap prefix
  cleaned = cleaned.replace(/^REDCap:\s*/i, '');

  // Basic HTML detection
  const hasHtml = /<[a-z][\s\S]*>/i.test(cleaned);

  if (hasHtml) {
    return (
      <span 
        className={`field-value html-content ${isCoding ? 'coding' : ''}`}
        dangerouslySetInnerHTML={{ __html: cleaned }}
      />
    );
  }

  const searchWords = searchTerm ? searchTerm.split(' ') : [];

  if (isCoding && (cleaned.includes('|') || cleaned.toUpperCase().startsWith('RTD:'))) {
    let parts = [];
    if (cleaned.includes('|')) {
      parts = cleaned.split('|').map(p => p.trim()).filter(Boolean);
    } else {
      parts = cleaned.substring(4).split(',').map(p => p.trim()).filter(Boolean);
    }
    
    const limit = 5;
    const isLong = parts.length > limit;
    const visibleParts = isExpanded ? parts : parts.slice(0, limit);

    return (
      <div className="field-value coding-list">
        {visibleParts.map((part, idx) => (
          <div key={idx} className="coding-item">
            <Highlighter searchWords={searchWords} textToHighlight={part} highlightClassName="highlight" autoEscape={true} />
          </div>
        ))}
        {isLong && (
          <button 
            className="btn-text" 
            onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
            style={{ marginTop: '0.5rem', fontSize: '0.8rem', opacity: 0.8 }}
          >
            {isExpanded ? 'Show less' : `Show ${parts.length - limit} more`}
          </button>
        )}
      </div>
    );
  }

  return (
    <span className={`field-value ${isCoding ? 'coding' : ''}`}>
      <Highlighter searchWords={searchWords} textToHighlight={cleaned} highlightClassName="highlight" autoEscape={true} />
    </span>
  );
};

const getTypeIcon = (type) => {
  if (!type) return null;
  const t = String(type).toLowerCase();
  if (t.includes('bool')) return <ToggleLeft size={14} />;
  if (t.includes('cat')) return <List size={14} />;
  if (t.includes('str') || t.includes('text')) return <Type size={14} />;
  if (t.includes('date')) return <Calendar size={14} />;
  if (t.includes('num') || t.includes('int') || t.includes('float')) return <Hash size={14} />;
  return null;
};

const getTypeClass = (type) => {
  if (!type) return '';
  const t = String(type).toLowerCase();
  if (t.includes('bool')) return 'boolean';
  if (t.includes('cat')) return 'categorical';
  if (t.includes('str') || t.includes('text')) return 'string';
  if (t.includes('date')) return 'date';
  if (t.includes('num') || t.includes('int') || t.includes('float')) return 'numeric';
  return '';
};

const getInstrumentFilename = (instrumentName) => {
  const name = (instrumentName || '').toLowerCase();
  
  if (name.includes('demo meeting checklist')) {
    if (name.includes('ecr cpti nltc')) return 'DemoMeetingChecklist_ECR_CPTI_NLTC.pdf';
    if (name.includes('ecr cpti')) return 'DemoMeetingChecklist_ECR_CPTI.pdf';
    if (name.includes('ecr nltc')) return 'DemoMeetingChecklist_ECR_NLTC.pdf';
    if (name.includes('cpti nltc')) return 'DemoMeetingChecklist_CPTI_NLTC.pdf';
    if (name.includes('ecr')) return 'DemoMeetingChecklist_ECR.pdf';
    if (name.includes('cpti')) return 'DemoMeetingChecklist_CPTI.pdf';
    if (name.includes('nltc')) return 'DemoMeetingChecklist_NLTC.pdf';
  }

  if (name.includes('cpti post site survey')) return 'CPTIPostSiteSurvey_EDLEAD.pdf';
  if (name.includes('ecr post site survey')) return 'ECRPostSiteSurvey_EDLEAD (2).pdf';
  if (name.includes('site survey')) return 'EDLEADSiteSurvey_EDLEAD (3).pdf';
  if (name.includes('obs unit information')) return 'ObsUnitInformation_EDLEAD.pdf';
  if (name.includes('preimp reflections')) return 'PreimpReflections_EDLEAD.pdf';
  if (name.includes('clinical survey')) return 'ECR Clincial Survey.pdf';
  
  return null;
};

const parseCodingValues = (codingStr) => {
  if (!codingStr) return [];
  let str = String(codingStr).trim();
  if (str.toUpperCase().startsWith('RTD:')) return [];
  
  str = str.replace(/^REDCap:\s*/i, '');
  
  return str.split('|').map(part => {
    const splitIdx = part.indexOf(',');
    if (splitIdx === -1) return null;
    return {
      level: part.substring(0, splitIdx).trim(),
      label: part.substring(splitIdx + 1).trim()
    };
  }).filter(Boolean);
};

const CodeSnippets = ({ variables }) => {
  const [activeLang, setActiveLang] = useState('R');
  
  if (!variables || variables.length === 0) return null;

  const generateSnippet = (lang) => {
    return variables.map(v => {
      const varName = v['Variable Name'];
      const codingStr = v['Values / Coding'];
      const label = String(v['Label'] || v['Description'] || varName).replace(/"/g, "'");
      
      const mappings = parseCodingValues(codingStr);
      
      if (mappings.length > 0) {
        const levelsR = mappings.map(m => isNaN(m.level.trim()) ? `"${m.level}"` : m.level);
        const labelsR = mappings.map(m => `"${m.label.replace(/"/g, "'")}"`);
        
        if (lang === 'R') {
          return `data$${varName} <- factor(data$${varName}, \n  levels = c(${levelsR.join(', ')}), \n  labels = c(${labelsR.join(', ')}))\nattr(data$${varName}, "label") <- "${label}"`;
        } else if (lang === 'Stata') {
          return `label define ${varName}_lbl ${mappings.map(m => `${m.level} "${m.label.replace(/"/g, "'")}"`).join(' ')}\nlabel values ${varName} ${varName}_lbl\nlabel variable ${varName} "${label}"`;
        } else if (lang === 'Python') {
          return `data['${varName}'] = data['${varName}'].map({\n  ${mappings.map(m => `${isNaN(m.level.trim()) ? `"${m.level}"` : m.level}: "${m.label.replace(/"/g, "'")}"`).join(',\n  ')}\n})\n# ${varName}: ${label}`;
        }
      } else {
        if (lang === 'R') {
          return `attr(data$${varName}, "label") <- "${label}"`;
        } else if (lang === 'Stata') {
          return `label variable ${varName} "${label}"`;
        } else if (lang === 'Python') {
          return `# ${varName}: ${label}`;
        }
      }
    }).join('\n\n');
  };

  const snippets = {
    'R': generateSnippet('R'),
    'Stata': generateSnippet('Stata'),
    'Python': generateSnippet('Python')
  };

  return (
    <div className="code-snippets-container">
      <div className="code-lang-tabs">
        {['R', 'Python', 'Stata'].map(lang => (
          <button key={lang} className={activeLang === lang ? 'active' : ''} onClick={() => setActiveLang(lang)}>
            {lang}
          </button>
        ))}
      </div>
      <div className="code-snippet-block" style={{ position: 'relative' }}>
        <SyntaxHighlighter 
          language={activeLang === 'R' ? 'r' : activeLang === 'Stata' ? 'stata' : 'python'} 
          style={vscDarkPlus}
          customStyle={{ margin: 0, padding: '1rem', borderBottomLeftRadius: 'var(--input-radius)', borderBottomRightRadius: 'var(--input-radius)', background: '#1e1e1e', resize: 'vertical', overflow: 'auto', minHeight: '150px' }}
          wrapLongLines={true}
        >
          {snippets[activeLang]}
        </SyntaxHighlighter>
        <CopyButton text={snippets[activeLang]} />
      </div>
    </div>
  );
};

const SortableHeader = ({ id, variable, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    position: isDragging ? 'relative' : 'static',
    zIndex: isDragging ? 999 : 1,
  };

  return (
    <th ref={setNodeRef} style={style} {...attributes} {...listeners} className="sortable-header">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{variable['Variable Name']}</span>
        <button 
          className="icon-btn" 
          onPointerDown={(e) => e.stopPropagation()} 
          onClick={(e) => { e.stopPropagation(); onRemove(variable); }} 
          data-tooltip="Remove from comparison"
        >
          <X size={16} />
        </button>
      </div>
    </th>
  );
};

const LoginScreen = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) return;
    
    try {
      const buffer = new TextEncoder().encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      if (hashHex === 'a31c8f07a80f8475ba3f0ed3777592b1d2f601ea6128adabe0f530e43159871b') {
        sessionStorage.setItem('edlead_auth', 'true');
        onLogin();
      } else {
        setError('Incorrect password. Please try again.');
        setPassword('');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred. Please try again.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div>
          <Database size={48} className="login-logo" />
          <h1>ED-LEAD Data Explorer</h1>
          <p>Please enter the password to continue</p>
        </div>
        
        <form className="login-form" onSubmit={handleSubmit}>
          {error && <div className="login-error">{error}</div>}
          <input 
            type="password" 
            className="login-input" 
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            placeholder="Enter password..."
            autoFocus
          />
          <button type="submit" className="login-btn">
            Unlock Explorer <ChevronRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};


const DataCard = memo(({ 
  item, 
  searchTerm, 

  setPinnedVars, 
  compareList, 
  setCompareList, 
  handleTagClick, 
  openInstrumentModal, 
  setCodeGenModalData,
  viewMode 
}) => {
  const varName = item['Variable Name'] || 'Unnamed';

  const isComparing = compareList.some(v => v._uid === item._uid);
  const { showLabel, showDesc } = getDisplayFields(item);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="data-card" 
      key={item._uid}
    >
      
      {/* ── Card Header: Title, Label, Description ── */}
      <div className="dc-header">
        <div className="dc-title-row">
          <h3 className="dc-var-name">
            <Highlighter searchWords={searchTerm ? searchTerm.split(' ') : []} textToHighlight={varName} highlightClassName="highlight" autoEscape={true} />
          </h3>
          
          <div className="dc-actions">
            <button 
              className="icon-btn" 
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.set('var', varName);
                navigator.clipboard.writeText(url.toString());
                toast.success('Link copied to clipboard!');
              }}
              data-tooltip="Copy link"
              aria-label="Copy link"
            >
              <Link size={16} />
            </button>
            <CopyButton text={varName} />
            <button 
              className={`icon-btn ${isComparing ? 'active' : ''}`}
              style={{ color: isComparing ? 'var(--primary-color)' : 'inherit', background: isComparing ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}
              onClick={(e) => {
                if (!isComparing) {
                  setCompareList(prev => [...prev, item]);
                  toast.success(`Added ${varName} to cart`, { position: 'top-center' });
                } else {
                  setCompareList(prev => prev.filter(v => v._uid !== item._uid));
                  toast(`Removed ${varName} from cart`, { position: 'top-center' });
                }
              }}
              data-tooltip={isComparing ? "Remove from cart" : "Add to cart"}
            >
              <Bookmark size={16} fill={isComparing ? "currentColor" : "none"} />
            </button>
          </div>
        </div>

        {showLabel && (
          <div className="dc-label">
            <FormattedField value={item['Label']} searchTerm={searchTerm} />
          </div>
        )}
        
        {showDesc && (
          <div className="dc-description">
            <FormattedField value={item['Description']} searchTerm={searchTerm} />
          </div>
        )}
      </div>

      {/* ── Metadata Grid: Clean Key-Value Pairs ── */}
      <div className="dc-metadata">
        {item['Data Type'] && (
          <div className="dc-meta-item">
            <span className="dc-meta-label">Type</span>
            <span className="dc-meta-value" style={{ textTransform: 'capitalize' }}>{item['Data Type'].toLowerCase()}</span>
          </div>
        )}
        {item['Measurement Level'] && (
          <div className="dc-meta-item">
            <span className="dc-meta-label">Level</span>
            <span className={`badge ${getMLClass(item['Measurement Level'])}`}>
              {item['Measurement Level']}
            </span>
          </div>
        )}
        {item['Instrument / Source'] && (
          <div className="dc-meta-item">
            <span className="dc-meta-label">Source</span>
            <span className="dc-meta-value dc-source-value">
              {getInstrumentFilename(item['Instrument / Source']) ? (
                <FileText size={14} className="clickable-icon" onClick={() => openInstrumentModal(item['Instrument / Source'])} data-tooltip="View blank instrument PDF" />
              ) : (
                <Database size={14} className="static-icon" />
              )}
              {item['Instrument / Source']}
            </span>
          </div>
        )}
        {item['Program'] && (
          <div className="dc-meta-item">
            <span className="dc-meta-label">Program</span>
            <span className="badge intervention-badge tooltip-left" data-tooltip={`Intervention: ${PROGRAM_FULL_NAMES[item['Program']] || item['Program']}`}>
              {item['Program']}
            </span>
          </div>
        )}
        {item['SAP Category'] && (
          <div className="dc-meta-item">
            <span className="dc-meta-label">Analysis</span>
            <span className="dc-meta-value with-icon">
              <List size={14} /> {item['SAP Category']}
            </span>
          </div>
        )}
      </div>

      {/* ── Logistics ── */}
      {(item['Who Completed'] || item['Timepoints'] || item['When Collected']) && (
        <div className="dc-logistics">
          {item['Who Completed'] && (
            <div className="dc-logic-item">
              <User size={14} />
              <span><strong>Who:</strong> {item['Who Completed']}</span>
            </div>
          )}
          {(item['Timepoints'] || item['When Collected']) && (
            <div className="dc-logic-item">
              <Clock size={14} />
              <span><strong>When:</strong> {item['Timepoints'] || item['When Collected']}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Values / Coding Snippet ── */}
      {item['Values / Coding'] && String(item['Values / Coding']).trim() !== '' && (
        <div className="dc-coding">
          <div className="dc-coding-header">
            <span className="dc-coding-title">Values &amp; Coding</span>
            <div className="dc-coding-actions">
              <button 
                className="icon-btn small-btn" 
                onClick={() => setCodeGenModalData([item])}
                data-tooltip="Generate Analysis Code"
              >
                <Code size={14} />
              </button>
              <CopyButton text={item['Values / Coding']} />
            </div>
          </div>
          <div className="dc-coding-content">
            <FormattedField value={item['Values / Coding']} isCoding searchTerm={searchTerm} />
          </div>
        </div>
      )}

    </motion.div>
  );
});

const CustomSelect = ({ value, onChange, options, label, tooltip }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value) || options[0] || { label: 'Select...', value: '' };

  return (
    <div className="filter-select" data-tooltip={tooltip} style={{ position: 'relative', zIndex: isOpen ? 50 : 1 }} ref={dropdownRef}>
      {label && <label>{label}</label>}
      <button 
        className="select-input multi-select-trigger" 
        onClick={() => setIsOpen(!isOpen)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}
      >
        <span>{selectedOption.label}</span>
        <ChevronDown size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <>
            <div className="multi-select-overlay" onClick={() => setIsOpen(false)} />
            <motion.div 
              className="multi-select-dropdown"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
            >
              {options.map(opt => (
                <button 
                  key={opt.value} 
                  className="multi-select-option" 
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                >
                  <Check 
                    size={16} 
                    style={{ 
                      opacity: value === opt.value ? 1 : 0,
                      color: 'var(--text-secondary)',
                      transition: 'opacity 0.2s',
                      flexShrink: 0,
                      marginTop: '2px'
                    }} 
                  />
                  <span style={{flex: 1}}>{opt.label}</span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};


const MainContentArea = memo(({
  filteredDataLength,
  deferredFilteredData,
  groupedData,
  viewMode,
  groupBy,
  activeTag,
  visibleCount,
  searchTerm,
  compareList,
  expandedGroups,
  isExpandAll,
  isSearching,
  clearAllFilters,
  setPinnedVars,
  setCompareList,
  handleTagClick,
  openInstrumentModal,
  setCodeGenModalData,
  toggleGroup,
  observerTarget
}) => {
  return (
          <main className="main-content-scroll" style={{ padding: '0 3rem 3rem 3rem', width: '100%', boxSizing: 'border-box' }}>
      {filteredDataLength === 0 ? (
        <motion.div 
          className="empty-state"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
            padding: '6rem 2rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px dashed var(--border-color)', 
            marginTop: '2rem'
          }}
        >
          <SearchX size={64} style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', opacity: 0.5 }} />
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>No variables found</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', textAlign: 'center', marginBottom: '1.5rem', lineHeight: 1.6 }}>We couldn't find any variables matching your current filters and search terms.</p>
          <button 
            className="icon-btn active" 
            onClick={clearAllFilters} 
            style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 600 }}
          >
            Clear All Filters
          </button>
        </motion.div>
      ) : groupBy === 'None' ? (
        <>
          {SAP_AIMS[activeTag] && (
            <div style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem', background: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ marginTop: 0, marginBottom: '0.5rem', color: 'var(--text-primary)', fontSize: '1.1rem' }}>{activeTag}</h3>
              <p style={{ margin: 0, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{SAP_AIMS[activeTag]}</p>
            </div>
          )}
          {viewMode === 'table' ? (
            <div className="table-view-container">
              <table className="compact-table">
                <thead>
                  <tr>
                    <th>Variable Name</th>
                    <th>Label / Description</th>
                    <th>Measurement Level</th>
                    <th>Data Type</th>
                    <th>Program</th><th>SAP Category</th>
                  </tr>
                </thead>
                <tbody>
                  {deferredFilteredData.slice(0, visibleCount).map(item => (
                    <tr key={item._uid}>
                      <td style={{fontWeight: 600}}>{item['Variable Name']}</td>
                      <td>
                        <div style={{fontWeight: 500, marginBottom: '0.25rem'}}>{item['Label']}</div>
                        <div style={{color: 'var(--text-secondary)', fontSize: '0.85rem'}}>{item['Description']}</div>
                      </td>
                      <td>
                        {item['Measurement Level'] && (
                          <span className={`badge ${getMLClass(item['Measurement Level'])}`} style={{fontSize: '0.75rem', padding: '2px 6px'}}>{item['Measurement Level']}</span>
                        )}
                      </td>
                      <td>{item['Data Type']}</td>
                      <td>{item['Program']}</td><td>{item['SAP Category']}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
          <div className={`data-grid ${viewMode}`}>
            {deferredFilteredData.slice(0, visibleCount).map((item) => (
              <DataCard 
                key={item._uid}
                item={item}
                searchTerm={searchTerm}
                
                setPinnedVars={setPinnedVars}
                compareList={compareList}
                setCompareList={setCompareList}
                handleTagClick={handleTagClick}
                openInstrumentModal={openInstrumentModal}
                setCodeGenModalData={setCodeGenModalData}
                viewMode={viewMode}
              />
            ))}
          </div>
          )}
          {visibleCount < deferredFilteredData.length && (
            <div ref={observerTarget} style={{ height: '20px', width: '100%', marginTop: '20px' }} />
          )}
        </>
      ) : groupBy === 'Analysis' ? (
        /* ── Analysis Group View: flat sections, no accordion ── */
        <div className="analysis-sections">
          {Object.entries(groupedData).map(([groupName, items]) => {
            const sapClass = groupName === 'Primary Analysis' ? 'sap-primary'
              : groupName === 'Secondary Analysis' ? 'sap-secondary'
              : groupName === 'Covariates' ? 'sap-covariates'
              : groupName === 'Implementation' ? 'sap-implementation' : '';

            return (
              <div className="analysis-section" key={groupName}>
                <div className="analysis-section-header">
                  <div className="analysis-section-top">
                    <span className={`badge ${sapClass}`}>{groupName}</span>
                    <span className="analysis-section-count">{items.length} variable{items.length !== 1 ? 's' : ''}</span>
                  </div>
                  {SAP_AIMS[groupName] && (
                    <p className="analysis-section-aim">{SAP_AIMS[groupName]}</p>
                  )}
                </div>
                {viewMode === 'table' ? (
                  <div className="table-view-container">
                    <table className="compact-table">
                      <thead>
                        <tr>
                          <th>Variable Name</th>
                          <th>Label / Description</th>
                          <th>Measurement Level</th>
                          <th>Data Type</th>
                          <th>Program</th><th>SAP Category</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(item => (
                          <tr key={item._uid}>
                            <td style={{fontWeight: 600}}>{item['Variable Name']}</td>
                            <td>
                              <div style={{fontWeight: 500, marginBottom: '0.25rem'}}>{item['Label']}</div>
                              <div style={{color: 'var(--text-secondary)', fontSize: '0.85rem'}}>{item['Description']}</div>
                            </td>
                            <td>
                              {item['Measurement Level'] && (
                                <span className={`badge ${getMLClass(item['Measurement Level'])}`} style={{fontSize: '0.75rem', padding: '2px 6px'}}>{item['Measurement Level']}</span>
                              )}
                            </td>
                            <td>{item['Data Type']}</td>
                            <td>{item['Program']}</td><td>{item['SAP Category']}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className={`data-grid ${viewMode}`}>
                    {items.map((item) => (
                      <DataCard 
                        key={item._uid}
                        item={item}
                        searchTerm={searchTerm}
                        
                        setPinnedVars={setPinnedVars}
                        compareList={compareList}
                        setCompareList={setCompareList}
                        handleTagClick={handleTagClick}
                        openInstrumentModal={openInstrumentModal}
                        setCodeGenModalData={setCodeGenModalData}
                        viewMode={viewMode}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="accordion-list">
          {Object.entries(groupedData).map(([groupName, items]) => {
            const hasActiveFilters = filterSetting !== '' || filterDataType !== '' || activeTag !== null || selectedInterventions.size < 3 || selectedInstruments.size > 0;
            const isExpanded = expandedGroups[groupName] !== undefined
              ? expandedGroups[groupName]
              : (isExpandAll || isSearching || hasActiveFilters);
            
            return (
              <div className={`accordion-item ${isExpanded ? 'expanded' : ''}`} key={groupName}>
                <button 
                  className="accordion-header" 
                  onClick={() => toggleGroup(groupName, isExpanded)}
                  data-tooltip={`Click to ${isExpanded ? 'collapse' : 'expand'} group`}
                  aria-expanded={isExpanded}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
                >
                  <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="accordion-title-wrapper">
                      {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      <h2 className="accordion-title">
                        {PROGRAM_FULL_NAMES[groupName] || groupName}
                      </h2>
                    </div>
                    <span className="accordion-badge">{items.length} variables</span>
                  </div>
                </button>
                
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className="accordion-content">
                        <div className="accordion-inner">
                          {viewMode === 'table' ? (
                            <div className="table-view-container">
                              <table className="compact-table">
                                <thead>
                                  <tr>
                                    <th>Variable Name</th>
                                    <th>Label / Description</th>
                                    <th>Measurement Level</th>
                                    <th>Data Type</th>
                                    <th>Program</th><th>SAP Category</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {items.map(item => (
                                    <tr key={item._uid}>
                                      <td style={{fontWeight: 600}}>{item['Variable Name']}</td>
                                      <td>
                                        <div style={{fontWeight: 500, marginBottom: '0.25rem'}}>{item['Label']}</div>
                                        <div style={{color: 'var(--text-secondary)', fontSize: '0.85rem'}}>{item['Description']}</div>
                                      </td>
                                      <td>
                                        {item['Measurement Level'] && (
                                          <span className={`badge ${getMLClass(item['Measurement Level'])}`} style={{fontSize: '0.75rem', padding: '2px 6px'}}>{item['Measurement Level']}</span>
                                        )}
                                      </td>
                                      <td>{item['Data Type']}</td>
                                      <td>{item['Program']}</td><td>{item['SAP Category']}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className={`data-grid ${viewMode}`}>
                              {items.map((item) => (
                                <DataCard 
                                  key={item._uid}
                                  item={item}
                                  searchTerm={searchTerm}
                                  
                                  setPinnedVars={setPinnedVars}
                                  compareList={compareList}
                                  setCompareList={setCompareList}
                                  handleTagClick={handleTagClick}
                                  openInstrumentModal={openInstrumentModal}
                                  setCodeGenModalData={setCodeGenModalData}
                                  viewMode={viewMode}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
              )}
            </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
      </main>
  );
});


function MainApp() {
  const queryParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');

  const [searchTerm, setSearchTerm] = useState(queryParams.get('search') || queryParams.get('var') || '');
  const debouncedSearch = useDebounce(searchTerm, 300);
  
  const [filterSetting, setFilterSetting] = useState(queryParams.get('setting') || '');
  const [filterDataType, setFilterDataType] = useState(queryParams.get('type') || '');
  const [activeTag, setActiveTag] = useState(queryParams.get('tag') || null);
  const [showCartOnly, setShowCartOnly] = useState(queryParams.get('cart') === 'true');
  const [contentWidth, setContentWidth] = useState('auto');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isWidthDropdownOpen, setIsWidthDropdownOpen] = useState(false);
  
  const [groupBy, setGroupBy] = useState(queryParams.get('groupby') || 'None');
  const [sortBy, setSortBy] = useState(queryParams.get('sortby') || 'Variable Name (A-Z)');
  const [selectedInterventions, setSelectedInterventions] = useState(() => {
    const saved = queryParams.get('interventions');
    return saved ? new Set(saved.split(',')) : new Set(['ECR', 'CPTI', 'NLTC']);
  });
  const [isInterventionDropdownOpen, setIsInterventionDropdownOpen] = useState(false);
  
  const [selectedInstruments, setSelectedInstruments] = useState(() => {
    const saved = queryParams.get('instruments');
    return saved ? new Set(saved.split(',')) : new Set();
  });
  const [isInstrumentDropdownOpen, setIsInstrumentDropdownOpen] = useState(false);

  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  const toggleInstrument = (inst) => {
    setSelectedInstruments(prev => {
      const next = new Set(prev);
      if (next.has(inst)) next.delete(inst);
      else next.add(inst);
      return next;
    });
  };

  const [pinnedVars, setPinnedVars] = useState(() => {
    try {
      const stored = localStorage.getItem('edlead_pinned_vars');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch (e) {
      return new Set();
    }
  });
  const [compareList, setCompareList] = useState([]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  const handleCompareToggle = (item) => {
    setCompareList(prev => prev.filter(v => v['Variable Name'] !== item['Variable Name']));
  };
  
  const [modalPdfUrl, setModalPdfUrl] = useState(null);
  const [codeGenModalData, setCodeGenModalData] = useState(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandSearch, setCommandSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [isExpandAll, setIsExpandAll] = useState(false);
  const [showScroll, setShowScroll] = useState(false);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setCompareList((items) => {
        const oldIndex = items.findIndex(i => i['Variable Name'] === active.id);
        const newIndex = items.findIndex(i => i['Variable Name'] === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };
  
  // Keep track of which accordions are manually toggled open
  const [expandedGroups, setExpandedGroups] = useState({});

  useEffect(() => {
    setExpandedGroups({});
  }, [debouncedSearch, filterSetting, filterDataType, activeTag, selectedInterventions]);


  useEffect(() => {
    const checkScroll = () => {
      if (window.pageYOffset > 400) {
        setShowScroll(true);
      } else {
        setShowScroll(false);
      }
    };
    window.addEventListener('scroll', checkScroll);
    return () => window.removeEventListener('scroll', checkScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.width-dropdown-container')) {
        setIsWidthDropdownOpen(false);
      }
      if (!e.target.closest('.multiselect-dropdown')) {
        setIsInterventionDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchTerm) params.set('search', searchTerm);
    if (filterSetting) params.set('setting', filterSetting);
    if (filterDataType) params.set('datatype', filterDataType);
    if (activeTag) params.set('tag', activeTag);
    if (groupBy !== 'None') params.set('groupby', groupBy);
    if (showCartOnly) params.set('cart', 'true');
    if (selectedInterventions.size > 0 && selectedInterventions.size < 3) {
      params.set('interventions', Array.from(selectedInterventions).join(','));
    }
    if (selectedInstruments.size > 0) {
      params.set('instruments', Array.from(selectedInstruments).join(','));
    }
    
    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState({}, '', newUrl);
  }, [searchTerm, filterSetting, filterDataType, activeTag, groupBy, showCartOnly, selectedInterventions, selectedInstruments]);

  
  const exportToCSV = () => {
    if (filteredData.length === 0) {
      toast.error('No data to export!');
      return;
    }
    const csv = Papa.unparse(filteredData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'ed_lead_variables_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exported to CSV successfully!');
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        return savedTheme === 'dark';
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true; 
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Dynamically generate settings list from the actual data to prevent mismatches
  const settings = useMemo(() => {
    const s = new Set();
    dictData.forEach(item => {
      if (item['Measurement Level'] && String(item['Measurement Level']).trim() !== '') {
        s.add(item['Measurement Level']);
      }
    });
    const order = ['ED', 'Site Leaders', 'Provider', 'Care Partner', 'PLWD', 'Encounter'];
    return Array.from(s).sort((a, b) => {
      const idxA = order.indexOf(a);
      const idxB = order.indexOf(b);
      if (idxA === -1 && idxB === -1) return a.localeCompare(b);
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  }, [dictData]);

  // Pre-process dictionary data for lightning-fast search (strips HTML and pre-lowercases)
  const processedDictData = useMemo(() => {
    const stripHtml = (html) => {
      if (!html) return '';
      return String(html).replace(/<[^>]*>?/gm, '');
    };

    return dictData.map((item, idx) => {
      const searchText = [
        item['Variable Name'],
        stripHtml(item['Label']),
        stripHtml(item['Description']),
        item['Measurement Level'],
        item['Instrument / Source'],
        item['Data Type']
      ].filter(Boolean).join(' ').toLowerCase();

      return {
        ...item,
        _uid: `var-${idx}-${item['Variable Name'] || 'unknown'}`,
        _searchText: searchText
      };
    });
  }, [dictData]);

  // Fuse instance for fuzzy matching
  const fuse = useMemo(() => new Fuse(processedDictData, {
    keys: ['_searchText'],
    threshold: 0.3, // Fuzzy matching threshold
    ignoreLocation: true
  }), [processedDictData]);

  // Filter data and optimize search
  const filteredData = useMemo(() => {
    let baseData = processedDictData;
    
    if (debouncedSearch.trim() !== '') {
      const results = fuse.search(debouncedSearch);
      baseData = results.map(r => r.item);
    }

    const filtered = baseData.filter(item => {
      const matchesSetting = filterSetting === '' || item['Measurement Level'] === filterSetting;
      
      const matchesTag = !activeTag || 
        item['Measurement Level'] === activeTag || 
        item['Instrument / Source'] === activeTag ||
        (item['SAP Category'] && item['SAP Category'].startsWith(activeTag));
        
      const matchesDataType = filterDataType === '' || getTypeClass(item['Data Type']) === filterDataType;
      const matchesCart = !showCartOnly || compareList.some(v => v._uid === item._uid);
      
      const progStr = item['Program'] || '';
      const matchesIntervention = ['ECR', 'CPTI', 'NLTC'].some(p => selectedInterventions.has(p) && progStr.includes(p));
      const matchesInstrument = selectedInstruments.size === 0 || selectedInstruments.has(item['Instrument / Source']);

      return matchesSetting && matchesTag && matchesDataType && matchesCart && matchesIntervention && matchesInstrument;
    });

    if (sortBy === 'Variable Name (A-Z)') {
      filtered.sort((a, b) => (a['Variable Name'] || '').localeCompare(b['Variable Name'] || ''));
    } else if (sortBy === 'Variable Name (Z-A)') {
      filtered.sort((a, b) => (b['Variable Name'] || '').localeCompare(a['Variable Name'] || ''));
    } else if (sortBy === 'Instrument / Source (A-Z)') {
      filtered.sort((a, b) => {
        const instA = a['Instrument / Source'] || 'Z_No_Instrument';
        const instB = b['Instrument / Source'] || 'Z_No_Instrument';
        if (instA === instB) return (a['Variable Name'] || '').localeCompare(b['Variable Name'] || '');
        return instA.localeCompare(instB);
      });
    }

    return filtered;
  }, [debouncedSearch, processedDictData, fuse, filterSetting, activeTag, filterDataType, showCartOnly, compareList, selectedInterventions, selectedInstruments, sortBy]);

  const deferredFilteredData = useDeferredValue(filteredData);
  const groupedData = useMemo(() => {
    const groups = {};
    deferredFilteredData.forEach(item => {
      let keys = [];
      if (groupBy === 'Program') {
        keys = [item['Program'] || 'Unknown Program'];
      } else if (groupBy === 'Analysis') {
        keys = [item['SAP Category'] || 'Not in SAP'];
      } else if (groupBy === 'Instrument / Source') {
        keys = [item['Instrument / Source'] || 'Other / No Instrument'];
      } else if (groupBy === 'Who Completed') {
        keys = [item['Who Completed'] || 'Unknown / Not Specified'];
      } else if (groupBy === 'Measurement Level') {
        keys = [item['Measurement Level'] || 'Unknown Setting'];
      } else {
        keys = ['All Variables'];
      }
      
      keys.forEach(k => {
        if (!groups[k]) groups[k] = [];
        groups[k].push(item);
      });
    });
    
    const settingOrder = ['ED', 'Site Leaders', 'Provider', 'Care Partner', 'PLWD', 'Encounter'];
    const sapOrder = ['Primary Analysis', 'Secondary Analysis', 'Covariates', 'Implementation', 'Not in SAP'];
    
    return Object.keys(groups).sort((a, b) => {
      if (groupBy === 'Measurement Level') {
        const idxA = settingOrder.indexOf(a);
        const idxB = settingOrder.indexOf(b);
        if (idxA === -1 && idxB === -1) return a.localeCompare(b);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      } else if (groupBy === 'Analysis') {
        const idxA = sapOrder.indexOf(a);
        const idxB = sapOrder.indexOf(b);
        if (idxA === -1 && idxB === -1) return a.localeCompare(b);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      }
      return a.localeCompare(b);
    }).reduce((acc, key) => {
      acc[key] = groups[key];
      return acc;
    }, {});
  }, [deferredFilteredData, groupBy, selectedInterventions]);

  const handleExportCSV = () => {
    if (filteredData.length === 0) return;
    const csvData = deferredFilteredData.map(item => ({
      'Variable Name': item['Variable Name'],
      'Label': String(item['Label']).replace(/<[^>]*>?/gm, '').trim(),
      'Data Type': item['Data Type'],
      'Measurement Level': item['Measurement Level'],
      'Instrument / Source': item['Instrument / Source'],
      'Program': item['Program'],
      'SAP Category': item['SAP Category'],
      'Values / Coding': item['Values / Coding'],
      'Description': String(item['Description']).replace(/<[^>]*>?/gm, '').trim()
    }));
    
    const csvStr = Papa.unparse(csvData);
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'data_dictionary_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exported to CSV');
  };

  useEffect(() => {
    localStorage.setItem('edlead_pinned_vars', JSON.stringify(Array.from(pinnedVars)));
  }, [pinnedVars]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const executeCommand = (cmd) => {
    if (cmd === 'dark') setIsDarkMode(prev => !prev);
    if (cmd === 'grid') setViewMode('grid');
    if (cmd === 'list') setViewMode('list');
    if (cmd === 'table') setViewMode('table');
    if (cmd === 'clear') clearAllFilters();
    if (cmd === 'export') exportToCSV();
    if (cmd === 'pinned') setShowPinnedOnly(prev => !prev);
    setShowCommandPalette(false);
    setCommandSearch('');
  };

  const handleCommandSubmit = (e) => {
    if (e.key === 'Enter') {
      const search = commandSearch.toLowerCase();
      if (search.includes('export')) executeCommand('export');
      else if (search.includes('dark') || search.includes('light')) executeCommand('dark');
      else if (search.includes('grid')) executeCommand('grid');
      else if (search.includes('list')) executeCommand('list');
      else if (search.includes('table')) executeCommand('table');
      else if (search.includes('clear')) executeCommand('clear');
      else if (search.includes('pin')) executeCommand('pinned');
      else {
        setSearchTerm(commandSearch);
        setShowCommandPalette(false);
        setCommandSearch('');
      }
    }
  };

  const toggleGroup = useCallback((groupName, currentlyExpanded) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !currentlyExpanded
    }));
  }, []);

  const toggleExpandAll = () => {
    setIsExpandAll(prev => !prev);
    setExpandedGroups({});
  };

  const handleTagClick = useCallback((tagValue) => {
    setActiveTag(tagValue);
    setSearchTerm('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);



  const openInstrumentModal = useCallback((instrumentName) => {
    const filename = getInstrumentFilename(instrumentName);
    if (filename) {
      setModalPdfUrl(`instruments/${filename}`);
    }
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearchTerm('');
    setFilterSetting('');
    setFilterDataType('');
    setActiveTag(null);
    setShowPinnedOnly(false);
    setSelectedInterventions(new Set(['ECR', 'CPTI', 'NLTC']));
    setSelectedInstruments(new Set());
  }, []);

  const toggleIntervention = (prog) => {
    setSelectedInterventions(prev => {
      const next = new Set(prev);
      if (next.has(prog)) {
        next.delete(prog);
      } else {
        next.add(prog);
      }
      return next;
    });
  };

  const isSearching = debouncedSearch.trim() !== '' || activeTag !== null || filterDataType !== '';

  const [visibleCount, setVisibleCount] = useState(50);
  const observerTarget = useRef(null);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(50);
  }, [searchTerm, filterSetting, selectedInterventions, selectedInstruments, filterDataType, activeTag, groupBy, sortBy]);

  // Intersection observer to load more items
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => prev + 50);
        }
      },
      { threshold: 0.1, rootMargin: '400px' }
    );
    
    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }
    
    return () => {
      if (observerTarget.current) observer.unobserve(observerTarget.current);
    };
  }, [observerTarget.current]);

  return (
    <>
    <div className={`app-wrapper ${isSidebarOpen ? 'sidebar-open' : ''} ${isDarkMode ? 'dark-mode' : ''} width-${contentWidth}`}>
      <Toaster />
      <div className="header-actions" style={{ position: 'fixed', top: '1.5rem', right: '1.5rem', display: 'flex', gap: '0.5rem', zIndex: 100 }}>
        <div className="width-dropdown-container" style={{ position: 'relative' }}>
          <button 
            className="theme-toggle" 
            onClick={() => setIsWidthDropdownOpen(!isWidthDropdownOpen)}
            data-tooltip="Set content width"
          >
            <MoveHorizontal size={16} />
          </button>
          <AnimatePresence>
            {isWidthDropdownOpen && (
              <motion.div 
                className="dropdown-menu"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.5rem',
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  overflow: 'hidden',
                  zIndex: 50,
                  minWidth: '220px'
                }}
              >
                {['auto', 'medium', 'full'].map(w => (
                  <button
                    key={w}
                    className="dropdown-item"
                    onClick={() => { setContentWidth(w); setIsWidthDropdownOpen(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      width: '100%',
                      padding: '0.75rem 1rem',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <span style={{ width: '24px', display: 'flex', alignItems: 'center' }}>
                      {contentWidth === w && <Check size={16} />}
                    </span>
                    <span style={{ textTransform: 'capitalize', fontWeight: contentWidth === w ? '600' : '400', flex: 1 }}>
                      {w} {w === 'auto' && <span style={{ opacity: 0.6, fontWeight: '400' }}>(default)</span>}
                    </span>
                    {w === 'auto' && (
                      <span style={{ opacity: 0.5, display: 'flex', alignItems: 'center' }} data-tooltip="Default container width">
                        <HelpCircle size={14} />
                      </span>
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button 
          className="theme-toggle" 
          onClick={() => setIsDarkMode(!isDarkMode)}
          data-tooltip={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
        >
          {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={16} style={{ color: 'var(--accent-color)' }} />
            <span>Explorer Options</span>
          </div>
          <button className="icon-btn" onClick={() => setIsSidebarOpen(false)} aria-label="Close sidebar">
            <X size={18} />
          </button>
        </div>
        
        <div className="sidebar-body">
          
          {/* ── Data Filters Section ── */}
          <div className="sb-section">
            <div className="sb-section-header">
              <h4 className="sb-section-title">Data Filters</h4>
            </div>
            <div className="sb-section-content">
              {/* Intervention Toggles */}
              <div className="sb-field">
                <span className="sb-label">Program Intervention</span>
                <div className="intervention-pills">
                  {['ECR', 'CPTI', 'NLTC'].map(prog => (
                    <button
                      key={prog}
                      className={`intervention-pill ${selectedInterventions.has(prog) ? 'active' : ''}`}
                      onClick={() => toggleIntervention(prog)}
                      title={PROGRAM_FULL_NAMES[prog] || prog}
                    >
                      {prog}
                    </button>
                  ))}
                </div>
              </div>

              {/* Instrument */}
              <div className="sb-field">
                <span className="sb-label">Instrument / Source</span>
                <div className="filter-select instruments-filter" style={{ position: 'relative', zIndex: isInstrumentDropdownOpen ? 50 : 1 }}>
                  <button 
                    className="select-input multi-select-trigger" 
                    onClick={() => setIsInstrumentDropdownOpen(!isInstrumentDropdownOpen)}
                  >
                    <span>{selectedInstruments.size === 0 ? 'All Instruments' : `${selectedInstruments.size} Selected`}</span>
                    <ChevronDown size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
                  </button>
                  <AnimatePresence>
                    {isInstrumentDropdownOpen && (
                      <>
                        <div className="multi-select-overlay" onClick={() => setIsInstrumentDropdownOpen(false)} />
                        <motion.div 
                          className="multi-select-dropdown"
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          transition={{ duration: 0.15 }}
                        >
                          {UNIQUE_INSTRUMENTS.map(inst => (
                            <button 
                              key={inst} 
                              className="multi-select-option" 
                              onClick={() => toggleInstrument(inst)}
                            >
                              <Check 
                                size={16} 
                                style={{ 
                                  opacity: selectedInstruments.has(inst) ? 1 : 0,
                                  color: 'var(--accent-color)',
                                  transition: 'opacity 0.2s',
                                  flexShrink: 0,
                                }} 
                              />
                              <span>{inst}</span>
                            </button>
                          ))}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Level */}
              <div className="sb-field">
                <span className="sb-label">Measurement Level</span>
                <CustomSelect 
                  tooltip="Filter by measurement level" 
                  value={filterSetting} 
                  onChange={setFilterSetting} 
                  options={[
                    { label: 'All Levels', value: '' },
                    ...settings.map(s => ({ label: s, value: s }))
                  ]} 
                />
              </div>

              {/* Data Type */}
              <div className="sb-field">
                <span className="sb-label">Data Type</span>
                <CustomSelect 
                  tooltip="Filter by data type" 
                  value={filterDataType} 
                  onChange={setFilterDataType} 
                  options={[
                    { label: 'All Data Types', value: '' },
                    { label: 'Boolean', value: 'boolean' },
                    { label: 'Categorical', value: 'categorical' },
                    { label: 'Date', value: 'date' },
                    { label: 'Numeric', value: 'numeric' },
                    { label: 'String / Text', value: 'string' }
                  ]} 
                />
              </div>
            </div>
          </div>

          {/* ── Display Options Section ── */}
          <div className="sb-section">
            <div className="sb-section-header">
              <h4 className="sb-section-title">Display & Organization</h4>
            </div>
            <div className="sb-section-content">
              {/* Group By */}
              <div className="sb-field">
                <span className="sb-label">Group By</span>
                <CustomSelect 
                  tooltip="Group variables by" 
                  value={groupBy} 
                  onChange={setGroupBy} 
                  options={[
                    { label: 'None', value: 'None' },
                    { label: 'Analysis', value: 'Analysis' },
                    { label: 'Intervention', value: 'Program' },
                    { label: 'Instrument / Source', value: 'Instrument / Source' },
                    { label: 'Who Completed', value: 'Who Completed' },
                    { label: 'Measurement Level', value: 'Measurement Level' }
                  ]} 
                />
              </div>

              {/* Sort By */}
              <div className="sb-field">
                <span className="sb-label">Sort By</span>
                <CustomSelect 
                  tooltip="Sort variables by" 
                  value={sortBy} 
                  onChange={setSortBy} 
                  options={[
                    { label: 'Variable Name (A-Z)', value: 'Variable Name (A-Z)' },
                    { label: 'Variable Name (Z-A)', value: 'Variable Name (Z-A)' },
                    { label: 'Instrument / Source (A-Z)', value: 'Instrument / Source (A-Z)' }
                  ]} 
                />
              </div>
            </div>
          </div>

          {/* ── Actions ── */}
          {(searchTerm || filterSetting || activeTag || filterDataType || showCartOnly || selectedInterventions.size < 3 || selectedInstruments.size > 0) && (
            <div className="sb-actions">
              <button className="sb-clear-btn" onClick={clearAllFilters}>
                <RefreshCw size={14} /> Reset All Filters
              </button>
            </div>
          )}

        </div>
      </aside>
      <div className="main-content">
        <div className="header-container">
            {!isSidebarOpen && (
              <button className="icon-btn" onClick={() => setIsSidebarOpen(true)} aria-label="Open sidebar" style={{ marginRight: '1.5rem' }}>
                <Menu size={24} />
              </button>
            )}
            <header className="header" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
              <div>
                <h1 style={{ fontSize: '1.75rem', margin: '0 0 0.5rem 0', fontWeight: 700, color: 'var(--text-primary)' }}>ED-LEAD Data Explorer</h1>
                <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: '800px' }}>
                  Explore, filter, and compare variables across ED-LEAD interventions. Use the search bar, filters below, or click on highlighted tags to quickly find what you need.
                </p>
              </div>
          <div className="sap-legend" style={{fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap'}}>
            <button className="badge sap-primary tag-link" onClick={() => { setActiveTag('Primary Analysis'); setGroupBy('Analysis'); }} style={{border: 'none', cursor: 'pointer'}}>Primary Analysis</button> 
            <button className="badge sap-secondary tag-link" onClick={() => { setActiveTag('Secondary Analysis'); setGroupBy('Analysis'); }} style={{marginLeft: '0.5rem', border: 'none', cursor: 'pointer'}}>Secondary Analysis</button>
            <button className="badge sap-covariates tag-link" onClick={() => { setActiveTag('Covariates'); setGroupBy('Analysis'); }} style={{marginLeft: '0.5rem', border: 'none', cursor: 'pointer'}}>Covariates</button>
            <button className="badge sap-implementation tag-link" onClick={() => { setActiveTag('Implementation'); setGroupBy('Analysis'); }} style={{marginLeft: '0.5rem', border: 'none', cursor: 'pointer'}}>Implementation</button>
          </div>
          {/* --- Action Bar: Search + View Controls + Stats --- */}
          <div className="action-bar">
            <div className="search-bar" style={{ flex: 1 }}>
              <div className="search-input-wrapper" data-tooltip="Search by variable name, label, or description">
                <Search className="search-icon" />
                <div className="search-chips-container">
                  {filterDataType && (
                    <div className="search-chip">
                      <span>Type: {filterDataType}</span>
                      <button onClick={() => setFilterDataType('')}><X size={12} /></button>
                    </div>
                  )}
                  {filterSetting && (
                    <div className="search-chip">
                      <span>Setting: {filterSetting}</span>
                      <button onClick={() => setFilterSetting('')}><X size={12} /></button>
                    </div>
                  )}
                  {activeTag && (
                    <div className="search-chip tag-chip">
                      <span><Tag size={10} /> {activeTag}</span>
                      <button onClick={() => setActiveTag(null)}><X size={12} /></button>
                    </div>
                  )}
                  <input 
                    type="text" 
                    className="search-input"
                    placeholder={(!filterDataType && !filterSetting && !activeTag) ? "Search variables by name, label, or description..." : ""} 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {(searchTerm || filterSetting || filterDataType || activeTag) && (
                    <button 
                      className="clear-search-btn"
                      aria-label="Clear all filters"
                      onClick={() => {
                        setSearchTerm('');
                        setFilterSetting('');
                        setFilterDataType('');
                        setActiveTag(null);
                      }}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: '0 8px' }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="action-bar-controls">
              <button 
                className={`icon-btn ${showCartOnly ? 'active pinned' : ''}`} 
                onClick={() => setShowCartOnly(!showCartOnly)} 
                title="Show variables in Cart"
              >
                <ShoppingCart size={18} />
              </button>
              <button className="icon-btn" onClick={toggleExpandAll} data-tooltip={isExpandAll ? "Collapse All" : "Expand All"} aria-label={isExpandAll ? "Collapse All" : "Expand All"}>
                {isExpandAll ? <Minimize size={18} /> : <Maximize size={18} />}
              </button>
              <div className="toggle-group">
                <button className={`icon-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')} data-tooltip="Grid View" aria-label="Grid View">
                  <Grid size={18} />
                </button>
                <button className={`icon-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')} data-tooltip="List View" aria-label="List View">
                  <List size={18} />
                </button>
              </div>
              <button className="export-btn" onClick={handleExportCSV} data-tooltip="Download CSV">
                <Download size={14} /> Export
              </button>
            </div>
          </div>
          <div className="action-bar-stats">
            <span className="data-stats" aria-live="polite">
              Showing {deferredFilteredData.length} variable{filteredData.length !== 1 ? 's' : ''}
              {searchTerm && ` for "${searchTerm}"`}{Object.keys(groupedData).length > 1 && ` across ${Object.keys(groupedData).length} groups`}
            </span>
          </div>
        </header>
      </div>
<main className="main-content-scroll" style={{ padding: '0 3rem 3rem 3rem', width: '100%', boxSizing: 'border-box' }}>
      {filteredData.length === 0 ? (
        <motion.div 
          className="empty-state"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
            padding: '6rem 2rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px dashed var(--border-color)', 
            marginTop: '2rem'
          }}
        >
          <SearchX size={64} style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', opacity: 0.5 }} />
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>No variables found</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', textAlign: 'center', marginBottom: '1.5rem', lineHeight: 1.6 }}>We couldn't find any variables matching your current filters and search terms.</p>
          <button 
            className="icon-btn active" 
            onClick={clearAllFilters} 
            style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 600 }}
          >
            Clear All Filters
          </button>
        </motion.div>
      ) : groupBy === 'None' ? (
        <>
          {SAP_AIMS[activeTag] && (
            <div style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem', background: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <h3 style={{ marginTop: 0, marginBottom: '0.5rem', color: 'var(--text-primary)', fontSize: '1.1rem' }}>{activeTag}</h3>
              <p style={{ margin: 0, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{SAP_AIMS[activeTag]}</p>
            </div>
          )}
          {viewMode === 'table' ? (
            <div className="table-view-container">
              <table className="compact-table">
                <thead>
                  <tr>
                    <th>Variable Name</th>
                    <th>Label / Description</th>
                    <th>Measurement Level</th>
                    <th>Data Type</th>
                    <th>Program</th><th>SAP Category</th>
                  </tr>
                </thead>
                <tbody>
                  {deferredFilteredData.slice(0, visibleCount).map(item => (
                    <tr key={item._uid}>
                      <td style={{fontWeight: 600}}>{item['Variable Name']}</td>
                      <td>
                        <div style={{fontWeight: 500, marginBottom: '0.25rem'}}>{item['Label']}</div>
                        <div style={{color: 'var(--text-secondary)', fontSize: '0.85rem'}}>{item['Description']}</div>
                      </td>
                      <td>
                        {item['Measurement Level'] && (
                          <span className={`badge ${getMLClass(item['Measurement Level'])}`} style={{fontSize: '0.75rem', padding: '2px 6px'}}>{item['Measurement Level']}</span>
                        )}
                      </td>
                      <td>{item['Data Type']}</td>
                      <td>{item['Program']}</td><td>{item['SAP Category']}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
          <div className={`data-grid ${viewMode}`}>
            {deferredFilteredData.slice(0, visibleCount).map((item) => (
              <DataCard 
                key={item._uid}
                item={item}
                searchTerm={searchTerm}
                
                setPinnedVars={setPinnedVars}
                compareList={compareList}
                setCompareList={setCompareList}
                handleTagClick={handleTagClick}
                openInstrumentModal={openInstrumentModal}
                setCodeGenModalData={setCodeGenModalData}
                viewMode={viewMode}
              />
            ))}
          </div>
          )}
          {visibleCount < deferredFilteredData.length && (
            <div ref={observerTarget} style={{ height: '20px', width: '100%', marginTop: '20px' }} />
          )}
        </>
      ) : groupBy === 'Analysis' ? (
        /* ── Analysis Group View: flat sections, no accordion ── */
        <div className="analysis-sections">
          {Object.entries(groupedData).map(([groupName, items]) => {
            const sapClass = groupName === 'Primary Analysis' ? 'sap-primary'
              : groupName === 'Secondary Analysis' ? 'sap-secondary'
              : groupName === 'Covariates' ? 'sap-covariates'
              : groupName === 'Implementation' ? 'sap-implementation' : '';

            return (
              <div className="analysis-section" key={groupName}>
                <div className="analysis-section-header">
                  <div className="analysis-section-top">
                    <span className={`badge ${sapClass}`}>{groupName}</span>
                    <span className="analysis-section-count">{items.length} variable{items.length !== 1 ? 's' : ''}</span>
                  </div>
                  {SAP_AIMS[groupName] && (
                    <p className="analysis-section-aim">{SAP_AIMS[groupName]}</p>
                  )}
                </div>
                {viewMode === 'table' ? (
                  <div className="table-view-container">
                    <table className="compact-table">
                      <thead>
                        <tr>
                          <th>Variable Name</th>
                          <th>Label / Description</th>
                          <th>Measurement Level</th>
                          <th>Data Type</th>
                          <th>Program</th><th>SAP Category</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(item => (
                          <tr key={item._uid}>
                            <td style={{fontWeight: 600}}>{item['Variable Name']}</td>
                            <td>
                              <div style={{fontWeight: 500, marginBottom: '0.25rem'}}>{item['Label']}</div>
                              <div style={{color: 'var(--text-secondary)', fontSize: '0.85rem'}}>{item['Description']}</div>
                            </td>
                            <td>
                              {item['Measurement Level'] && (
                                <span className={`badge ${getMLClass(item['Measurement Level'])}`} style={{fontSize: '0.75rem', padding: '2px 6px'}}>{item['Measurement Level']}</span>
                              )}
                            </td>
                            <td>{item['Data Type']}</td>
                            <td>{item['Program']}</td><td>{item['SAP Category']}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className={`data-grid ${viewMode}`}>
                    {items.map((item) => (
                      <DataCard 
                        key={item._uid}
                        item={item}
                        searchTerm={searchTerm}
                        
                        setPinnedVars={setPinnedVars}
                        compareList={compareList}
                        setCompareList={setCompareList}
                        handleTagClick={handleTagClick}
                        openInstrumentModal={openInstrumentModal}
                        setCodeGenModalData={setCodeGenModalData}
                        viewMode={viewMode}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="accordion-list">
          {Object.entries(groupedData).map(([groupName, items]) => {
            const hasActiveFilters = filterSetting !== '' || filterDataType !== '' || activeTag !== null || selectedInterventions.size < 3 || selectedInstruments.size > 0;
            const isExpanded = expandedGroups[groupName] !== undefined
              ? expandedGroups[groupName]
              : (isExpandAll || isSearching || hasActiveFilters);
            
            return (
              <div className={`accordion-item ${isExpanded ? 'expanded' : ''}`} key={groupName}>
                <button 
                  className="accordion-header" 
                  onClick={() => toggleGroup(groupName, isExpanded)}
                  data-tooltip={`Click to ${isExpanded ? 'collapse' : 'expand'} group`}
                  aria-expanded={isExpanded}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
                >
                  <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="accordion-title-wrapper">
                      {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      <h2 className="accordion-title">
                        {PROGRAM_FULL_NAMES[groupName] || groupName}
                      </h2>
                    </div>
                    <span className="accordion-badge">{items.length} variables</span>
                  </div>
                </button>
                
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className="accordion-content">
                        <div className="accordion-inner">
                          {viewMode === 'table' ? (
                            <div className="table-view-container">
                              <table className="compact-table">
                                <thead>
                                  <tr>
                                    <th>Variable Name</th>
                                    <th>Label / Description</th>
                                    <th>Measurement Level</th>
                                    <th>Data Type</th>
                                    <th>Program</th><th>SAP Category</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {items.slice(0, visibleCount).map(item => (
                                    <tr key={item._uid}>
                                      <td style={{fontWeight: 600}}>{item['Variable Name']}</td>
                                      <td>
                                        <div style={{fontWeight: 500, marginBottom: '0.25rem'}}>{item['Label']}</div>
                                        <div style={{color: 'var(--text-secondary)', fontSize: '0.85rem'}}>{item['Description']}</div>
                                      </td>
                                      <td>
                                        {item['Measurement Level'] && (
                                          <span className={`badge ${getMLClass(item['Measurement Level'])}`} style={{fontSize: '0.75rem', padding: '2px 6px'}}>{item['Measurement Level']}</span>
                                        )}
                                      </td>
                                      <td>{item['Data Type']}</td>
                                      <td>{item['Program']}</td><td>{item['SAP Category']}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className={`data-grid ${viewMode}`}>
                              {items.slice(0, visibleCount).map((item) => (
                                <DataCard 
                                  key={item._uid}
                                  item={item}
                                  searchTerm={searchTerm}
                                  
                                  setPinnedVars={setPinnedVars}
                                  compareList={compareList}
                                  setCompareList={setCompareList}
                                  handleTagClick={handleTagClick}
                                  openInstrumentModal={openInstrumentModal}
                                  setCodeGenModalData={setCodeGenModalData}
                                  viewMode={viewMode}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
              )}
            </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
      </main>
    </div>

      {showBackToTop && (
        <button 
          className="back-to-top" 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          data-tooltip="Back to Top"
        >
          <ArrowUp size={24} />
        </button>
      )}

      <AnimatePresence>
        {modalPdfUrl && (
          <FocusLock returnFocus>
            <motion.div className="modal-overlay" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} transition={{duration: 0.15}} onClick={() => setModalPdfUrl(null)}>
              <motion.div className="modal-content" initial={{scale: 0.95}} animate={{scale: 1}} exit={{scale: 0.95}} transition={{duration: 0.15}} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>Instrument Viewer</h2>
                  <button className="modal-close" onClick={() => setModalPdfUrl(null)} data-tooltip="Close PDF" aria-label="Close PDF Modal">
                  <X size={24} />
                </button>
              </div>
              <div className="modal-body">
                <iframe src={modalPdfUrl} title="Blank Instrument" className="pdf-iframe" />
              </div>
            </motion.div>
          </motion.div>
          </FocusLock>
        )}
      </AnimatePresence>

      {compareList.length > 0 && (
        <div className="compare-floating-bar">
          <div className="compare-info">
            <span className="compare-count" aria-live="polite">
              <ShoppingCart size={16} style={{ marginRight: '8px' }} />
              {compareList.length} Variable{compareList.length !== 1 ? 's' : ''} in Cart
            </span>
          </div>
          <div className="compare-actions">
            <button className="btn-secondary" onClick={() => setCompareList([])}>Clear</button>
            <button className="btn-secondary" onClick={() => setCodeGenModalData(compareList)}>
              <Code size={16} /> Generate Code
            </button>
            <button className="btn-primary" onClick={() => setShowCompareModal(true)}>
              <Columns size={16} /> Compare Now
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showCompareModal && (
          <FocusLock returnFocus>
            <motion.div className="modal-overlay" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} transition={{duration: 0.15}} onClick={() => setShowCompareModal(false)}>
              <motion.div className="modal-content compare-modal-content" initial={{scale: 0.95}} animate={{scale: 1}} exit={{scale: 0.95}} transition={{duration: 0.15}} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>Compare Variables</h2>
                  <button className="modal-close" onClick={() => setShowCompareModal(false)} data-tooltip="Close" aria-label="Close Compare Modal">
                  <X size={24} />
                </button>
              </div>
              <div className="modal-body compare-body">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <table className="compare-table">
                    <thead>
                      <tr>
                        <th>Feature</th>
                        <SortableContext items={compareList.map(v => v['Variable Name'])} strategy={horizontalListSortingStrategy}>
                          {compareList.map(v => (
                            <SortableHeader 
                              key={v['Variable Name']} 
                              id={v['Variable Name']} 
                              variable={v} 
                              onRemove={handleCompareToggle} 
                            />
                          ))}
                        </SortableContext>
                      </tr>
                    </thead>
                    <tbody>
                      {['Label', 'Data Type', 'Instrument / Source', 'Measurement Level', 'Values / Coding', 'Description'].map(field => (
                        <tr key={field}>
                          <td className="compare-field-name">{field}</td>
                          {compareList.map(v => (
                            <td key={v['Variable Name']}>
                              <FormattedField value={v[field]} isCoding={field === 'Values / Coding'} searchTerm="" />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DndContext>
              </div>
            </motion.div>
          </motion.div>
          </FocusLock>
        )}
      </AnimatePresence>

      {showScroll && (
        <button className="back-to-top" onClick={scrollToTop} data-tooltip="Back to top">
          <ArrowUp size={24} />
        </button>
      )}

      <AnimatePresence>
        {codeGenModalData && (
          <FocusLock returnFocus>
            <motion.div className="modal-overlay" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} transition={{duration: 0.15}} onClick={() => setCodeGenModalData(null)}>
              <motion.div className="modal-content" style={{ maxWidth: '800px', height: 'auto', maxHeight: '90vh' }} initial={{scale: 0.95}} animate={{scale: 1}} exit={{scale: 0.95}} transition={{duration: 0.15}} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>Code Generation: {codeGenModalData.length > 1 ? 'Multiple Variables' : codeGenModalData[0]['Variable Name']}</h2>
                  <button className="modal-close" onClick={() => setCodeGenModalData(null)} data-tooltip="Close" aria-label="Close Code Generation">
                    <X size={24} />
                  </button>
              </div>
              <div className="modal-body" style={{ padding: '1.5rem', background: 'var(--card-bg)', overflowY: 'auto' }}>
                <CodeSnippets variables={codeGenModalData} />
              </div>
            </motion.div>
          </motion.div>
          </FocusLock>
        )}
      </AnimatePresence>

      </div> {/* end main-content */}
      <AnimatePresence>
        {showCommandPalette && (
          <FocusLock returnFocus>
            <motion.div className="modal-overlay command-palette-overlay" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} transition={{duration: 0.15}} onClick={() => setShowCommandPalette(false)}>
              <motion.div className="command-palette" initial={{scale: 0.95, y: -20}} animate={{scale: 1, y: 0}} exit={{scale: 0.95, y: -20}} transition={{duration: 0.15}} onClick={e => e.stopPropagation()}>
              <div className="command-input-wrapper">
                <Search size={20} className="command-icon" />
                <input
                  autoFocus
                  type="text"
                  className="command-input"
                  placeholder="Search variables or type a command (e.g. Export, Dark Mode)..."
                  value={commandSearch}
                  onChange={e => setCommandSearch(e.target.value)}
                  onKeyDown={handleCommandSubmit}
                />
                <span className="command-hint">Enter ↵</span>
              </div>
              <div className="command-list">
                <div className="command-group-label">Suggested Commands</div>
                <button className="command-item" onClick={() => executeCommand('dark')}>
                  {isDarkMode ? <Sun size={16} /> : <Moon size={16} />} Toggle Theme
                </button>
                <button className="command-item" onClick={() => executeCommand('export')}>
                  <Download size={16} /> Export to CSV
                </button>
                <button className="command-item" onClick={() => executeCommand('clear')}>
                  <X size={16} /> Clear All Filters
                </button>
                <button className="command-item" onClick={() => executeCommand(viewMode === 'grid' ? 'list' : 'grid')}>
                  {viewMode === 'grid' ? <List size={16} /> : <Grid size={16} />} Toggle {viewMode === 'grid' ? 'List' : 'Grid'} View
                </button>
              </div>
            </motion.div>
          </motion.div>
          </FocusLock>
        )}
      </AnimatePresence>
    </>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return typeof window !== 'undefined' ? sessionStorage.getItem('edlead_auth') === 'true' : false;
  });

  if (!isAuthenticated) {
    return <LoginScreen onLogin={() => setIsAuthenticated(true)} />;
  }

  return <MainApp />;
}

export default App;

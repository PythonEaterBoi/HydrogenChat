import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, Eye, EyeOff, KeyRound, Search, Sparkles, Trash2, X } from 'lucide-react';

function Modal({ children, onClose, labelledBy, className = '' }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    dialogRef.current?.querySelector('input, button')?.focus();
    return () => previous?.focus?.();
  }, []);

  const onKeyDown = (event) => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
    if (event.key !== 'Tab') return;
    const elements = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href]')];
    if (!elements.length) return;
    if (event.shiftKey && document.activeElement === elements[0]) { event.preventDefault(); elements.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === elements.at(-1)) { event.preventDefault(); elements[0].focus(); }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} className={`modal ${className}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy} onKeyDown={onKeyDown}>
        {children}
      </div>
    </div>
  );
}

const thinkingOptions = [
  { value: 'low', label: 'Quick', description: 'Faster everyday answers' },
  { value: 'medium', label: 'Balanced', description: 'A little more thought' },
  { value: 'high', label: 'Deep', description: 'For complex questions' },
  { value: 'xhigh', label: 'Extra deep', description: 'Most thorough reasoning' },
];

export function SettingsDialog({ apiKey, rememberKey, model, thinkingLevel, onSave, onClose }) {
  const [key, setKey] = useState(apiKey);
  const [remember, setRemember] = useState(rememberKey);
  const [modelId, setModelId] = useState(model);
  const [level, setLevel] = useState(thinkingLevel);
  const [showKey, setShowKey] = useState(false);

  return (
    <Modal onClose={onClose} labelledBy="settings-title" className="settings-modal">
      <div className="modal-heading-row"><div className="modal-icon"><Sparkles size={21} /></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close settings"><X size={19} /></button></div>
      <h2 id="settings-title">Make this space yours.</h2>
      <p className="modal-subtitle">A few small preferences for better conversations.</p>

      <form onSubmit={(event) => { event.preventDefault(); onSave({ apiKey: key.trim(), rememberKey: remember, model: modelId.trim(), thinkingLevel: level }); }}>
        <div className="settings-section">
          <div className="settings-section-title"><KeyRound size={17} /><span>Gemini connection</span></div>
          <label className="field-label" htmlFor="api-key">Your API key</label>
          <div className="key-field">
            <input id="api-key" type={showKey ? 'text' : 'password'} autoComplete="off" spellCheck="false" placeholder="Paste your Gemini API key" value={key} onChange={(event) => setKey(event.target.value)} />
            <button type="button" onClick={() => setShowKey(!showKey)} aria-label={showKey ? 'Hide API key' : 'Show API key'}>{showKey ? <EyeOff size={17} /> : <Eye size={17} />}</button>
          </div>
          <label className="remember-row"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> <span>Remember on this device</span></label>
          <p className="field-help">Your key stays in this browser and is sent only to Google’s Gemini API — never to any other server. By default it is forgotten when you close the tab. <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Get a key <ArrowUpRight size={13} /></a></p>
          <label className="field-label model-label" htmlFor="model-id">Model ID</label>
          <div className="key-field"><input id="model-id" type="text" autoComplete="off" spellCheck="false" placeholder="gemini-4-hydrogen" value={modelId} onChange={(event) => setModelId(event.target.value)} /></div>
          <p className="field-help">Leave as <code>gemini-4-hydrogen</code> unless your key uses a different model name.</p>
        </div>

        <div className="settings-section thinking-section">
          <div className="settings-section-title"><Sparkles size={17} /><span>Thinking level</span></div>
          <p className="thinking-help">Choose how much time Hydrogen spends working through a reply.</p>
          <div className="thinking-options" role="radiogroup" aria-label="Thinking level">
            {thinkingOptions.map((option) => (
              <button className={`thinking-option ${level === option.value ? 'selected' : ''}`} type="button" role="radio" aria-checked={level === option.value} key={option.value} onClick={() => setLevel(option.value)}>
                <span><strong>{option.label}</strong><small>{option.description}</small></span>{level === option.value && <Check size={17} />}
              </button>
            ))}
          </div>
        </div>
        <div className="modal-footer"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">Save preferences <ArrowRight size={16} /></button></div>
      </form>
    </Modal>
  );
}

export function SearchDialog({ chats, onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const matches = [...chats].sort((a, b) => b.updatedAt - a.updatedAt)
    .filter((chat) => `${chat.title} ${chat.messages.map((message) => message.content).join(' ')}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 12);

  return (
    <Modal onClose={onClose} labelledBy="search-title" className="search-modal">
      <h2 className="sr-only" id="search-title">Search conversations</h2>
      <div className="search-field"><Search size={20} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && matches[0]) onSelect(matches[0].id); }} placeholder="Search your conversations..." aria-label="Search your conversations" /><button className="search-close" type="button" onClick={onClose} aria-label="Close search"><X size={18} /></button></div>
      <div className="search-results">
        <div className="search-results-label">{query ? 'RESULTS' : 'RECENT CONVERSATIONS'}</div>
        {matches.length ? matches.map((chat) => (
          <button className="search-result" type="button" key={chat.id} onClick={() => onSelect(chat.id)}><span className="search-result-icon"><Sparkles size={16} /></span><span>{chat.title}</span><ArrowRight size={16} /></button>
        )) : <div className="search-no-results">{chats.length ? 'No conversations found. Try a different search.' : 'Your conversations will appear here once you start chatting.'}</div>}
      </div>
      <div className="search-footer"><span>Press <kbd>Enter</kbd> to open the first result</span><span><kbd>Esc</kbd> to close</span></div>
    </Modal>
  );
}

export function DeleteDialog({ title, onConfirm, onClose }) {
  return (
    <Modal onClose={onClose} labelledBy="delete-title" className="delete-modal">
      <div className="modal-heading-row"><div className="modal-icon danger-icon"><Trash2 size={20} /></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close"><X size={19} /></button></div>
      <h2 id="delete-title">Delete this conversation?</h2>
      <p className="modal-subtitle">“{title}” will be removed from this browser. This can’t be undone.</p>
      <div className="modal-footer"><button className="secondary-button" type="button" onClick={onClose}>Keep it</button><button className="danger-button" type="button" onClick={onConfirm}>Delete conversation</button></div>
    </Modal>
  );
}

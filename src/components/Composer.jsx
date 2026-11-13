import { ArrowUp, Sparkles, Square } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';

export function Composer({ draft, onDraftChange, onSend, onStop, isStreaming, connected, onConnect, inputRef }) {
  const localRef = useRef(null);

  useLayoutEffect(() => {
    const textarea = localRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 190)}px`;
  }, [draft]);

  const setRef = (element) => {
    localRef.current = element;
    if (inputRef) inputRef.current = element;
  };

  return (
    <div className="composer-wrap">
      <form className="composer" onSubmit={(event) => { event.preventDefault(); onSend(); }}>
        <label className="sr-only" htmlFor="message-input">Your message</label>
        <textarea
          ref={setRef}
          id="message-input"
          rows={1}
          maxLength={10000}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder="Message Hydrogen..."
          disabled={isStreaming}
          aria-label="Message Hydrogen"
        />
        <div className="composer-toolbar">
          <div className="composer-model"><Sparkles size={15} strokeWidth={1.8} /><span>Gemini 4 Hydrogen</span></div>
          <div className="composer-controls">
            {!connected && !isStreaming ? (
              <button className="composer-connect" type="button" onClick={onConnect}>Connect Gemini</button>
            ) : (
              <span className="composer-hint">Enter to send · Shift+Enter for new line</span>
            )}
            {isStreaming ? (
              <button className="send-button stop-button" type="button" onClick={onStop} aria-label="Stop generating" title="Stop generating"><Square size={15} fill="currentColor" strokeWidth={1.5} /></button>
            ) : (
              <button className="send-button" type="submit" disabled={!draft.trim()} aria-label="Send message" title="Send message"><ArrowUp size={18} strokeWidth={2.2} /></button>
            )}
          </div>
        </div>
      </form>
      <p className="composer-disclaimer">Hydrogen can make mistakes. Check important information.</p>
    </div>
  );
}

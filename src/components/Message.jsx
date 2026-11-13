import { useEffect, useState } from 'react';
import { AlertCircle, Check, Copy, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BrandMark } from './Brand.jsx';

function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="code-block">
      <div className="code-header"><span>{language || 'text'}</span><button type="button" onClick={copy} aria-label="Copy code">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy'}</button></div>
      <pre><code>{code}</code></pre>
    </div>
  );
}

function Markdown({ content }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children }) { return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>; },
          pre({ children }) {
            const element = children;
            const code = String(element?.props?.children ?? '').replace(/\n$/, '');
            const language = /language-([\w+-]+)/.exec(element?.props?.className || '')?.[1] || 'text';
            return <CodeBlock code={code} language={language} />;
          },
          code({ className, children, ...props }) {
            return <code className={className || 'inline-code'} {...props}>{children}</code>;
          },
        }}
      >{content}</ReactMarkdown>
    </div>
  );
}

export function Message({ message, isLastAssistant, onCopy, onRegenerate }) {
  if (message.role === 'user') {
    return (
      <div className="message-row user-row">
        <div className="user-message-wrap">
          <div className="user-bubble">{message.content}</div>
          <button className="message-action user-copy" type="button" onClick={() => onCopy(message.content)} aria-label="Copy your message" title="Copy message"><Copy size={15} /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="message-row assistant-row">
      <BrandMark small />
      <div className="assistant-message">
        <div className="assistant-byline"><strong>Hydrogen</strong><span>Gemini 4 Hydrogen</span></div>
        {message.content && <Markdown content={message.content} />}
        {message.status === 'streaming' && (
          <div className="thinking-indicator" role="status">
            {message.content ? <span className="stream-cursor" aria-label="Writing response" /> : <><span className="thinking-dots"><i /><i /><i /></span><span>Thinking...</span></>}
          </div>
        )}
        {message.status === 'error' && (
          <div className="response-error"><AlertCircle size={17} /><span>{message.error || 'Something went wrong.'}</span>{isLastAssistant && <button type="button" onClick={onRegenerate}>Try again</button>}</div>
        )}
        {message.status === 'stopped' && <div className="response-stopped">Response stopped{!message.content && isLastAssistant && <button type="button" onClick={onRegenerate}>Retry</button>}</div>}
        {message.content && message.status !== 'streaming' && (
          <div className="message-actions">
            <button className="message-action" type="button" onClick={() => onCopy(message.content)} title="Copy response"><Copy size={15} /><span>Copy</span></button>
            {isLastAssistant && <button className="message-action" type="button" onClick={onRegenerate} title="Regenerate response"><RotateCcw size={15} /><span>Retry</span></button>}
          </div>
        )}
      </div>
    </div>
  );
}

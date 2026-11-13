import { ArrowUpRight, BookOpen, Code2, Lightbulb, PenLine, Sparkles } from 'lucide-react';

const suggestions = [
  {
    icon: PenLine,
    title: 'Write & refine',
    description: 'Find just the right words',
    prompt: 'Help me write something thoughtful and clear. Ask me what I am working on first.',
  },
  {
    icon: Lightbulb,
    title: 'Think it through',
    description: 'Untangle a tricky decision',
    prompt: 'Help me think through a decision. Ask me a few good questions to clarify my options.',
  },
  {
    icon: BookOpen,
    title: 'Learn something',
    description: 'Make the complex click',
    prompt: 'Explain a complex topic to me in simple terms, with a useful analogy. Ask me what I want to learn.',
  },
  {
    icon: Code2,
    title: 'Make something',
    description: 'Turn an idea into a plan',
    prompt: 'Help me turn a rough idea into a practical plan. Start by asking what I have in mind.',
  },
];

export function Welcome({ onSuggestion, connected, onConnect }) {
  return (
    <div className="welcome">
      <div className="welcome-intro">
        <div className="welcome-symbol" aria-hidden="true"><Sparkles size={29} strokeWidth={1.35} /></div>
        <p className="eyebrow">A LITTLE ROOM TO THINK</p>
        <h1>What’s on your mind <em>today?</em></h1>
        <p className="welcome-description">Bring a question, a half-formed idea, or a blank page.<br className="desktop-break" /> We’ll figure it out together.</p>
      </div>

      <div className="suggestions" aria-label="Ideas to get started">
        {suggestions.map(({ icon: Icon, title, description, prompt }) => (
          <button className="suggestion-card" type="button" key={title} onClick={() => onSuggestion(prompt)}>
            <span className="suggestion-icon"><Icon size={19} strokeWidth={1.7} /></span>
            <span className="suggestion-text"><strong>{title}</strong><span>{description}</span></span>
            <ArrowUpRight className="suggestion-arrow" size={16} strokeWidth={1.7} aria-hidden="true" />
          </button>
        ))}
      </div>

      {!connected && (
        <button className="welcome-connect" type="button" onClick={onConnect}>
          <span className="connection-dot" /> Connect your Gemini API key to start chatting <ArrowUpRight size={14} />
        </button>
      )}
    </div>
  );
}

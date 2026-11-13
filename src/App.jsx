import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Download, Menu, PanelLeftOpen, Settings2, Sparkles, X } from 'lucide-react';
import { Sidebar } from './components/Sidebar.jsx';
import { Welcome } from './components/Welcome.jsx';
import { Composer } from './components/Composer.jsx';
import { Message } from './components/Message.jsx';
import { DeleteDialog, SearchDialog, SettingsDialog } from './components/Dialogs.jsx';
import { DEFAULT_MODEL, streamReply } from './lib/stream.js';
import {
  downloadChat, isKeyRemembered, loadActiveId, loadChats, loadModel, loadSessionKey, loadThinkingLevel,
  makeTitle, saveActiveId, saveChats, saveModel, saveSessionKey, saveThinkingLevel,
} from './lib/storage.js';

const thinkingLabels = { low: 'Quick', medium: 'Balanced', high: 'Deep', xhigh: 'Extra deep' };

function id() { return crypto.randomUUID(); }

function historyFrom(messages) {
  const recent = messages
    .filter((message) => message.content?.trim() && !(message.role === 'assistant' && message.status === 'error'))
    .slice(-60)
    .map(({ role, content }) => ({ role, content: content.slice(-24_000) }));
  const history = [];
  let length = 0;
  for (let index = recent.length - 1; index >= 0; index--) {
    if (length + recent[index].content.length > 150_000) break;
    history.unshift(recent[index]);
    length += recent[index].content.length;
  }
  // Gemini conversations should begin with a user turn, even when older context was trimmed.
  while (history[0]?.role === 'assistant') history.shift();
  return history;
}

export default function App() {
  const [chats, setChats] = useState(loadChats);
  const [activeId, setActiveId] = useState(loadActiveId);
  const [draft, setDraft] = useState('');
  const [apiKey, setApiKey] = useState(loadSessionKey);
  const [rememberKey, setRememberKey] = useState(isKeyRemembered);
  const [model, setModel] = useState(loadModel);
  const [thinkingLevel, setThinkingLevel] = useState(loadThinkingLevel);
  const [streamingChatId, setStreamingChatId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const controllerRef = useRef(null);
  const modelMenuRef = useRef(null);
  const activeChat = chats.find((chat) => chat.id === activeId);
  const connected = Boolean(apiKey);
  const isStreaming = Boolean(streamingChatId);

  useEffect(() => {
    const timeout = setTimeout(() => saveChats(chats), 200);
    return () => clearTimeout(timeout);
  }, [chats]);
  useEffect(() => { saveActiveId(activeId); }, [activeId]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    if (!modelMenuOpen) return;
    const close = (event) => { if (!modelMenuRef.current?.contains(event.target)) setModelMenuOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [modelMenuOpen]);

  useEffect(() => {
    const handler = (event) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setSearchOpen(true); setModelMenuOpen(false);
      } else if (mod && event.key.toLowerCase() === 'o') {
        event.preventDefault(); newChat();
      } else if (event.key === 'Escape') {
        if (modelMenuOpen) setModelMenuOpen(false);
        else if (searchOpen) setSearchOpen(false);
        else if (settingsOpen) setSettingsOpen(false);
        else if (sidebarOpen) setSidebarOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  });

  useEffect(() => {
    if (!activeId) return;
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      stickToBottomRef.current = true;
    });
  }, [activeId]);
  useEffect(() => {
    if (!activeId || !stickToBottomRef.current) return;
    requestAnimationFrame(() => {
      if (scrollRef.current && stickToBottomRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }, [activeId, activeChat?.messages.length, activeChat?.messages.at(-1)?.content]);

  function patchMessage(chatId, messageId, patch) {
    setChats((current) => current.map((chat) => chat.id === chatId ? {
      ...chat,
      updatedAt: Date.now(),
      messages: chat.messages.map((message) => message.id === messageId ? { ...message, ...patch } : message),
    } : chat));
  }

  async function generate(chatId, assistantId, history) {
    const controller = new AbortController();
    controllerRef.current = controller;
    setStreamingChatId(chatId);
    let responseText = '';

    try {
      await streamReply({
        messages: history,
        thinkingLevel,
        apiKey,
        model,
        signal: controller.signal,
        onDelta: (text) => {
          responseText += text;
          patchMessage(chatId, assistantId, { content: responseText });
        },
        onNotice: (message) => setToast({ message }),
      });
      if (!responseText.trim()) throw new Error('Gemini returned an empty response. Please try again.');
      patchMessage(chatId, assistantId, { status: 'done' });
    } catch (error) {
      if (controller.signal.aborted) {
        patchMessage(chatId, assistantId, { status: 'stopped' });
      } else {
        patchMessage(chatId, assistantId, { status: 'error', error: error.message || 'Something went wrong.' });
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      setStreamingChatId(null);
    }
  }

  function sendMessage() {
    const text = draft.trim();
    if (!text || isStreaming) return;
    if (!connected) { setSettingsOpen(true); return; }

    const now = Date.now();
    const chatId = activeChat?.id || id();
    const previous = (activeChat?.messages || []).filter((message) => !(message.role === 'assistant' && message.status === 'error' && !message.content));
    const userMessage = { id: id(), role: 'user', content: text, status: 'done', createdAt: now };
    const assistantMessage = { id: id(), role: 'assistant', content: '', status: 'streaming', createdAt: now };
    const messages = [...previous, userMessage, assistantMessage];

    setChats((current) => activeChat
      ? current.map((chat) => chat.id === chatId ? { ...chat, messages, updatedAt: now } : chat)
      : [{ id: chatId, title: makeTitle(text), createdAt: now, updatedAt: now, messages }, ...current]);
    setActiveId(chatId);
    setDraft('');
    stickToBottomRef.current = true;
    generate(chatId, assistantMessage.id, historyFrom([...previous, userMessage]));
  }

  function regenerate() {
    if (!activeChat || isStreaming || activeChat.messages.at(-1)?.role !== 'assistant') return;
    const previous = activeChat.messages.slice(0, -1);
    if (previous.at(-1)?.role !== 'user') return;
    const assistantMessage = { id: id(), role: 'assistant', content: '', status: 'streaming', createdAt: Date.now() };
    setChats((current) => current.map((chat) => chat.id === activeChat.id
      ? { ...chat, messages: [...previous, assistantMessage], updatedAt: Date.now() } : chat));
    stickToBottomRef.current = true;
    generate(activeChat.id, assistantMessage.id, historyFrom(previous));
  }

  function newChat() {
    controllerRef.current?.abort();
    setActiveId(null); setDraft(''); setSidebarOpen(false); setModelMenuOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function selectChat(chatId) {
    controllerRef.current?.abort();
    setActiveId(chatId); setDraft(''); setSidebarOpen(false); setSearchOpen(false); setModelMenuOpen(false);
  }

  function saveSettings({ apiKey: key, rememberKey: remember, model: modelId, thinkingLevel: level }) {
    setApiKey(key); setRememberKey(Boolean(key && remember)); saveSessionKey(key, remember);
    setModel(modelId || DEFAULT_MODEL); saveModel(modelId || DEFAULT_MODEL);
    setThinkingLevel(level); saveThinkingLevel(level);
    setSettingsOpen(false);
    setToast({ message: key ? 'Preferences saved. You’re ready to chat.' : 'Preferences saved. Add an API key to start chatting.' });
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); setToast({ message: 'Copied to clipboard.' }); }
    catch { setToast({ message: 'Could not copy to clipboard.' }); }
  }

  function confirmDelete() {
    if (!deleteId) return;
    if (streamingChatId === deleteId) controllerRef.current?.abort();
    setChats((current) => current.filter((chat) => chat.id !== deleteId));
    if (activeId === deleteId) setActiveId(null);
    setDeleteId(null);
    setToast({ message: 'Conversation deleted.' });
  }

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {sidebarOpen && <div className="mobile-scrim" onClick={() => setSidebarOpen(false)} />}
      <Sidebar
        chats={chats} activeId={activeId} isOpen={sidebarOpen} isCollapsed={sidebarCollapsed} connected={connected}
        onNew={newChat} onSelect={selectChat} onSearch={() => { setSearchOpen(true); setSidebarOpen(false); }}
        onSettings={() => { setSettingsOpen(true); setSidebarOpen(false); }}
        onCollapse={() => setSidebarCollapsed((value) => !value)} onCloseMobile={() => setSidebarOpen(false)}
        onRename={(chatId, title) => setChats((current) => current.map((chat) => chat.id === chatId ? { ...chat, title } : chat))}
        onDelete={setDeleteId} onExport={(chat) => { downloadChat(chat); setToast({ message: 'Conversation exported as Markdown.' }); }}
      />

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu-button" type="button" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar"><Menu size={21} /></button>
            {sidebarCollapsed && <button className="icon-button desktop-expand-button" type="button" onClick={() => setSidebarCollapsed(false)} aria-label="Expand sidebar"><PanelLeftOpen size={19} /></button>}
            <div className="breadcrumb"><span>Workspace</span><ChevronRight size={15} /><strong>{activeChat?.title || 'New conversation'}</strong></div>
          </div>
          <div className="topbar-right">
            {activeChat && <button className="icon-button export-button" type="button" onClick={() => { downloadChat(activeChat); setToast({ message: 'Conversation exported as Markdown.' }); }} aria-label="Export conversation" title="Export as Markdown"><Download size={18} /></button>}
            <div className="model-control" ref={modelMenuRef}>
              <button className={`model-pill ${modelMenuOpen ? 'is-active' : ''}`} type="button" onClick={() => setModelMenuOpen((value) => !value)} aria-haspopup="menu" aria-expanded={modelMenuOpen}>
                <Sparkles size={16} strokeWidth={1.8} /><span>{model === DEFAULT_MODEL ? 'Gemini 4 Hydrogen' : model}</span><ChevronDown size={15} />
              </button>
              {modelMenuOpen && (
                <div className="model-popover" role="menu">
                  <div className="model-popover-top"><span className="model-popover-icon"><Sparkles size={18} /></span><div><strong>{model === DEFAULT_MODEL ? 'Gemini 4 Hydrogen' : model}</strong><small>Thoughtful answers, at your pace.</small></div><Check size={16} className="model-check" /></div>
                  <div className="popover-divider" />
                  <div className="popover-label">THINKING LEVEL</div>
                  {Object.entries(thinkingLabels).map(([value, label]) => <button className="popover-option" type="button" role="menuitemradio" aria-checked={thinkingLevel === value} key={value} onClick={() => { setThinkingLevel(value); saveThinkingLevel(value); setModelMenuOpen(false); }}><span>{label}</span>{thinkingLevel === value && <Check size={16} />}</button>)}
                  <div className="popover-divider" />
                  <button className="popover-settings" type="button" role="menuitem" onClick={() => { setModelMenuOpen(false); setSettingsOpen(true); }}><Settings2 size={16} /> Connection & settings</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className={`conversation-scroll ${!activeChat ? 'empty-scroll' : ''}`} ref={scrollRef} onScroll={(event) => {
          const element = event.currentTarget;
          stickToBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 160;
        }}>
          {!activeChat ? (
            <Welcome onSuggestion={(prompt) => { setDraft(prompt); inputRef.current?.focus(); }} connected={connected} onConnect={() => setSettingsOpen(true)} />
          ) : (
            <div className="messages-container" aria-live="polite" aria-relevant="additions">
              {activeChat.messages.map((message, index) => (
                <Message key={message.id} message={message} isLastAssistant={index === activeChat.messages.length - 1} onCopy={copyText} onRegenerate={regenerate} />
              ))}
            </div>
          )}
        </div>

        <Composer draft={draft} onDraftChange={setDraft} onSend={sendMessage} onStop={() => controllerRef.current?.abort()} isStreaming={isStreaming} connected={connected} onConnect={() => setSettingsOpen(true)} inputRef={inputRef} />
      </main>

      {searchOpen && <SearchDialog chats={chats} onSelect={selectChat} onClose={() => setSearchOpen(false)} />}
      {settingsOpen && <SettingsDialog apiKey={apiKey} rememberKey={rememberKey} model={model} thinkingLevel={thinkingLevel} onSave={saveSettings} onClose={() => setSettingsOpen(false)} />}
      {deleteId && <DeleteDialog title={chats.find((chat) => chat.id === deleteId)?.title || 'This conversation'} onConfirm={confirmDelete} onClose={() => setDeleteId(null)} />}
      {toast && <div className="toast" role="status"><span className="toast-icon"><Check size={15} /></span><span>{toast.message}</span><button type="button" onClick={() => setToast(null)} aria-label="Dismiss notification"><X size={16} /></button></div>}
    </div>
  );
}

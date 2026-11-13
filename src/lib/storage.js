import { DEFAULT_MODEL } from './stream.js';

const CHATS_KEY = 'hydrogen.chats.v1';
const ACTIVE_KEY = 'hydrogen.active.v1';
const THINKING_KEY = 'hydrogen.thinking.v1';
const API_KEY = 'hydrogen.session-key.v1';
const REMEMBERED_KEY = 'hydrogen.remembered-key.v1';
const MODEL_KEY = 'hydrogen.model.v1';
const LEVELS = ['low', 'medium', 'high', 'xhigh'];

export function loadChats() {
  try {
    const value = JSON.parse(localStorage.getItem(CHATS_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((chat) => typeof chat.id === 'string' && Array.isArray(chat.messages))
      .map((chat) => ({
        ...chat,
        messages: chat.messages
          .filter((message) => typeof message.content === 'string' && ['user', 'assistant'].includes(message.role))
          .filter((message) => message.role === 'user' || message.content || message.status === 'error')
          .map((message) => ({
            ...message,
            status: message.status === 'streaming' ? 'stopped' : message.status,
          })),
      }));
  } catch {
    return [];
  }
}

export function saveChats(chats) {
  try {
    localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
  } catch {
    // Browsers may block storage or run out of room. The current tab still works.
  }
}

export function loadActiveId() {
  try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; }
}

export function saveActiveId(id) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch { /* storage unavailable */ }
}

export function loadThinkingLevel() {
  try {
    const value = localStorage.getItem(THINKING_KEY);
    return LEVELS.includes(value) ? value : 'low';
  } catch { return 'low'; }
}

export function saveThinkingLevel(value) {
  try { localStorage.setItem(THINKING_KEY, value); } catch { /* storage unavailable */ }
}

// The API key lives in session storage (this tab only) unless the person opts in
// to remembering it on this device, in which case it moves to local storage.
export function loadSessionKey() {
  try { return localStorage.getItem(REMEMBERED_KEY) || sessionStorage.getItem(API_KEY) || ''; } catch { return ''; }
}

export function isKeyRemembered() {
  try { return Boolean(localStorage.getItem(REMEMBERED_KEY)); } catch { return false; }
}

export function saveSessionKey(value, remember = false) {
  try {
    sessionStorage.removeItem(API_KEY);
    localStorage.removeItem(REMEMBERED_KEY);
    if (value) (remember ? localStorage : sessionStorage).setItem(remember ? REMEMBERED_KEY : API_KEY, value);
  } catch { /* storage unavailable */ }
}

export function loadModel() {
  try { return localStorage.getItem(MODEL_KEY) || DEFAULT_MODEL; } catch { return DEFAULT_MODEL; }
}

export function saveModel(value) {
  try {
    if (value && value !== DEFAULT_MODEL) localStorage.setItem(MODEL_KEY, value);
    else localStorage.removeItem(MODEL_KEY);
  } catch { /* storage unavailable */ }
}

export function makeTitle(text) {
  const firstLine = text.trim().split('\n')[0].replace(/^#+\s*/, '').trim();
  return firstLine.length > 48 ? `${firstLine.slice(0, 47).trimEnd()}…` : firstLine || 'New conversation';
}

export function groupChats(chats) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 24 * 60 * 60 * 1000;
  const groups = { Today: [], Yesterday: [], 'Previous 7 days': [], Older: [] };
  for (const chat of [...chats].sort((a, b) => b.updatedAt - a.updatedAt)) {
    const time = Number(chat.updatedAt) || 0;
    const group = time >= today ? 'Today' : time >= today - day ? 'Yesterday'
      : time >= today - 7 * day ? 'Previous 7 days' : 'Older';
    groups[group].push(chat);
  }
  return Object.entries(groups).filter(([, items]) => items.length);
}

export function downloadChat(chat) {
  const lines = [`# ${chat.title}`, ''];
  for (const message of chat.messages) {
    if (!message.content) continue;
    lines.push(`## ${message.role === 'user' ? 'You' : 'Hydrogen'}`, '', message.content, '');
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${chat.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'conversation'}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

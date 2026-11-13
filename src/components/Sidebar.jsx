import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight, Download, MessageSquareText, MoreHorizontal, PanelLeftClose,
  PanelLeftOpen, Pencil, Plus, Search, Settings2, Trash2, X,
} from 'lucide-react';
import { Brand } from './Brand.jsx';
import { groupChats } from '../lib/storage.js';

export function Sidebar({ chats, activeId, isOpen, isCollapsed, connected, onNew, onSelect, onSearch, onSettings, onCollapse, onCloseMobile, onRename, onDelete, onExport }) {
  const [openMenu, setOpenMenu] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const cancelledRename = useRef(false);

  useEffect(() => { setOpenMenu(null); }, [activeId]);
  useEffect(() => {
    if (!openMenu) return;
    const close = (event) => {
      if (!event.target.closest('.chat-menu') && !event.target.closest('.chat-more')) setOpenMenu(null);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [openMenu]);

  const startRename = (chat) => {
    cancelledRename.current = false;
    setRenameValue(chat.title);
    setRenamingId(chat.id);
    setOpenMenu(null);
  };
  const commitRename = () => {
    if (!cancelledRename.current && renameValue.trim()) onRename(renamingId, renameValue.trim());
    setRenamingId(null);
  };

  return (
    <aside className={`sidebar ${isOpen ? 'is-open' : ''} ${isCollapsed ? 'is-collapsed' : ''}`} aria-label="Chat sidebar">
      <div className="sidebar-top">
        <div className="sidebar-brand-row">
          <div className="sidebar-brand"><Brand /></div>
          <button className="icon-button sidebar-collapse" type="button" onClick={onCollapse} aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <button className="icon-button sidebar-mobile-close" type="button" onClick={onCloseMobile} aria-label="Close sidebar"><X size={20} /></button>
        </div>
        <div className="sidebar-quick-actions">
          <button className="new-chat-button" type="button" onClick={onNew} title="New chat">
            <Plus size={18} strokeWidth={1.9} /><span className="hide-when-collapsed">New chat</span><span className="sidebar-shortcut hide-when-collapsed">⌘ O</span>
          </button>
          <button className="search-button" type="button" onClick={onSearch} title="Search conversations">
            <Search size={17} strokeWidth={1.8} /><span className="hide-when-collapsed">Search conversations</span><span className="sidebar-shortcut hide-when-collapsed">⌘ K</span>
          </button>
        </div>
      </div>

      <nav className="sidebar-scroll" aria-label="Conversations">
        <div className="sidebar-section-heading">Your conversations</div>
        {chats.length === 0 ? (
          <div className="sidebar-empty">Your chats will find a home here.</div>
        ) : groupChats(chats).map(([group, items]) => (
          <div className="chat-group" key={group}>
            <div className="chat-group-label">{group}</div>
            {items.map((chat) => (
              <div className={`chat-item-wrap ${activeId === chat.id ? 'active' : ''}`} key={chat.id}>
                {renamingId === chat.id ? (
                  <input
                    className="rename-input"
                    autoFocus
                    aria-label="Rename conversation"
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') { event.preventDefault(); commitRename(); }
                      if (event.key === 'Escape') { cancelledRename.current = true; setRenamingId(null); }
                    }}
                  />
                ) : (
                  <>
                    <button className="chat-item" type="button" onClick={() => onSelect(chat.id)} title={chat.title} aria-current={activeId === chat.id ? 'page' : undefined}>
                      <MessageSquareText size={16} strokeWidth={1.65} /><span>{chat.title}</span>
                    </button>
                    <button className="chat-more" type="button" aria-label={`More options for ${chat.title}`} aria-haspopup="menu" aria-expanded={openMenu === chat.id} onClick={() => setOpenMenu(openMenu === chat.id ? null : chat.id)}><MoreHorizontal size={17} /></button>
                    {openMenu === chat.id && (
                      <div className="chat-menu" role="menu">
                        <button type="button" role="menuitem" onClick={() => startRename(chat)}><Pencil size={15} /> Rename</button>
                        <button type="button" role="menuitem" onClick={() => { onExport(chat); setOpenMenu(null); }}><Download size={15} /> Export as Markdown</button>
                        <div className="menu-divider" />
                        <button className="danger-item" type="button" role="menuitem" onClick={() => { onDelete(chat.id); setOpenMenu(null); }}><Trash2 size={15} /> Delete</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-bottom">
        {!connected ? (
          <button className="connection-card hide-when-collapsed" type="button" onClick={onSettings}>
            <span className="connection-card-top">Connect to Gemini <ArrowUpRight size={15} /></span>
            <span>Bring your API key to start a conversation.</span>
          </button>
        ) : (
          <div className="connected-status hide-when-collapsed"><span className="status-dot" /> Connected to Gemini</div>
        )}
        <button className="workspace-button" type="button" onClick={onSettings} title="Settings">
          <span className="workspace-avatar">H</span>
          <span className="workspace-label hide-when-collapsed"><strong>Personal workspace</strong><small>Settings & preferences</small></span>
          <Settings2 className="workspace-settings hide-when-collapsed" size={17} strokeWidth={1.7} />
        </button>
      </div>
    </aside>
  );
}

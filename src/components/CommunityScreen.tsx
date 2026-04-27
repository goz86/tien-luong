import { useState, useEffect } from 'react';
import {
  BadgeCheck,
  Bell,
  BookmarkCheck,
  ChevronRight,
  ClipboardList,
  Clock3,
  Flame,
  HelpCircle,
  MapPin,
  MessageCircle,
  Megaphone,
  PenLine,
  Plus,
  Search,
  Send,
  ShoppingBag,
  Star,
  Store,
  Tag,
  ThumbsUp,
  Users,
  type LucideIcon,
  X
} from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { CompanionProfile } from '../lib/types';
import { Logo } from './shared/Logo';
import { supabase } from '../lib/supabase';

type CommunityTab = 'feed' | 'friends' | 'market' | 'reviews' | 'qa';
type IconComponent = LucideIcon;

const communityTabs: Array<{ id: CommunityTab; label: string; icon: IconComponent }> = [
  { id: 'feed', label: 'Bảng tin', icon: MessageCircle },
  { id: 'friends', label: 'Bạn bè', icon: Users },
  { id: 'market', label: 'Chợ cũ', icon: ShoppingBag },
  { id: 'reviews', label: 'Review', icon: Star },
  { id: 'qa', label: 'Hỏi đáp', icon: HelpCircle }
];

const shortcuts: Array<{ label: string; icon: IconComponent; tone: string }> = [
  { label: 'Bài của tôi', icon: PenLine, tone: 'ink' },
  { label: 'Bình luận', icon: MessageCircle, tone: 'green' },
  { label: 'Đã lưu', icon: BookmarkCheck, tone: 'blue' },
  { label: 'Đang hot', icon: Flame, tone: 'amber' }
];

interface Post {
  id: string;
  user_id: string;
  title: string;
  content: string;
  board: string;
  is_anonymous: boolean;
  likes_count: number;
  comments_count: number;
  created_at: string;
}

export function CommunityScreen({
  companions,
  requested,
  onRequest,
  session
}: {
  companions: CompanionProfile[];
  requested: string[];
  onRequest: (id: string) => void;
  session: Session | null;
}) {
  const [activeTab, setActiveTab] = useState<CommunityTab>('feed');
  const [posts, setPosts] = useState<Post[]>([]);
  const [isWriting, setIsWriting] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    fetchPosts();
  }, []);

  async function fetchPosts() {
    if (!supabase) return;
    const { data } = await supabase.from('community_posts').select('*').order('created_at', { ascending: false });
    if (data) setPosts(data);
  }

  async function handleCreatePost() {
    if (!session || !supabase) {
      setAuthError('Vui lòng đăng nhập ở tab Hồ sơ để viết bài.');
      return;
    }
    if (!newTitle.trim() || !newContent.trim()) return;

    setSubmitting(true);
    const { data, error } = await supabase.from('community_posts').insert({
      user_id: session.user.id,
      title: newTitle,
      content: newContent,
      board: activeTab,
      is_anonymous: isAnonymous
    }).select().single();

    setSubmitting(false);
    if (!error && data) {
      setPosts([data, ...posts]);
      setIsWriting(false);
      setNewTitle('');
      setNewContent('');
      setIsAnonymous(false);
      setAuthError('');
    }
  }

  function renderPostStats(likes: number, comments: number) {
    return (
      <div className="community-post-stats">
        <span>
          <ThumbsUp size={15} />
          {likes}
        </span>
        <span>
          <MessageCircle size={15} />
          {comments}
        </span>
      </div>
    );
  }

  // Filter posts based on active tab
  const tabPosts = posts.filter(post => post.board === activeTab);

  return (
    <>
      <header className="community-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Logo />
        <div className="community-header-actions">
          <button type="button" className="community-icon-button" aria-label="Tìm kiếm">
            <Search size={21} />
          </button>
          <button type="button" className="community-icon-button muted" aria-label="Thông báo">
            <Bell size={21} />
          </button>
        </div>
      </header>

      {/* Write Post Modal */}
      {isWriting && (
        <div className="sheet-backdrop" onClick={() => setIsWriting(false)}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <header className="sheet-header">
              <h2>Tạo bài viết mới</h2>
              <button type="button" className="icon-button" onClick={() => setIsWriting(false)}>
                <X size={20} />
              </button>
            </header>
            <div className="sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {authError && <div style={{ color: '#ef4444', background: '#fef2f2', padding: '12px', borderRadius: '8px' }}>{authError}</div>}
              <div className="field-group">
                <label>Tiêu đề</label>
                <input className="solid-input" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Nhập tiêu đề..." />
              </div>
              <div className="field-group">
                <label>Nội dung</label>
                <textarea className="solid-input" value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="Nhập nội dung bài viết..." rows={4} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '8px 0' }}>
                <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                <span>Chế độ ẩn danh</span>
              </label>
              <button type="button" className="solid-button" onClick={handleCreatePost} disabled={submitting}>
                {submitting ? 'Đang đăng...' : 'Đăng bài'}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="community-shortcuts" aria-label="Lối tắt cộng đồng">
        {shortcuts.map(({ label, icon: Icon, tone }) => (
          <button key={label} type="button" className="community-shortcut">
            <span className={`community-shortcut-icon ${tone}`}>
              <Icon size={23} />
            </span>
            <strong>{label}</strong>
          </button>
        ))}
      </section>

      <div className="community-subtabs" role="tablist" aria-label="Mục cộng đồng">
        {communityTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={activeTab === id ? 'active' : ''}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      <div className="community-tab-body">
        {activeTab !== 'friends' && (
          <div className="community-board-stack">
            <section className="community-board-section">
              <div className="community-thread-list">
                {tabPosts.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#64748b', padding: '32px 0' }}>Chưa có bài viết nào.</p>
                ) : (
                  tabPosts.map((post) => (
                    <article key={post.id} className="community-thread-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="community-new-badge" style={{ background: post.is_anonymous ? '#f1f5f9' : '#e0e7ff', color: post.is_anonymous ? '#64748b' : '#3730a3' }}>
                          {post.is_anonymous ? 'Ẩn danh' : 'Thành viên'}
                        </span>
                        <small style={{ color: '#94a3b8' }}>{new Date(post.created_at).toLocaleDateString('vi-VN')}</small>
                      </div>
                      <p style={{ fontWeight: 600, fontSize: '15px' }}>{post.title}</p>
                      <p style={{ color: '#475569', fontSize: '14px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{post.content}</p>
                      {renderPostStats(post.likes_count, post.comments_count)}
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'friends' && (
          <div className="community-friend-list">
            {companions.map((companion) => {
              const sent = requested.includes(companion.id);
              return (
                <article key={companion.id} className="community-friend-row">
                  <div className="community-avatar">{companion.displayName.slice(0, 1)}</div>
                  <div className="community-friend-main">
                    <div>
                      <strong>{companion.displayName}</strong>
                      <span>{companion.school}</span>
                    </div>
                    <p>{companion.focus}</p>
                    <div className="community-chip-row">
                      <span>
                        <MapPin size={13} />
                        {companion.region}
                      </span>
                      <span>
                        <Clock3 size={13} />
                        {companion.availability ?? 'Sau giờ học'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={sent ? 'community-request sent' : 'community-request'}
                    onClick={() => onRequest(companion.id)}
                    aria-label={sent ? `Đã gửi lời mời cho ${companion.displayName}` : `Kết nối với ${companion.displayName}`}
                  >
                    {sent ? <BadgeCheck size={18} /> : <Send size={18} />}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <button type="button" className="community-compose-button" onClick={() => {
        if (!session) {
          alert('Vui lòng đăng nhập ở tab Hồ sơ để viết bài.');
          return;
        }
        setIsWriting(true);
      }}>
        <Plus size={22} />
        {activeTab === 'market'
          ? 'Đăng bán'
          : activeTab === 'reviews'
            ? 'Viết review'
            : activeTab === 'friends'
              ? 'Tìm bạn'
              : activeTab === 'qa'
                ? 'Đặt câu hỏi'
                : 'Viết bài'}
      </button>
    </>
  );
}

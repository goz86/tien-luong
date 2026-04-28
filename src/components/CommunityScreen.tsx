import { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Bell,
  Bookmark,
  BookmarkCheck,
  ChevronRight,
  Flame,
  MessageCircle,
  MoreHorizontal,
  PenLine,
  Plus,
  Search,
  Send,
  ThumbsDown,
  ThumbsUp,
  User,
  X,
  Eye,
} from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { CompanionProfile } from '../lib/types';
import { Logo } from './shared/Logo';
import {
  CATEGORIES,
  CommunityCategory,
  CommunityComment,
  CommunityPost,
  demoComments,
  demoPosts,
  timeAgo,
} from '../data/communityData';

type CommunityView = 'feed' | 'detail';
type CategoryFilter = CommunityCategory | 'all';
type FeedFilter = 'all' | 'mine' | 'saved';

export function CommunityScreen({
  companions,
  requested,
  onRequest,
  session,
}: {
  companions: CompanionProfile[];
  requested: string[];
  onRequest: (id: string) => void;
  session: Session | null;
}) {
  const [view, setView] = useState<CommunityView>('feed');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>(demoPosts);
  const [comments, setComments] = useState<CommunityComment[]>(demoComments);
  const [isWriting, setIsWriting] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<CommunityCategory>('free');
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all');
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [dislikedPosts, setDislikedPosts] = useState<Set<string>>(new Set());
  const [bookmarkedPosts, setBookmarkedPosts] = useState<Set<string>>(new Set());
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const commentInputRef = useRef<HTMLInputElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  // Back button support
  useEffect(() => {
    function handlePopstate() {
      if (isWriting) {
        setIsWriting(false);
        return;
      }
      if (view === 'detail') {
        setView('feed');
        setSelectedPost(null);
        return;
      }
    }
    window.addEventListener('popstate', handlePopstate);
    return () => window.removeEventListener('popstate', handlePopstate);
  }, [view, isWriting]);

  function openPost(post: CommunityPost) {
    setSelectedPost({
      ...post,
      views_count: post.views_count + 1,
    });
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, views_count: p.views_count + 1 } : p))
    );
    setView('detail');
    setReplyTo(null);
    history.pushState({ communityView: 'detail' }, '');
  }

  function goBack() {
    setView('feed');
    setSelectedPost(null);
    setReplyTo(null);
  }

  function toggleLike(postId: string) {
    if (likedPosts.has(postId)) {
      setLikedPosts((prev) => { const n = new Set(prev); n.delete(postId); return n; });
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likes_count: p.likes_count - 1 } : p)));
      if (selectedPost?.id === postId) setSelectedPost((p) => p ? { ...p, likes_count: p.likes_count - 1 } : p);
    } else {
      // Remove dislike if exists
      if (dislikedPosts.has(postId)) {
        setDislikedPosts((prev) => { const n = new Set(prev); n.delete(postId); return n; });
        setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, dislikes_count: p.dislikes_count - 1 } : p)));
        if (selectedPost?.id === postId) setSelectedPost((p) => p ? { ...p, dislikes_count: p.dislikes_count - 1 } : p);
      }
      setLikedPosts((prev) => new Set(prev).add(postId));
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likes_count: p.likes_count + 1 } : p)));
      if (selectedPost?.id === postId) setSelectedPost((p) => p ? { ...p, likes_count: p.likes_count + 1 } : p);
    }
  }

  function toggleDislike(postId: string) {
    if (dislikedPosts.has(postId)) {
      setDislikedPosts((prev) => { const n = new Set(prev); n.delete(postId); return n; });
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, dislikes_count: p.dislikes_count - 1 } : p)));
      if (selectedPost?.id === postId) setSelectedPost((p) => p ? { ...p, dislikes_count: p.dislikes_count - 1 } : p);
    } else {
      if (likedPosts.has(postId)) {
        setLikedPosts((prev) => { const n = new Set(prev); n.delete(postId); return n; });
        setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likes_count: p.likes_count - 1 } : p)));
        if (selectedPost?.id === postId) setSelectedPost((p) => p ? { ...p, likes_count: p.likes_count - 1 } : p);
      }
      setDislikedPosts((prev) => new Set(prev).add(postId));
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, dislikes_count: p.dislikes_count + 1 } : p)));
      if (selectedPost?.id === postId) setSelectedPost((p) => p ? { ...p, dislikes_count: p.dislikes_count + 1 } : p);
    }
  }

  function toggleBookmark(postId: string) {
    setBookmarkedPosts((prev) => {
      const n = new Set(prev);
      if (n.has(postId)) n.delete(postId);
      else n.add(postId);
      return n;
    });
  }

  function toggleCommentLike(commentId: string) {
    if (likedComments.has(commentId)) {
      setLikedComments((prev) => { const n = new Set(prev); n.delete(commentId); return n; });
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, likes_count: c.likes_count - 1 } : c)));
    } else {
      setLikedComments((prev) => new Set(prev).add(commentId));
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, likes_count: c.likes_count + 1 } : c)));
    }
  }

  function addComment() {
    if (!newComment.trim() || !selectedPost) return;
    const comment: CommunityComment = {
      id: `cmt-new-${Date.now()}`,
      post_id: selectedPost.id,
      parent_id: replyTo,
      user_id: session?.user.id || 'me',
      content: newComment.trim(),
      is_anonymous: true,
      display_name: 'Bạn',
      is_author: false,
      likes_count: 0,
      created_at: new Date().toISOString(),
    };
    setComments((prev) => [...prev, comment]);
    setPosts((prev) =>
      prev.map((p) => (p.id === selectedPost.id ? { ...p, comments_count: p.comments_count + 1 } : p))
    );
    setSelectedPost((p) => (p ? { ...p, comments_count: p.comments_count + 1 } : p));
    setNewComment('');
    setReplyTo(null);
  }

  function addPost() {
    if (!newTitle.trim() || !newContent.trim()) return;
    const post: CommunityPost = {
      id: `post-new-${Date.now()}`,
      user_id: session?.user.id || 'me',
      category: newCategory,
      title: newTitle.trim(),
      content: newContent.trim(),
      is_anonymous: true,
      display_name: 'Bạn',
      likes_count: 0,
      dislikes_count: 0,
      comments_count: 0,
      views_count: 0,
      created_at: new Date().toISOString(),
    };
    setPosts((prev) => [post, ...prev]);
    setIsWriting(false);
    setNewTitle('');
    setNewContent('');
    setNewCategory('free');
  }

  // Filtered posts
  const filteredPosts = activeCategory === 'all' ? posts : posts.filter((p) => p.category === activeCategory);
  const hotPosts = [...posts].sort((a, b) => b.likes_count - a.likes_count).slice(0, 2);
  const trendingPost = [...posts].sort((a, b) => b.comments_count - a.comments_count)[0];

  // Comments for selected post
  const postComments = selectedPost ? comments.filter((c) => c.post_id === selectedPost.id) : [];
  const rootComments = postComments.filter((c) => !c.parent_id);

  function getReplies(parentId: string) {
    return postComments.filter((c) => c.parent_id === parentId);
  }

  // ==================== FEED VIEW ====================
  if (view === 'feed') {
    return (
      <>
        {/* Header */}
        <header className="cm-header">
          <Logo />
          <div className="cm-header-actions">
            <button type="button" className="cm-icon-btn" aria-label="Tìm kiếm">
              <Search size={20} />
            </button>
            <button type="button" className={`cm-icon-btn ${feedFilter === 'mine' ? 'active' : ''}`} aria-label="Bài của tôi" onClick={() => setFeedFilter(feedFilter === 'mine' ? 'all' : 'mine')}>
              <PenLine size={19} />
            </button>
            <button type="button" className={`cm-icon-btn ${feedFilter === 'saved' ? 'active' : ''}`} aria-label="Đã lưu" onClick={() => setFeedFilter(feedFilter === 'saved' ? 'all' : 'saved')}>
              <BookmarkCheck size={19} />
            </button>
            <button type="button" className="cm-icon-btn" aria-label="Thông báo">
              <Bell size={20} />
              <span className="cm-notification-dot" />
            </button>
          </div>
        </header>

        {/* Notification Card */}
        <section className="cm-notif-card">
          <div className="cm-notif-head">
            <div className="cm-notif-title">
              <Bell size={18} />
              <strong>Thông báo</strong>
            </div>
            <ChevronRight size={18} color="#94a3b8" />
          </div>
          {hotPosts.map((post) => (
            <div key={post.id} className="cm-notif-row" onClick={() => openPost(post)}>
              <p className="cm-notif-text">{post.title}</p>
              <div className="cm-notif-stats">
                <span><ThumbsUp size={13} /> {post.likes_count}</span>
                <span><MessageCircle size={13} /> {post.comments_count}</span>
              </div>
            </div>
          ))}
        </section>

        {/* Trending Post */}
        {trendingPost && (
          <section className="cm-trending" onClick={() => openPost(trendingPost)}>
            <div className="cm-trending-head">
              <div>
                <p className="cm-trending-kicker">ĐANG HOT</p>
                <h2 className="cm-trending-title">Bài đang nổi</h2>
              </div>
              <Flame size={24} color="#64748b" />
            </div>
            <span className="cm-cat-badge" style={{ color: CATEGORIES[trendingPost.category as CommunityCategory]?.color, background: CATEGORIES[trendingPost.category as CommunityCategory]?.bg }}>
              {CATEGORIES[trendingPost.category as CommunityCategory]?.label}
            </span>
            <h3 className="cm-trending-post-title">{trendingPost.title}</h3>
            <p className="cm-trending-preview">{trendingPost.content.slice(0, 100)}...</p>
            <div className="cm-trending-footer">
              <span className="cm-time">{timeAgo(trendingPost.created_at)}</span>
              <div className="cm-post-stats">
                <span><ThumbsUp size={14} /> {trendingPost.likes_count}</span>
                <span><MessageCircle size={14} /> {trendingPost.comments_count}</span>
              </div>
            </div>
          </section>
        )}

        {/* Category Filter Tabs */}
        <div className="cm-category-tabs">
          <button
            type="button"
            className={activeCategory === 'all' ? 'active' : ''}
            onClick={() => setActiveCategory('all')}
          >
            Tất cả
          </button>
          {(Object.keys(CATEGORIES) as CommunityCategory[]).map((cat) => (
            <button
              key={cat}
              type="button"
              className={activeCategory === cat ? 'active' : ''}
              onClick={() => setActiveCategory(cat)}
            >
              {CATEGORIES[cat].label}
            </button>
          ))}
        </div>

        {/* Post List */}
        <div className="cm-post-list">
          {filteredPosts.map((post) => (
            <article key={post.id} className="cm-post-card" onClick={() => openPost(post)}>
              <span
                className="cm-cat-badge"
                style={{
                  color: CATEGORIES[post.category]?.color,
                  background: CATEGORIES[post.category]?.bg,
                }}
              >
                {CATEGORIES[post.category]?.label}
              </span>
              <h3 className="cm-post-title">{post.title}</h3>
              <p className="cm-post-preview">{post.content.slice(0, 80)}...</p>
              <div className="cm-post-footer">
                <span className="cm-time">{timeAgo(post.created_at)}</span>
                <div className="cm-post-stats">
                  <span><ThumbsUp size={14} /> {post.likes_count}</span>
                  <span><MessageCircle size={14} /> {post.comments_count}</span>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Pinned Write Button */}
        <div className="cm-write-bar">
          <button type="button" className="cm-write-bar-btn" onClick={() => {
            setIsWriting(true);
            history.pushState({ communityModal: 'write' }, '');
          }}>
            <Plus size={18} />
            Viết bài
          </button>
        </div>

        {/* Write Modal — Full Screen */}
        {isWriting && (
          <div className="cm-write-fullscreen">
            <header className="cm-write-fs-header">
              <button type="button" onClick={() => setIsWriting(false)} className="cm-icon-btn">
                <X size={22} />
              </button>
              <span className="cm-write-fs-title">Tạo bài viết</span>
              <button
                type="button"
                className="cm-write-fs-submit"
                onClick={addPost}
                disabled={!newTitle.trim() || !newContent.trim()}
              >
                Đăng
              </button>
            </header>

            <div className="cm-write-fs-body">
              {/* Category Picker */}
              <div className="cm-write-fs-cats">
                {(Object.keys(CATEGORIES) as CommunityCategory[]).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={newCategory === cat ? 'active' : ''}
                    onClick={() => setNewCategory(cat)}
                    style={{ '--cat-color': CATEGORIES[cat].color, '--cat-bg': CATEGORIES[cat].bg } as React.CSSProperties}
                  >
                    {CATEGORIES[cat].label}
                  </button>
                ))}
              </div>

              {/* Title Input */}
              <input
                className="cm-write-fs-title-input"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Tiêu đề bài viết"
                maxLength={100}
              />

              {/* Divider */}
              <div className="cm-write-fs-divider" />

              {/* Content */}
              <textarea
                className="cm-write-fs-content"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Chia sẻ suy nghĩ, kinh nghiệm, hoặc câu hỏi của bạn với cộng đồng du học sinh..."
              />

              {/* Footer info */}
              <div className="cm-write-fs-footer">
                <div className="cm-write-fs-anon">
                  <User size={15} />
                  <span>Đăng ẩn danh</span>
                </div>
                <span className="cm-write-fs-count">{newContent.length}/2000</span>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ==================== DETAIL VIEW ====================
  if (view === 'detail' && selectedPost) {
    const cat = CATEGORIES[selectedPost.category as CommunityCategory];

    return (
      <div className="cm-detail-screen" ref={detailRef}>
        {/* Detail Header */}
        <header className="cm-detail-header">
          <button type="button" onClick={goBack} className="cm-icon-btn">
            <ArrowLeft size={22} />
          </button>
          <span className="cm-detail-cat">{cat?.label}</span>
          <button type="button" className="cm-icon-btn">
            <MoreHorizontal size={22} />
          </button>
        </header>

        {/* Detail Content */}
        <div className="cm-detail-body">
          <div className="cm-detail-meta">
            <span>{new Date(selectedPost.created_at).toLocaleDateString('vi-VN')} {new Date(selectedPost.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
            <span>|</span>
            <span><Eye size={13} /> {selectedPost.views_count}</span>
          </div>

          <h1 className="cm-detail-title">{selectedPost.title}</h1>

          <div className="cm-detail-content">
            {selectedPost.content.split('\n').map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>

          {/* Action Bar */}
          <div className="cm-action-bar">
            <button
              type="button"
              className={`cm-action-btn ${likedPosts.has(selectedPost.id) ? 'active' : ''}`}
              onClick={() => toggleLike(selectedPost.id)}
            >
              <ThumbsUp size={16} /> {selectedPost.likes_count}
            </button>
            <button
              type="button"
              className={`cm-action-btn ${dislikedPosts.has(selectedPost.id) ? 'active dislike' : ''}`}
              onClick={() => toggleDislike(selectedPost.id)}
            >
              <ThumbsDown size={16} /> {selectedPost.dislikes_count}
            </button>
            <button
              type="button"
              className={`cm-action-btn bookmark ${bookmarkedPosts.has(selectedPost.id) ? 'active' : ''}`}
              onClick={() => toggleBookmark(selectedPost.id)}
            >
              <Bookmark size={16} /> Lưu
            </button>
          </div>

          {/* Comments Section */}
          <div className="cm-comments-section">
            <div className="cm-comments-header">
              <strong>Bình luận {selectedPost.comments_count}</strong>
            </div>

            {rootComments.length === 0 ? (
              <p className="cm-no-comments">Chưa có bình luận nào. Hãy là người đầu tiên!</p>
            ) : (
              rootComments.map((comment) => {
                const replies = getReplies(comment.id);
                return (
                  <div key={comment.id} className="cm-comment-thread">
                    {/* Root comment */}
                    <div className="cm-comment">
                      <div className="cm-comment-head">
                        <strong className={comment.is_author ? 'cm-comment-author' : ''}>
                          {comment.display_name}
                        </strong>
                        <span className="cm-comment-time">{timeAgo(comment.created_at)}</span>
                      </div>
                      <p className="cm-comment-body">{comment.content}</p>
                      <div className="cm-comment-actions">
                        <button type="button" className="cm-reply-btn" onClick={() => {
                          setReplyTo(comment.id);
                          commentInputRef.current?.focus();
                        }}>
                          Trả lời
                        </button>
                        <button
                          type="button"
                          className={`cm-like-btn ${likedComments.has(comment.id) ? 'active' : ''}`}
                          onClick={() => toggleCommentLike(comment.id)}
                        >
                          <ThumbsUp size={13} /> {comment.likes_count}
                        </button>
                      </div>
                    </div>

                    {/* Replies */}
                    {replies.map((reply) => (
                      <div key={reply.id} className="cm-comment cm-reply">
                        <div className="cm-reply-indicator">↳</div>
                        <div className="cm-reply-body">
                          <div className="cm-comment-head">
                            <strong className={reply.is_author ? 'cm-comment-author' : ''}>
                              {reply.display_name}
                            </strong>
                            <span className="cm-comment-time">{timeAgo(reply.created_at)}</span>
                          </div>
                          <p className="cm-comment-body">{reply.content}</p>
                          <div className="cm-comment-actions">
                            <button type="button" className="cm-reply-btn" onClick={() => {
                              setReplyTo(comment.id);
                              commentInputRef.current?.focus();
                            }}>
                              Trả lời
                            </button>
                            <button
                              type="button"
                              className={`cm-like-btn ${likedComments.has(reply.id) ? 'active' : ''}`}
                              onClick={() => toggleCommentLike(reply.id)}
                            >
                              <ThumbsUp size={13} /> {reply.likes_count}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Comment Input */}
        <div className="cm-comment-input-bar">
          {replyTo && (
            <div className="cm-replying-to">
              <span>Đang trả lời bình luận</span>
              <button type="button" onClick={() => setReplyTo(null)}>
                <X size={14} />
              </button>
            </div>
          )}
          <div className="cm-comment-input-row">
            <input
              ref={commentInputRef}
              type="text"
              className="cm-comment-input"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Viết bình luận..."
              onKeyDown={(e) => { if (e.key === 'Enter') addComment(); }}
            />
            <button
              type="button"
              className="cm-send-btn"
              onClick={addComment}
              disabled={!newComment.trim()}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

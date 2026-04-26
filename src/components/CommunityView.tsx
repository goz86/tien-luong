import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Plus, Tag, User } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Post {
  id: string;
  author_id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
  author_name?: string;
}

export function CommunityView({ t }: { t: any }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '', category: 'Hỏi đáp' });

  useEffect(() => {
    fetchPosts();
  }, []);

  async function fetchPosts() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('community_posts')
      .select('*, profiles(display_name)')
      .order('created_at', { ascending: false });

    if (error) console.error(error);
    else {
      setPosts(data.map(p => ({
        ...p,
        author_name: p.profiles?.display_name || 'Người dùng'
      })));
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return alert('Vui lòng đăng nhập');

    const { error } = await supabase.from('community_posts').insert({
      ...newPost,
      author_id: session.user.id
    });

    if (error) alert(error.message);
    else {
      setShowForm(false);
      setNewPost({ title: '', content: '', category: 'Hỏi đáp' });
      fetchPosts();
    }
  }

  return (
    <section className="screen community-screen">
      <div className="section-heading">
        <div>
          <p>{t.community}</p>
          <h2>{t.appName} Space</h2>
        </div>
        <button className="icon-button" onClick={() => setShowForm(!showForm)}>
          <Plus size={22} />
        </button>
      </div>

      {showForm && (
        <motion.form 
          className="form-panel"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
        >
          <label>
            {t.postTitle}
            <input 
              value={newPost.title} 
              onChange={e => setNewPost({...newPost, title: e.target.value})} 
              required
            />
          </label>
          <label>
            {t.postCategory}
            <select 
              value={newPost.category} 
              onChange={e => setNewPost({...newPost, category: e.target.value})}
            >
              <option>Hỏi đáp</option>
              <option>Chia sẻ</option>
              <option>Cảnh báo</option>
              <option>Review</option>
            </select>
          </label>
          <label>
            {t.postContent}
            <textarea 
              value={newPost.content} 
              onChange={e => setNewPost({...newPost, content: e.target.value})}
              required
            />
          </label>
          <button className="primary-action" type="submit">{t.save}</button>
        </motion.form>
      )}

      <div className="feed-list">
        {loading ? (
          <p className="loading-text">Đang tải bài viết...</p>
        ) : posts.length === 0 ? (
          <div className="empty-state">
            <MessageSquare size={48} opacity={0.2} />
            <p>Chưa có bài viết nào. Hãy là người đầu tiên!</p>
          </div>
        ) : (
          posts.map((post) => (
            <motion.article 
              key={post.id} 
              className="bento-card post-card"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="post-header">
                <span className="post-category">
                  <Tag size={12} /> {post.category}
                </span>
                <span className="post-date">
                  {new Date(post.created_at).toLocaleDateString()}
                </span>
              </div>
              <h3>{post.title}</h3>
              <p>{post.content}</p>
              <div className="post-footer">
                <div className="post-author">
                  <User size={14} />
                  <span>{post.author_name}</span>
                </div>
              </div>
            </motion.article>
          ))
        )}
      </div>
    </section>
  );
}

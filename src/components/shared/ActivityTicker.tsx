import { useEffect, useRef, useState } from 'react';
import { Megaphone, MessageCircle, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type TickerItem = {
  type: 'post' | 'comment' | 'admin';
  text: string;
  author: string;
  postId?: string;
};

const ADMIN_MESSAGES: TickerItem[] = [
  { type: 'admin', author: 'Duhoc Mate', text: 'Chao mung ban den voi cong dong du hoc sinh Viet tai Han!' },
  { type: 'admin', author: 'Duhoc Mate', text: 'Hay chia se kinh nghiem lam them de giup do moi nguoi nhe!' },
  { type: 'admin', author: 'Duhoc Mate', text: 'Meo: ban co the theo doi thu nhap theo tung noi lam viec.' },
];

export function ActivityTicker({
  lang = 'vi',
  onOpenPost,
}: {
  lang?: 'vi' | 'ko';
  onOpenPost?: (postId: string) => void;
}) {
  const [items, setItems] = useState<TickerItem[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'in' | 'show' | 'out'>('in');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const load = async () => {
      const fetched: TickerItem[] = [];

      if (supabase) {
        const [{ data: posts }, { data: comments }] = await Promise.all([
          supabase
            .from('community_posts')
            .select('id, title, content, display_name, is_anonymous')
            .order('created_at', { ascending: false })
            .limit(12),
          supabase
            .from('community_comments')
            .select('post_id, content, display_name, is_anonymous')
            .order('created_at', { ascending: false })
            .limit(12),
        ]);

        (posts ?? []).forEach((post: any) => {
          const raw = post.title || post.content || '';
          const text = raw.replace(/\n/g, ' ').trim().slice(0, 60);
          if (!text) return;
          const author = post.is_anonymous ? (lang === 'ko' ? '익명' : 'Ẩn danh') : (post.display_name || '...');
          fetched.push({ type: 'post', text, author, postId: post.id });
        });

        (comments ?? []).forEach((comment: any) => {
          const text = (comment.content || '').replace(/\n/g, ' ').trim().slice(0, 60);
          if (!text || !comment.post_id) return;
          const author = comment.is_anonymous ? (lang === 'ko' ? '익명' : 'Ẩn danh') : (comment.display_name || '...');
          fetched.push({ type: 'comment', text, author, postId: comment.post_id });
        });
      }

      fetched.sort(() => Math.random() - 0.5);
      const merged: TickerItem[] = [];
      fetched.forEach((item, i) => {
        merged.push(item);
        if ((i + 1) % 4 === 0) merged.push(ADMIN_MESSAGES[Math.floor(Math.random() * ADMIN_MESSAGES.length)]);
      });
      if (merged.length === 0) merged.push(...ADMIN_MESSAGES);

      setItems(merged);
      setIndex(0);
    };

    void load();
  }, [lang]);

  useEffect(() => {
    if (items.length === 0) return;

    const run = () => {
      setPhase('in');
      timerRef.current = setTimeout(() => {
        setPhase('show');
        timerRef.current = setTimeout(() => {
          setPhase('out');
          timerRef.current = setTimeout(() => {
            setIndex((prev) => (prev + 1) % items.length);
          }, 350);
        }, 2200);
      }, 350);
    };

    run();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [index, items]);

  if (items.length === 0) return null;

  const item = items[index];
  const Icon =
    item.type === 'admin' ? Sparkles :
    item.type === 'comment' ? MessageCircle :
    Megaphone;
  const iconColor =
    item.type === 'admin' ? '#f59e0b' :
    item.type === 'comment' ? '#2752ff' :
    '#10b981';
  const canOpenPost = Boolean(item.postId && onOpenPost);
  const content = (
    <>
      <span className="ticker-icon" style={{ color: iconColor }}>
        <Icon size={11} strokeWidth={2.5} />
      </span>
      <span className="ticker-author">{item.author}</span>
      <span className="ticker-sep">·</span>
      <span className="ticker-text">{item.text}</span>
    </>
  );

  return (
    <div className="activity-ticker">
      {canOpenPost ? (
        <button
          type="button"
          className={`ticker-inner ticker-${phase} ticker-clickable`}
          onClick={() => onOpenPost?.(item.postId!)}
        >
          {content}
        </button>
      ) : (
        <div className={`ticker-inner ticker-${phase}`}>
          {content}
        </div>
      )}
    </div>
  );
}

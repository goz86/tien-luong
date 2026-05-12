import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Megaphone, MessageCircle, Sparkles } from 'lucide-react';

type TickerItem = {
  type: 'post' | 'comment' | 'admin';
  text: string;
  author: string;
};

const ADMIN_MESSAGES: TickerItem[] = [
  { type: 'admin', author: 'Duhoc Mate', text: '👋 Chào mừng bạn đến với cộng đồng du học sinh Việt tại Hàn!' },
  { type: 'admin', author: 'Duhoc Mate', text: '📢 Hãy chia sẻ kinh nghiệm làm thêm để giúp đỡ mọi người nhé!' },
  { type: 'admin', author: 'Duhoc Mate', text: '💡 Mẹo: Bạn có thể theo dõi thu nhập theo từng nơi làm việc.' },
];

export function ActivityTicker({ lang = 'vi' }: { lang?: 'vi' | 'ko' }) {
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
            .select('title, content, display_name, is_anonymous')
            .order('created_at', { ascending: false })
            .limit(12),
          supabase
            .from('community_comments')
            .select('content, display_name, is_anonymous')
            .order('created_at', { ascending: false })
            .limit(12),
        ]);

        (posts ?? []).forEach((p: any) => {
          const raw = p.title || p.content || '';
          const text = raw.replace(/\n/g, ' ').trim().slice(0, 60);
          if (!text) return;
          const author = p.is_anonymous ? (lang === 'ko' ? '익명' : 'Ẩn danh') : (p.display_name || '...');
          fetched.push({ type: 'post', text, author });
        });

        (comments ?? []).forEach((c: any) => {
          const text = (c.content || '').replace(/\n/g, ' ').trim().slice(0, 60);
          if (!text) return;
          const author = c.is_anonymous ? (lang === 'ko' ? '익명' : 'Ẩn danh') : (c.display_name || '...');
          fetched.push({ type: 'comment', text, author });
        });
      }

      // Shuffle + interleave admin messages
      fetched.sort(() => Math.random() - 0.5);
      const merged: TickerItem[] = [];
      fetched.forEach((item, i) => {
        merged.push(item);
        if ((i + 1) % 4 === 0) merged.push(ADMIN_MESSAGES[Math.floor(Math.random() * ADMIN_MESSAGES.length)]);
      });
      if (merged.length === 0) merged.push(...ADMIN_MESSAGES);

      setItems(merged);
    };
    load();
  }, [lang]);

  useEffect(() => {
    if (items.length === 0) return;

    const run = () => {
      // in → show (after 350ms)
      setPhase('in');
      timerRef.current = setTimeout(() => {
        setPhase('show');
        // show → out (after 2.2s)
        timerRef.current = setTimeout(() => {
          setPhase('out');
          // out → next item (after 350ms)
          timerRef.current = setTimeout(() => {
            setIndex((prev) => (prev + 1) % items.length);
          }, 350);
        }, 2200);
      }, 350);
    };

    run();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
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

  return (
    <div className="activity-ticker">
      <div className={`ticker-inner ticker-${phase}`}>
        <span className="ticker-icon" style={{ color: iconColor }}>
          <Icon size={11} strokeWidth={2.5} />
        </span>
        <span className="ticker-author">{item.author}</span>
        <span className="ticker-sep">·</span>
        <span className="ticker-text">{item.text}</span>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Send, ShoppingBag, MessageSquare, Users, Star, MapPin, Tag, ArrowRight } from 'lucide-react';
import { CompanionProfile } from '../lib/types';

type CommunityTab = 'friends' | 'market' | 'reviews' | 'groupbuy';

export function CommunityScreen({
  companions,
  requested,
  onRequest
}: {
  companions: CompanionProfile[];
  requested: string[];
  onRequest: (id: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<CommunityTab>('friends');

  const tabs: { id: CommunityTab; label: string; icon: any }[] = [
    { id: 'friends', label: 'Bạn bè', icon: Users },
    { id: 'market', label: 'Chợ cũ', icon: ShoppingBag },
    { id: 'reviews', label: 'Review', icon: MessageSquare },
    { id: 'groupbuy', label: 'Mua chung', icon: MapPin },
  ];

  return (
    <>
      <header className="appbar compact">
        <div>
          <p className="appbar-kicker">Hub cộng đồng</p>
          <h1 className="appbar-title">Duhoc Mate Community</h1>
        </div>
      </header>

      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '0 16px 20px', scrollbarWidth: 'none' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              flex: '0 0 auto',
              padding: '8px 16px',
              borderRadius: '12px',
              background: activeTab === t.id ? '#2752ff' : '#f1f5f9',
              color: activeTab === t.id ? 'white' : '#64748b',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 700,
              transition: 'all 0.2s'
            }}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="community-content" style={{ paddingBottom: '100px' }}>
        {activeTab === 'friends' && (
          <div className="card-list">
            {companions.map((companion, index) => {
              const sent = requested.includes(companion.id);
              return (
                <article key={companion.id} className={`friend-card color-${index % 3}`}>
                  <div className="friend-card-head">
                    <div className="avatar-badge">{companion.displayName.slice(0, 1)}</div>
                    <div className="workplace-copy">
                      <strong>{companion.displayName}</strong>
                      <span>{companion.school}</span>
                    </div>
                  </div>
                  <strong className="region-pill">{companion.region}</strong>
                  <p className="friend-focus">{companion.focus}</p>
                  <div className="tag-row">
                    {companion.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  <button type="button" className={sent ? 'friend-button sent' : 'friend-button'} onClick={() => onRequest(companion.id)}>
                    <Send size={16} />
                    {sent ? 'Đã gửi lời mời' : 'Kết nối'}
                  </button>
                </article>
              );
            })}
          </div>
        )}

        {activeTab === 'market' && (
          <div style={{ padding: '0 16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {[
                { title: 'Nồi cơm điện Cuckoo', price: '30,000₩', img: '🍚', user: 'Minh Anh' },
                { title: 'Bàn làm việc gỗ', price: '15,000₩', img: '🪑', user: 'Tuấn Trần' },
                { title: 'Quạt điện đứng', price: '10,000₩', img: '🌬️', user: 'Hoàng Nam' },
                { title: 'Đệm ngủ đơn', price: '20,000₩', img: '🛏️', user: 'Linh Chi' },
              ].map((item, i) => (
                <div key={i} style={{ background: 'white', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                  <div style={{ height: '100px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px' }}>{item.img}</div>
                  <div style={{ padding: '12px' }}>
                    <strong style={{ display: 'block', fontSize: '14px', marginBottom: '4px' }}>{item.title}</strong>
                    <span style={{ color: '#2752ff', fontWeight: 800, fontSize: '15px' }}>{item.price}</span>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>Người bán: {item.user}</div>
                  </div>
                </div>
              ))}
            </div>
            <button style={{ width: '100%', padding: '16px', borderRadius: '16px', background: '#f1f5f9', color: '#475569', border: 'none', fontWeight: 700, marginTop: '20px' }}>
              + Đăng món đồ mới
            </button>
          </div>
        )}

        {activeTab === 'reviews' && (
          <div style={{ padding: '0 16px' }}>
            {[
              { venue: 'Nhà hàng BBQ Gangnam', rating: 4, review: 'Chủ tốt, trả lương đúng hạn. Có bao ăn tối.', date: '2 ngày trước' },
              { venue: 'Xưởng đóng gói Incheon', rating: 2, review: 'Việc nặng, chủ hay la mắng. Lương đôi khi chậm 2-3 ngày.', date: '5 ngày trước' },
              { venue: 'Cafe Hollys Sinchon', rating: 5, review: 'Môi trường thân thiện, việc nhẹ nhàng cho bạn mới sang.', date: '1 tuần trước' },
            ].map((rev, i) => (
              <div key={i} style={{ background: 'white', padding: '16px', borderRadius: '20px', marginBottom: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong style={{ fontSize: '15px' }}>{rev.venue}</strong>
                  <div style={{ display: 'flex', color: '#f59e0b' }}>
                    {[...Array(rev.rating)].map((_, j) => <Star key={j} size={14} fill="currentColor" />)}
                  </div>
                </div>
                <p style={{ fontSize: '13px', color: '#475569', margin: '8px 0', lineHeight: '1.5' }}>"{rev.review}"</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>{rev.date}</span>
                  <span style={{ fontSize: '11px', color: '#2752ff', fontWeight: 700 }}>Ẩn danh</span>
                </div>
              </div>
            ))}
            <button style={{ width: '100%', padding: '16px', borderRadius: '16px', background: '#2752ff', color: 'white', border: 'none', fontWeight: 700, marginTop: '12px' }}>
              Viết đánh giá ẩn danh
            </button>
          </div>
        )}

        {activeTab === 'groupbuy' && (
          <div style={{ padding: '0 16px' }}>
            {[
              { item: 'Gạo tẻ 20kg', price: '45,000₩ (Gốc 55k)', left: '2 người nữa', region: 'Ansan' },
              { item: 'Trứng gà 30 quả', price: '6,000₩ (Gốc 8k)', left: '1 người nữa', region: 'Seoul (Dongdaemun)' },
            ].map((gb, i) => (
              <div key={i} style={{ background: 'white', padding: '16px', borderRadius: '20px', marginBottom: '12px', borderLeft: '4px solid #2752ff', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: '16px' }}>{gb.item}</strong>
                  <span style={{ fontSize: '12px', color: '#2752ff', fontWeight: 700 }}>{gb.region}</span>
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0d9b72', margin: '8px 0' }}>{gb.price}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: 700 }}>🔥 Đang cần: {gb.left}</div>
                  <button style={{ padding: '8px 16px', borderRadius: '8px', background: '#f1f5f9', color: '#08162b', border: 'none', fontWeight: 700, fontSize: '12px' }}>Tham gia</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

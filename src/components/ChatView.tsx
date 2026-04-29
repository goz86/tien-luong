import { useEffect, useRef, useState, useCallback } from 'react';
import { Send, ChevronLeft, User, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { CompanionProfile } from '../lib/types';
import { timeAgo } from '../data/communityData';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface ChatViewProps {
  session: Session;
  partner: CompanionProfile;
  onBack: () => void;
}

export function ChatView({ session, partner, onBack }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentUserId = session.user.id;

  const markAsRead = useCallback(async () => {
    if (!supabase || !currentUserId) return;
    await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('sender_id', partner.id)
      .eq('receiver_id', currentUserId)
      .eq('is_read', false);
  }, [currentUserId, partner.id]);

  const fetchMessages = useCallback(async () => {
    if (!supabase) return;
    
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${partner.id}),and(sender_id.eq.${partner.id},receiver_id.eq.${currentUserId})`)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data as Message[]);
      void markAsRead();
    }
    setLoading(false);
  }, [currentUserId, partner.id, markAsRead]);

  useEffect(() => {
    fetchMessages();

    if (!supabase) return;

    // Subscribe to new messages
    const channel = supabase
      .channel(`chat:${currentUserId}:${partner.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `receiver_id=eq.${currentUserId}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          if (msg.sender_id === partner.id) {
            setMessages((prev) => [...prev, msg]);
            void markAsRead();
          }
        }
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [currentUserId, partner.id, fetchMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !supabase || sending) return;

    setSending(true);
    const content = newMessage.trim();
    setNewMessage('');

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        sender_id: currentUserId,
        receiver_id: partner.id,
        content: content,
      })
      .select('*')
      .single();

    if (!error && data) {
      setMessages((prev) => [...prev, data as Message]);
    }
    setSending(false);
  }

  return (
    <div className="chat-view-container">
      <div className="chat-header">
        <button type="button" className="chat-back-btn" onClick={onBack}>
          <ChevronLeft size={24} />
        </button>
        <div className="chat-partner-info">
          <div className="chat-partner-avatar">
            {partner.displayName.substring(0, 1)}
          </div>
          <div>
            <h3>{partner.displayName}</h3>
            <span>{partner.school}</span>
          </div>
        </div>
      </div>

      <div className="chat-messages-list" ref={scrollRef}>
        {loading ? (
          <div className="chat-loading">
            <Loader2 className="animate-spin" size={24} />
            <p>Đang tải tin nhắn...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-empty-icon">
              <User size={32} />
            </div>
            <p>Bắt đầu cuộc trò chuyện với {partner.displayName}</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`chat-message-wrapper ${msg.sender_id === currentUserId ? 'own' : 'partner'}`}
            >
              <div className="chat-message-bubble">
                {msg.content}
                <span className="chat-message-time">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <form className="chat-input-bar" onSubmit={handleSendMessage}>
        <input
          type="text"
          placeholder="Nhập tin nhắn..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          disabled={sending}
        />
        <button type="submit" disabled={!newMessage.trim() || sending}>
          {sending ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
        </button>
      </form>
    </div>
  );
}

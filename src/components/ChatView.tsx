import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send, User, ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
}

export function ChatView({ 
  t, 
  friendId, 
  friendName, 
  onBack 
}: { 
  t: any, 
  friendId: string, 
  friendName: string, 
  onBack: () => void 
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase?.auth.getSession().then(({ data }) => setUserId(data.session?.user.id || null));
    fetchMessages();

    // Real-time subscription
    const channel = supabase
      ?.channel('chat_messages')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_messages' 
      }, (payload) => {
        const msg = payload.new as Message;
        if ((msg.sender_id === userId && msg.receiver_id === friendId) || 
            (msg.sender_id === friendId && msg.receiver_id === userId)) {
          setMessages(prev => [...prev, msg]);
        }
      })
      .subscribe();

    return () => {
      supabase?.removeChannel(channel!);
    };
  }, [friendId, userId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchMessages() {
    if (!supabase || !userId) return;
    const client = supabase;
    const { data, error } = await client
      .from('chat_messages')
      .select('*')
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`)
      .order('created_at', { ascending: true });

    if (error) console.error(error);
    else setMessages(data);
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !userId || !newMessage.trim()) return;
    const client = supabase;
    const { error } = await client.from('chat_messages').insert({
      sender_id: userId,
      receiver_id: friendId,
      content: newMessage.trim()
    });

    if (error) alert(error.message);
    else setNewMessage('');
  }

  return (
    <section className="chat-screen">
      <div className="chat-header">
        <button onClick={onBack} className="icon-button"><ChevronLeft size={20} /></button>
        <div className="chat-user-info">
          <div className="avatar small">{friendName.slice(0,1)}</div>
          <h3>{friendName}</h3>
        </div>
      </div>

      <div className="message-list">
        {messages.map((msg) => (
          <div key={msg.id} className={`message-item ${msg.sender_id === userId ? 'own' : ''}`}>
            <div className="message-bubble">{msg.content}</div>
            <span className="message-time">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      <form className="chat-input-area" onSubmit={sendMessage}>
        <input 
          placeholder="Viết tin nhắn..." 
          value={newMessage} 
          onChange={e => setNewMessage(e.target.value)}
        />
        <button type="submit" className="send-button"><Send size={20} /></button>
      </form>
    </section>
  );
}

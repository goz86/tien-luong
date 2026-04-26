import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Sparkles, ChevronLeft, ShieldAlert, Book } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: number;
}

export function AiAssistantView({ t, onBack }: { t: any, onBack: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Xin chào! Tôi là Mate AI. Tôi có thể giúp bạn giải đáp thắc mắc về Visa, Luật lao động và đời sống tại Hàn Quốc. Bạn cần giúp gì hôm nay?',
      created_at: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      created_at: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Simulation of AI Response (Will be replaced by Edge Function call)
    setTimeout(async () => {
      let aiResponse = "";
      const lowerInput = userMsg.content.toLowerCase();

      if (lowerInput.includes('visa')) {
        aiResponse = "Về vấn đề Visa, bạn nên chú ý gia hạn trước ít nhất 1 tháng. Đối với Visa D-2, bạn cần duy trì điểm số trên 2.0 để không gặp khó khăn khi gia hạn.";
      } else if (lowerInput.includes('lương') || lowerInput.includes('wage')) {
        aiResponse = "Mức lương tối thiểu tại Hàn Quốc năm 2026 đã được công bố. Bạn hãy kiểm tra mục Thống kê để xem thu nhập của mình có đạt chuẩn không nhé.";
      } else if (lowerInput.includes('luật') || lowerInput.includes('lao động')) {
        aiResponse = "Theo luật lao động Hàn Quốc, nếu bạn làm trên 15 giờ/tuần, bạn có quyền nhận Phụ cấp nghỉ tuần (Ju-hyu Sudang).";
      } else {
        aiResponse = "Câu hỏi của bạn rất thú vị. Tôi đang phân tích dữ liệu pháp lý... Bạn có muốn tôi tìm kiếm thêm thông tin chi tiết về mục này không?";
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse,
        created_at: Date.now()
      };

      setMessages(prev => [...prev, assistantMsg]);
      setLoading(false);
    }, 1500);
  }

  const suggestions = [
    { icon: <ShieldAlert size={14} />, text: 'Luật làm thêm' },
    { icon: <Book size={14} />, text: 'Gia hạn Visa D2' },
    { icon: <Sparkles size={14} />, text: 'Mẹo tiết kiệm' }
  ];

  return (
    <section className="ai-screen">
      <div className="ai-header">
        <button onClick={onBack} className="icon-button"><ChevronLeft size={20} /></button>
        <div className="ai-title">
          <div className="ai-avatar">
            <Sparkles size={20} color="#fff" />
          </div>
          <div>
            <h3>Mate AI</h3>
            <span className="status">Đang trực tuyến</span>
          </div>
        </div>
      </div>

      <div className="ai-messages">
        {messages.map((msg) => (
          <motion.div 
            key={msg.id} 
            className={`ai-message-wrapper ${msg.role}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="message-icon">
              {msg.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
            </div>
            <div className="message-content">
              {msg.content}
            </div>
          </motion.div>
        ))}
        {loading && (
          <div className="ai-message-wrapper assistant">
            <div className="message-icon"><Bot size={16} /></div>
            <div className="message-content loading">
              <span className="dot">.</span><span className="dot">.</span><span className="dot">.</span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      <div className="ai-footer">
        <div className="suggestions">
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => setInput(s.text)}>
              {s.icon} {s.text}
            </button>
          ))}
        </div>
        <form className="ai-input-area" onSubmit={handleSend}>
          <input 
            placeholder="Hỏi Mate AI về Visa, Luật..." 
            value={input} 
            onChange={e => setInput(e.target.value)}
          />
          <button type="submit" className="ai-send-btn" disabled={!input.trim() || loading}>
            <Send size={18} />
          </button>
        </form>
      </div>
    </section>
  );
}

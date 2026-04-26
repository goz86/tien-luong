import { motion } from 'framer-motion';
import { ShieldCheck, BookOpen, Scale, Landmark, ChevronRight, FileText } from 'lucide-react';

interface HandbookProps {
  t: any;
}

export function Handbook({ t }: HandbookProps) {
  const categories = [
    {
      id: 'visa',
      title: 'Visa & Thủ tục',
      icon: <ShieldCheck size={24} />,
      items: [
        'Đăng ký làm thêm (S-3)',
        'Gia hạn Visa D-2/D-4',
        'Chuyển đổi Visa E-7-4',
        'Đăng ký người nước ngoài (ARC)'
      ],
      color: 'var(--brand-primary)'
    },
    {
      id: 'legal',
      title: 'Pháp lý & Quyền lợi',
      icon: <Scale size={24} />,
      items: [
        'Quy định lương tối thiểu',
        'Bảo hiểm quốc dân',
        'Hợp đồng lao động tiêu chuẩn',
        'Quyền lợi khi bị nợ lương'
      ],
      color: 'var(--brand-secondary)'
    },
    {
      id: 'life',
      title: 'Đời sống Hàn Quốc',
      icon: <Landmark size={24} />,
      items: [
        'Cách đăng ký Sim trả sau',
        'Mở tài khoản ngân hàng',
        'Tìm nhà (One-room/Gosiwon)',
        'Ứng dụng rác & Phân loại'
      ],
      color: '#d97706'
    },
    {
      id: 'study',
      title: 'Học tập & TOPIK',
      icon: <BookOpen size={24} />,
      items: [
        'Lịch thi TOPIK 2026',
        'Học bổng chính phủ (GKS)',
        'Tài liệu ôn thi Topik',
        'Câu lạc bộ sinh viên Việt'
      ],
      color: '#8b5cf6'
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 }
  };

  return (
    <motion.section
      className="handbook-grid"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="section-heading">
        <div>
          <p>{t.handbookSubtitle || 'Cẩm nang du học sinh'}</p>
          <h2>{t.handbookTitle || 'Thông tin hữu ích'}</h2>
        </div>
        <FileText size={24} />
      </div>

      {categories.map((cat) => (
        <motion.div className="bento-card handbook-cat" key={cat.id} variants={itemVariants}>
          <div className="cat-header">
            <div className="cat-icon" style={{ backgroundColor: cat.color + '20', color: cat.color }}>
              {cat.icon}
            </div>
            <h3>{cat.title}</h3>
          </div>
          <div className="cat-items">
            {cat.items.map((item) => (
              <button className="handbook-item" key={item}>
                <span>{item}</span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        </motion.div>
      ))}
    </motion.section>
  );
}

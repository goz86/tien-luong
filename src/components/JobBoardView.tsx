import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, MapPin, DollarSign, Phone, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatKrw } from '../lib/salary';

interface Job {
  id: string;
  title: string;
  description: string;
  location: string;
  wage: number;
  job_type: string;
  contact_info: string;
  created_at: string;
}

export function JobBoardView({ t }: { t: any }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newJob, setNewJob] = useState({
    title: '',
    description: '',
    location: '',
    wage: 10000,
    job_type: 'Chạy bàn',
    contact_info: ''
  });

  useEffect(() => {
    fetchJobs();
  }, []);

  async function fetchJobs() {
    if (!supabase) return;
    const client = supabase;
    const { data, error } = await client
      .from('job_posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) console.error(error);
    else setJobs(data);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const client = supabase;

    const { data: { session } } = await client.auth.getSession();
    if (!session) return alert('Vui lòng đăng nhập');

    const { error } = await client.from('job_posts').insert({
      ...newJob,
      author_id: session.user.id
    });

    if (error) alert(error.message);
    else {
      setShowForm(false);
      setNewJob({
        title: '',
        description: '',
        location: '',
        wage: 10000,
        job_type: 'Chạy bàn',
        contact_info: ''
      });
      fetchJobs();
    }
  }

  return (
    <section className="screen job-screen">
      <div className="section-heading">
        <div>
          <p>{t.jobBoard}</p>
          <h2>Việc làm Part-time</h2>
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
            {t.jobTitle}
            <input 
              value={newJob.title} 
              onChange={e => setNewJob({...newJob, title: e.target.value})} 
              required
            />
          </label>
          <div className="two-col">
            <label>
              {t.jobType}
              <select 
                value={newJob.job_type} 
                onChange={e => setNewJob({...newJob, job_type: e.target.value})}
              >
                <option>Chạy bàn</option>
                <option>Xưởng</option>
                <option>Giao hàng</option>
                <option>Cửa hàng tiện lợi</option>
                <option>Khác</option>
              </select>
            </label>
            <label>
              {t.jobWage} (KRW)
              <input 
                type="number"
                value={newJob.wage} 
                onChange={e => setNewJob({...newJob, wage: Number(e.target.value)})} 
                required
              />
            </label>
          </div>
          <label>
            {t.jobLocation}
            <input 
              value={newJob.location} 
              onChange={e => setNewJob({...newJob, location: e.target.value})} 
              required
            />
          </label>
          <label>
            Thông tin liên hệ (SĐT/Kakao)
            <input 
              value={newJob.contact_info} 
              onChange={e => setNewJob({...newJob, contact_info: e.target.value})} 
              required
            />
          </label>
          <label>
            Mô tả chi tiết
            <textarea 
              value={newJob.description} 
              onChange={e => setNewJob({...newJob, description: e.target.value})}
              required
            />
          </label>
          <button className="primary-action" type="submit">{t.save}</button>
        </motion.form>
      )}

      <div className="job-list">
        {loading ? (
          <p className="loading-text">Đang tìm việc làm...</p>
        ) : jobs.length === 0 ? (
          <div className="empty-state">
            <Briefcase size={48} opacity={0.2} />
            <p>Hiện chưa có tin tuyển dụng nào.</p>
          </div>
        ) : (
          jobs.map((job) => (
            <motion.article 
              key={job.id} 
              className="bento-card job-card"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="job-badge">{job.job_type}</div>
              <h3>{job.title}</h3>
              
              <div className="job-info-grid">
                <div className="job-info-item">
                  <MapPin size={14} />
                  <span>{job.location}</span>
                </div>
                <div className="job-info-item">
                  <DollarSign size={14} />
                  <strong>{formatKrw(job.wage)}/h</strong>
                </div>
              </div>

              <p className="job-desc">{job.description}</p>
              
              <div className="job-footer">
                <div className="job-contact">
                  <Phone size={14} />
                  <span>{job.contact_info}</span>
                </div>
                <span className="job-date">{new Date(job.created_at).toLocaleDateString()}</span>
              </div>
            </motion.article>
          ))
        )}
      </div>
    </section>
  );
}

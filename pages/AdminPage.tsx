import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminQueue } from '../components/AdminQueue';
import { db } from '../services/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { generateSlug } from '../services/utils';

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const [migrating, setMigrating] = useState(false);

  const runSlugMigration = async () => {
    setMigrating(true);
    try {
      const snap = await getDocs(collection(db, 'projects'));
      let count = 0;
      for (const p of snap.docs) {
        const data = p.data();
        if (!data.slug) {
          const newSlug = generateSlug(data.title || 'Untitled');
          await updateDoc(doc(db, 'projects', p.id), { slug: newSlug });
          count++;
        }
      }
      alert(`Migration complete! Backfilled slugs for ${count} projects.`);
    } catch (err: any) {
      alert(`Migration failed: ${err.message}`);
      console.error(err);
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto">
      <div className="flex justify-end p-4">
        <button 
          onClick={runSlugMigration}
          disabled={migrating}
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {migrating ? 'Migrating...' : 'Run Slug Migration'}
        </button>
      </div>
      <AdminQueue
        onBack={() => navigate('/browse')}
        onProjectClick={(project) => navigate(`/project/${project.slug || project.id}`)}
      />
    </div>
  );
};

export default AdminPage;

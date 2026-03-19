import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminQueue } from '../components/AdminQueue';

const AdminPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-[1440px] mx-auto">
      <AdminQueue
        onBack={() => navigate('/browse')}
        onProjectClick={(project) => navigate(`/project/${project.id}`)}
      />
    </div>
  );
};

export default AdminPage;

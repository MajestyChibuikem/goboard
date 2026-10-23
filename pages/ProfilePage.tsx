import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfile } from '../components/UserProfile';

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate('/browse');
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto">
      <UserProfile
        onBack={handleBack}
        onProjectClick={(project) => navigate(`/project/${project.slug || project.id}`)}
      />
    </div>
  );
};

export default ProfilePage;

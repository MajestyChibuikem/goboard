import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfile } from '../components/UserProfile';

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-[1440px] mx-auto">
      <UserProfile
        onBack={() => navigate('/')}
        onProjectClick={(project) => navigate(`/project/${project.id}`)}
      />
    </div>
  );
};

export default ProfilePage;

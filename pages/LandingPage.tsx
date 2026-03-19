import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  PenTool,
  Compass,
  Heart,
  Shield,
  MousePointer,
  Lightbulb,
} from 'lucide-react';
import { AuthModal } from '../components/AuthModal';
import { useAuth } from '../contexts/AuthContext';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const sectionsRef = useRef<(HTMLDivElement | null)[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const pendingRedirect = useRef(false);

  // When user becomes authenticated after clicking Begin Journey, navigate to browse
  useEffect(() => {
    if (user && pendingRedirect.current) {
      pendingRedirect.current = false;
      setShowAuthModal(false);
      navigate('/browse');
    }
  }, [user, navigate]);

  const handleBeginJourney = () => {
    if (user) {
      navigate('/browse');
    } else {
      pendingRedirect.current = true;
      setShowAuthModal(true);
    }
  };

  useEffect(() => {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) loadingScreen.classList.add('hidden');
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('landed');
        });
      },
      { threshold: 0.12 }
    );
    sectionsRef.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const useCaseTabs = [
    {
      label: 'Discover Projects',
      title: 'Discover Projects',
      description: 'Browse a curated feed of student-built projects. Filter by category, sort by votes, and find your next inspiration.',
      image: '/discover.png',
    },
    {
      label: 'Submit & Share',
      title: 'Submit & Share',
      description: 'Showcase your work with a rich project page — title, description, tech stack, links, and screenshots.',
      image: '/submit-project.png',
    },
    {
      label: 'Track Progress',
      title: 'Track Progress',
      description: 'Post build updates, share milestones, and document your journey from idea to launch.',
      image: '/leave-updates.png',
    },
    {
      label: 'Vote & Engage',
      title: 'Vote & Engage',
      description: 'Upvote projects you love, leave comments, and climb the leaderboard with XP and ranks.',
      image: '/sign-in-google.png',
    },
  ];

  const benefits = [
    { icon: <Clock className="w-5 h-5" />, title: 'Ship Faster', description: 'Get feedback early, iterate quickly, and launch with confidence from peer support.' },
    { icon: <PenTool className="w-5 h-5" />, title: 'Build in Public', description: 'Document your journey — share updates, milestones, and learnings as you go.' },
    { icon: <Compass className="w-5 h-5" />, title: 'Find Direction', description: 'Explore what others are building for ideas, collaborators, and trending technologies.' },
    { icon: <Lightbulb className="w-5 h-5" />, title: 'Gain Recognition', description: 'Earn XP, climb ranks, and get your work seen by students and faculty.' },
    { icon: <Heart className="w-5 h-5" />, title: 'Community First', description: 'A supportive space for GoUni builders — vote, comment, and cheer each other on.' },
    { icon: <Shield className="w-5 h-5" />, title: 'Quality Assured', description: 'Every project is reviewed before going live — keeping the board high quality.' },
  ];

  return (
    <div className="min-h-screen font-sans overflow-x-hidden">

      {/* ═══════════════════════════════════════════
          SECTION 1 — HERO (dark, full-viewport, fixed bg)
      ═══════════════════════════════════════════ */}
      {/* Fixed background layer — stays in place while section 2 scrolls over */}
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]">
        <img
          src="/discover.png"
          alt=""
          className="w-full h-full object-cover object-top opacity-[0.15]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-[#0a0a0a]/60 to-[#0a0a0a]" />
      </div>

      <section className="relative z-10 min-h-screen text-white flex flex-col">
        {/* Nav */}
        <nav className="fixed top-0 inset-x-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img src="/logo-black.png" alt="GoBoard" className="w-8 h-8 rounded-lg bg-white object-contain p-0.5" />
              <span className="text-[15px] font-bold tracking-tight">GoBoard</span>
            </div>
            <button
              onClick={handleBeginJourney}
              className="px-5 py-2 text-sm font-medium bg-white text-[#0a0a0a] rounded-full hover:bg-neutral-200 transition-colors"
            >
              Begin Journey
            </button>
          </div>
        </nav>

        {/* Hero content — pushed down with extra top padding */}
        <div className="flex-1 relative flex flex-col items-center justify-end px-6 pb-32">
          {/* Spacer to push content below center */}
          <div className="flex-1 min-h-[35vh]" />

          {/* Text overlay */}
          <div className="relative z-10 text-center max-w-4xl mx-auto">
            <h1
              className="text-5xl sm:text-6xl md:text-[80px] font-light leading-[1.05] tracking-tight"
              style={{ fontStyle: 'italic' }}
            >
              <span className="text-neutral-500">Where thoughts</span>
              <br />
              <span className="text-neutral-500">become </span>
              <span className="text-white font-normal not-italic">actions.</span>
            </h1>

            <button
              onClick={handleBeginJourney}
              className="mt-12 px-8 py-3.5 text-[15px] font-medium bg-white text-[#0a0a0a] rounded-full hover:bg-neutral-200 transition-colors"
            >
              Begin Journey
            </button>
          </div>

          {/* Scroll indicator */}
          <div className="relative z-10 mt-16 flex flex-col items-center gap-2 text-neutral-500 text-xs">
            <MousePointer className="w-4 h-4 animate-bounce" />
            <span>Scroll to explore</span>
          </div>
        </div>
      </section>

      {/* Everything below hero scrolls OVER the fixed background */}
      <div className="relative z-10">

      {/* ═══════════════════════════════════════════
          SECTION 2 — FEATURES (dark, 3-card grid)
      ═══════════════════════════════════════════ */}
      <section className="bg-[#0a0a0a] text-white px-6 py-24">
        <div
          ref={(el) => { sectionsRef.current[0] = el; }}
          className="landing-section max-w-[1200px] mx-auto"
        >
          {/* Tag */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-sm text-neutral-400">Introducing GoBoard</span>
          </div>

          {/* Heading */}
          <h2 className="text-3xl sm:text-4xl md:text-[44px] leading-[1.15] tracking-tight mb-16 max-w-3xl">
            <span className="text-white font-semibold">Harness student creativity </span>
            <span className="text-neutral-500">to build faster, learn deeper, and ship projects.</span>
          </h2>

          {/* 3-card grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                image: '/discover.png',
                title: 'Discover Projects',
                description: 'Browse and filter student projects by category, votes, or newest — find what inspires you.',
              },
              {
                image: '/submit-project.png',
                title: 'Submit Your Work',
                description: 'Share your project with title, tech stack, links, and screenshots — get seen by the community.',
              },
              {
                image: '/leave-updates.png',
                title: 'Track the Journey',
                description: 'Post updates, share milestones, and document your build from idea to launch.',
              },
            ].map((card) => (
              <div key={card.title} className="group">
                {/* Card image */}
                <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-white/[0.03] mb-5">
                  <img
                    src={card.image}
                    alt={card.title}
                    className="w-full h-auto"
                    loading="lazy"
                  />
                </div>
                <h3 className="text-lg font-semibold mb-2">{card.title}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">{card.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 3 — USE CASES (light, tabbed)
      ═══════════════════════════════════════════ */}
      <section className="bg-white text-neutral-900 px-6 py-24">
        <div
          ref={(el) => { sectionsRef.current[1] = el; }}
          className="landing-section max-w-[1200px] mx-auto"
        >
          {/* Tag */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-neutral-400">Use cases</span>
          </div>

          {/* Heading */}
          <h2 className="text-3xl sm:text-4xl md:text-[44px] leading-[1.15] tracking-tight mb-14 max-w-3xl">
            <span className="text-neutral-400 font-light italic">Different paths to explore </span>
            <span className="text-neutral-900 font-semibold">all guided by one board.</span>
          </h2>

          {/* Tabs */}
          <div className="flex flex-wrap gap-1 border-b border-neutral-200 mb-12">
            {useCaseTabs.map((tab, i) => (
              <button
                key={tab.label}
                onClick={() => setActiveTab(i)}
                className={`px-5 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === i
                    ? 'text-neutral-900'
                    : 'text-neutral-400 hover:text-neutral-600'
                }`}
              >
                {tab.label}
                {activeTab === i && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900" />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex flex-col md:flex-row items-center gap-12">
            {/* Screenshot */}
            <div className="flex-1 w-full">
              <div className="rounded-2xl overflow-hidden border border-neutral-200 shadow-lg">
                <img
                  src={useCaseTabs[activeTab].image}
                  alt={useCaseTabs[activeTab].title}
                  className="w-full h-auto"
                />
              </div>
            </div>

            {/* Text */}
            <div className="flex-1 max-w-md">
              <h3 className="text-2xl font-semibold mb-4">{useCaseTabs[activeTab].title}</h3>
              <p className="text-neutral-500 text-lg leading-relaxed italic mb-8">
                {useCaseTabs[activeTab].description}
              </p>
              <button
                onClick={handleBeginJourney}
                className="px-6 py-3 text-sm font-medium border border-neutral-900 text-neutral-900 rounded-full hover:bg-neutral-900 hover:text-white transition-colors"
              >
                Get started
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 4 — HOW IT WORKS (light, steps)
      ═══════════════════════════════════════════ */}
      <section className="bg-[#fafafa] text-neutral-900 px-6 py-24">
        <div
          ref={(el) => { sectionsRef.current[2] = el; }}
          className="landing-section max-w-[1200px] mx-auto"
        >
          {/* Tag */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-neutral-400">How It Works</span>
          </div>

          {/* Heading */}
          <h2 className="text-3xl sm:text-4xl md:text-[44px] leading-[1.15] tracking-tight mb-16 max-w-3xl">
            <span className="text-neutral-400 font-light italic">One idea to begin,</span>
            <br />
            <span className="text-neutral-400 font-light italic">three steps to </span>
            <span className="text-neutral-900 font-semibold">launch.</span>
          </h2>

          <div className="flex flex-col md:flex-row gap-16 items-center">
            {/* Screenshot */}
            <div className="flex-1 w-full max-w-lg">
              <div className="rounded-2xl overflow-hidden border border-neutral-200 shadow-lg bg-white">
                <img
                  src="/submit-project.png"
                  alt="Submit project"
                  className="w-full h-auto"
                  loading="lazy"
                />
              </div>
            </div>

            {/* Steps */}
            <div className="flex-1 space-y-10">
              {[
                {
                  num: '1',
                  title: 'Submit',
                  description: 'Share your project — add a title, description, tech stack, and links. It takes less than a minute.',
                },
                {
                  num: '2',
                  title: 'Get Reviewed',
                  description: 'Admins review your submission to keep quality high. You\'ll be notified once it\'s approved.',
                },
                {
                  num: '3',
                  title: 'Launch & Grow',
                  description: 'Your project goes live. Collect votes, receive comments, post updates, and earn XP.',
                },
              ].map((step) => (
                <div key={step.num} className="flex gap-5">
                  <div className="w-10 h-10 rounded-full bg-neutral-900 text-white flex items-center justify-center text-sm font-semibold shrink-0">
                    {step.num}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-1 italic">{step.title}</h3>
                    <p className="text-neutral-500 leading-relaxed">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 5 — BENEFITS (light bg, dark cards)
      ═══════════════════════════════════════════ */}
      <section className="bg-white text-neutral-900 px-6 py-24">
        <div
          ref={(el) => { sectionsRef.current[3] = el; }}
          className="landing-section max-w-[1200px] mx-auto"
        >
          {/* Tag */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-neutral-400">Benefits</span>
          </div>

          {/* Heading */}
          <h2 className="text-3xl sm:text-4xl md:text-[44px] leading-[1.15] tracking-tight mb-16 max-w-3xl">
            <span className="text-neutral-400 font-light italic">A platform built for builders </span>
            <span className="text-neutral-900 font-semibold">delivering real value every day.</span>
          </h2>

          {/* 2x3 grid of dark cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {benefits.map((b) => (
              <div
                key={b.title}
                className="bg-[#141414] text-white rounded-2xl p-7 flex flex-col gap-4"
              >
                <div className="w-10 h-10 rounded-full border border-white/[0.12] flex items-center justify-center text-neutral-400">
                  {b.icon}
                </div>
                <h3 className="text-[15px] font-semibold">{b.title}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">{b.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 6 — CTA + PROJECT PREVIEW (split)
      ═══════════════════════════════════════════ */}
      <section className="flex flex-col md:flex-row min-h-[500px]">
        {/* Left — dark CTA */}
        <div className="flex-1 bg-[#0a0a0a] text-white px-10 md:px-16 py-20 flex flex-col justify-end">
          <div
            ref={(el) => { sectionsRef.current[4] = el; }}
            className="landing-section max-w-lg"
          >
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <img src="/logo-black.png" alt="" className="w-4 h-4 invert opacity-50" />
            </div>
            <p className="text-2xl sm:text-3xl leading-snug mb-10">
              <span className="text-neutral-500 italic">Experience GoBoard right now. </span>
              <span className="text-white">Just dive in and see what students are building.</span>
            </p>
            <button
              onClick={handleBeginJourney}
              className="px-8 py-3.5 text-[15px] font-medium bg-white text-[#0a0a0a] rounded-full hover:bg-neutral-200 transition-colors"
            >
              Try It Now
            </button>
          </div>
        </div>

        {/* Right — project preview screenshot */}
        <div className="flex-1 bg-white overflow-hidden flex items-end justify-center">
          <img
            src="/leave-updates.png"
            alt="Project detail preview"
            className="w-full max-w-lg h-auto"
            loading="lazy"
          />
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-white border-t border-neutral-200 px-6 py-8">
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/logo-black.png" alt="GoBoard" className="w-7 h-7 rounded-md object-contain" />
            <span className="text-sm font-semibold text-neutral-900">GoBoard</span>
          </div>
          <p className="text-sm text-neutral-400">
            &copy; {new Date().getFullYear()} GoBoard. Built for GoUni students.
          </p>
        </div>
      </footer>

      </div>{/* end relative z-10 wrapper */}

      {/* ── Scroll animation styles ── */}
      <style>{`
        .landing-section {
          opacity: 0;
          transform: translateY(40px);
          transition: opacity 0.7s ease-out, transform 0.7s ease-out;
        }
        .landing-section.landed {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}
    </div>
  );
};

export default LandingPage;

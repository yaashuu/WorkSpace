import React, { useState } from 'react';
import {
  Layers,
  ArrowRight,
  FolderKanban,
  Kanban,
  CheckCircle2,
  MessageSquare,
  Bell,
  Lock,
  ChevronDown,
  ChevronUp,
  Users,
  Eye,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useRouter } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';

export const LandingPage: React.FC = () => {
  const { navigate } = useRouter();
  const { isAuthenticated } = useAuth();

  // Interactive Product Preview Tab State
  const [activePreviewTab, setActivePreviewTab] = useState<'KANBAN' | 'DASHBOARD' | 'CHAT'>('KANBAN');

  // FAQ Accordion State
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const faqItems = [
    {
      q: 'What is WorkSpace?',
      a: 'WorkSpace is a team project management application that brings together task tracking, project organization, and team communication in one simple workspace. It helps teams plan projects, visualize workflows with easy-to-use task boards, and collaborate without juggling multiple apps.',
    },
    {
      q: 'Who can use WorkSpace?',
      a: 'WorkSpace is built for teams of all kinds — from engineering and design teams to marketing, operations, and cross-functional project groups. Any team that needs to organize projects, assign responsibilities, and track progress can use WorkSpace.',
    },
    {
      q: 'How do I create a project?',
      a: 'Organization administrators can create new projects with a single click. When creating a project, the administrator names it, sets a short project key, decides whether it should be private or public, and assigns a primary project manager to lead it.',
    },
    {
      q: 'What is the difference between an administrator, project manager and team member?',
      a: 'An Administrator oversees the entire organization, creates projects, and designates project managers. A Project Manager leads a specific project, invites members, manages tasks, and guides the workflow. Team Members join projects to work on their assigned tasks, update their progress, and collaborate in project discussions.',
    },
    {
      q: 'How can I invite people to my project?',
      a: 'Project managers and administrators can generate an invitation link directly from the project page. You can create a general link for any team member, or specify an email address to ensure only that person can join.',
    },
    {
      q: 'Can I manage multiple projects?',
      a: 'Yes. WorkSpace allows you to organize and participate in multiple projects at once. You can easily switch between different project boards, view your personal tasks across all workstreams, and stay organized.',
    },
    {
      q: 'Can I track task progress?',
      a: 'Absolutely. Every project includes a visual task board with five straightforward stages: Backlog, To Do, In Progress, Testing, and Done. You can easily drag and drop tasks as work moves forward, assign due dates, and set priority levels from Low to Urgent.',
    },
    {
      q: 'Can I communicate with my teammates?',
      a: 'Yes. Every project includes its own built-in group chat channel for team discussions. You can also comment directly on individual tasks, and administrators and project managers have a private direct messaging channel for sensitive coordination.',
    },
    {
      q: 'What is the difference between public and private projects?',
      a: 'Private projects are only visible to invited members. Public projects can be discovered by anyone in your organization, allowing teammates to view project overview details and request to join the project team.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-primary-100 selection:text-primary-700">
      {/* 1. Sticky Navigation Header */}
      <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-slate-200/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-indigo-600 flex items-center justify-center text-white shadow-md shadow-primary/25 transition-transform group-hover:scale-105">
              <Layers className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-tight text-slate-900">
                WorkSpace
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary-100 text-primary-700">
                SaaS
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-slate-600">
            <button
              onClick={() => scrollToSection('features')}
              className="hover:text-primary transition-colors cursor-pointer"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="hover:text-primary transition-colors cursor-pointer"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection('preview')}
              className="hover:text-primary transition-colors cursor-pointer"
            >
              Product Preview
            </button>
            <button
              onClick={() => scrollToSection('about')}
              className="hover:text-primary transition-colors cursor-pointer"
            >
              About
            </button>
            <button
              onClick={() => scrollToSection('faq')}
              className="hover:text-primary transition-colors cursor-pointer"
            >
              FAQ
            </button>
          </nav>

          {/* Auth CTA Actions */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/dashboard')}
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/login')}
                  className="text-xs font-semibold text-slate-700 hover:text-slate-900"
                >
                  Log in
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/register')}
                  rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                  className="shadow-sm shadow-primary/20 text-xs font-semibold"
                >
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative pt-12 pb-20 sm:pt-16 sm:pb-28 overflow-hidden">
        {/* Subtle Decorative Ambient Background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[500px] bg-gradient-to-b from-primary-50/70 via-indigo-50/30 to-transparent pointer-events-none rounded-b-[100px] -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Trust Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-primary-200/80 shadow-xs text-xs font-semibold text-primary mb-6 animate-fade-in">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Simple, connected project management for teams</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight max-w-4xl mx-auto leading-[1.14]">
            Bring your team&apos;s work together in one place.
          </h1>

          {/* Supporting Description */}
          <p className="mt-5 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Plan projects, organize tasks, collaborate with your team and keep every project moving forward &mdash; all from one simple workspace.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate(isAuthenticated ? '/dashboard' : '/register')}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="px-6 shadow-md shadow-primary/25 font-semibold text-sm"
            >
              {isAuthenticated ? 'Open Dashboard' : 'Get Started'}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => scrollToSection('features')}
              className="px-6 font-semibold text-sm bg-white hover:bg-slate-50 border-slate-300"
            >
              Explore Features
            </Button>
          </div>

          {/* Real Preview Banner Anchor */}
          <div className="mt-12 sm:mt-16 max-w-5xl mx-auto rounded-2xl bg-white border border-slate-200/90 shadow-elevated p-2 sm:p-3 transition-all">
            <div className="rounded-xl overflow-hidden border border-slate-200/80 bg-slate-900 text-left">
              {/* Window Header */}
              <div className="px-4 py-3 bg-slate-800/90 border-b border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 text-xs font-medium text-slate-300">
                    Website Redesign &amp; Brand Launch &mdash; Task Board
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-800/50">
                    Live Updates
                  </span>
                </div>
              </div>

              {/* Realistic Hero Kanban Snapshot */}
              <div className="p-4 sm:p-6 bg-slate-950 font-sans">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-primary text-white">
                      WEB
                    </span>
                    <h3 className="text-sm font-bold text-white">Website Redesign &amp; Brand Launch</h3>
                    <Badge variant="primary" size="sm">
                      ACTIVE PROJECT
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Private Project</span>
                    </span>
                    <span>&bull;</span>
                    <span>Manager: Sarah Chen</span>
                  </div>
                </div>

                {/* 5 Column Workflow Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 overflow-x-auto text-xs">
                  {/* Column 1: Backlog */}
                  <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800/80 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                      <span className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                        Backlog
                      </span>
                      <span className="text-[10px] font-bold bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded">
                        1
                      </span>
                    </div>
                    <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-slate-700 text-slate-300">
                        LOW PRIORITY
                      </span>
                      <p className="font-medium text-slate-200 mt-1.5 leading-snug">
                        Gather customer survey responses
                      </p>
                      <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
                        <span>Assigned: Alex R.</span>
                        <span>Due next week</span>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: To Do */}
                  <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800/80 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                      <span className="font-bold text-blue-400 uppercase tracking-wider text-[10px]">
                        To Do
                      </span>
                      <span className="text-[10px] font-bold bg-blue-950/60 text-blue-300 px-1.5 py-0.2 rounded border border-blue-900/40">
                        1
                      </span>
                    </div>
                    <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-900/40 text-amber-300 border border-amber-800/50">
                        MEDIUM PRIORITY
                      </span>
                      <p className="font-medium text-slate-200 mt-1.5 leading-snug">
                        Draft updated product overview copy
                      </p>
                      <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
                        <span>Assigned: Marcus V.</span>
                        <span>Due Friday</span>
                      </div>
                    </div>
                  </div>

                  {/* Column 3: In Progress */}
                  <div className="bg-slate-900/90 rounded-xl p-3 border border-primary-900/60 bg-gradient-to-b from-primary-950/30 to-slate-900/90 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between pb-1 border-b border-primary-900/50">
                      <span className="font-bold text-primary-300 uppercase tracking-wider text-[10px]">
                        In Progress
                      </span>
                      <span className="text-[10px] font-bold bg-primary-900/60 text-primary-200 px-1.5 py-0.2 rounded border border-primary-800/50">
                        1
                      </span>
                    </div>
                    <div className="bg-slate-800/90 p-2.5 rounded-lg border border-primary-700/50 shadow-sm">
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-red-900/40 text-red-300 border border-red-800/50">
                        HIGH PRIORITY
                      </span>
                      <p className="font-medium text-slate-100 mt-1.5 leading-snug">
                        Design new homepage desktop layout
                      </p>
                      <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
                        <span className="text-primary-300 font-semibold">Assigned: Sarah C.</span>
                        <span className="text-emerald-400">In Review</span>
                      </div>
                    </div>
                  </div>

                  {/* Column 4: Testing */}
                  <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800/80 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                      <span className="font-bold text-amber-400 uppercase tracking-wider text-[10px]">
                        Testing
                      </span>
                      <span className="text-[10px] font-bold bg-amber-950/60 text-amber-300 px-1.5 py-0.2 rounded border border-amber-900/40">
                        1
                      </span>
                    </div>
                    <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-900/40 text-amber-300 border border-amber-800/50">
                        MEDIUM PRIORITY
                      </span>
                      <p className="font-medium text-slate-200 mt-1.5 leading-snug">
                        Review navigation menus across screen sizes
                      </p>
                      <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
                        <span>Assigned: Elena T.</span>
                        <span>Pending QA</span>
                      </div>
                    </div>
                  </div>

                  {/* Column 5: Done */}
                  <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800/80 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                      <span className="font-bold text-emerald-400 uppercase tracking-wider text-[10px]">
                        Done
                      </span>
                      <span className="text-[10px] font-bold bg-emerald-950/60 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-900/40">
                        1
                      </span>
                    </div>
                    <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60 opacity-80">
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-emerald-900/40 text-emerald-300 border border-emerald-800/50">
                        COMPLETED
                      </span>
                      <p className="font-medium text-slate-300 mt-1.5 leading-snug line-through">
                        Create brand color palette guide
                      </p>
                      <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
                        <span>Completed by David K.</span>
                        <span className="text-emerald-400">&check; Approved</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Features Section (Rewritten in Everyday Language) */}
      <section id="features" className="py-20 bg-white border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-primary bg-primary-50 px-3 py-1 rounded-full border border-primary-200/80">
              Key Features
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-4">
              Everything your team needs to deliver great work.
            </h2>
            <p className="text-sm sm:text-base text-slate-500 mt-3 leading-relaxed">
              Clear, simple tools designed to help teams stay aligned, meet deadlines, and accomplish more together.
            </p>
          </div>

          {/* 6 Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Feature 1: Manage All Your Projects */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-6 sm:p-7 hover:border-primary-300 hover:shadow-card transition-all flex flex-col justify-between group">
              <div>
                <div className="w-11 h-11 rounded-xl bg-primary-100 text-primary flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                  <FolderKanban className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight mb-2">
                  1. Manage All Your Projects
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Keep different projects organized in one central hub. Easily view project details, updates, and progress without switching between tools.
                </p>
              </div>
              <div className="mt-5 pt-4 border-t border-slate-200/70 text-xs font-semibold text-primary flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Centralized Workspaces</span>
              </div>
            </div>

            {/* Feature 2: Bring Your Team Together */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-6 sm:p-7 hover:border-primary-300 hover:shadow-card transition-all flex flex-col justify-between group">
              <div>
                <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight mb-2">
                  2. Bring Your Team Together
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Organize team members around specific projects and give everyone clear roles so people always know who is responsible for what.
                </p>
              </div>
              <div className="mt-5 pt-4 border-t border-slate-200/70 text-xs font-semibold text-primary flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Clear Team Roles</span>
              </div>
            </div>

            {/* Feature 3: Keep Work Moving */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-6 sm:p-7 hover:border-primary-300 hover:shadow-card transition-all flex flex-col justify-between group">
              <div>
                <div className="w-11 h-11 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                  <Kanban className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight mb-2">
                  3. Keep Work Moving
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Visualize tasks across Backlog, To Do, In Progress, Testing, and Done. Spot bottlenecks early and easily understand what needs attention.
                </p>
              </div>
              <div className="mt-5 pt-4 border-t border-slate-200/70 text-xs font-semibold text-primary flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Visual Task Boards</span>
              </div>
            </div>

            {/* Feature 4: Stay on Top of Tasks */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-6 sm:p-7 hover:border-primary-300 hover:shadow-card transition-all flex flex-col justify-between group">
              <div>
                <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight mb-2">
                  4. Stay on Top of Tasks
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Assign work to team members, set clear priorities, and track due dates so essential deliverables are completed on schedule.
                </p>
              </div>
              <div className="mt-5 pt-4 border-t border-slate-200/70 text-xs font-semibold text-primary flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Priorities &amp; Due Dates</span>
              </div>
            </div>

            {/* Feature 5: Collaborate Without Switching Tools */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-6 sm:p-7 hover:border-primary-300 hover:shadow-card transition-all flex flex-col justify-between group">
              <div>
                <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight mb-2">
                  5. Collaborate Without Switching Tools
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Discuss work directly with project members. Keep conversations connected to projects, with dedicated private communication between administrators and managers.
                </p>
              </div>
              <div className="mt-5 pt-4 border-t border-slate-200/70 text-xs font-semibold text-primary flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Connected Team Discussions</span>
              </div>
            </div>

            {/* Feature 6: Never Miss Important Updates */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-6 sm:p-7 hover:border-primary-300 hover:shadow-card transition-all flex flex-col justify-between group">
              <div>
                <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                  <Bell className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight mb-2">
                  6. Never Miss Important Updates
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Receive instant notifications when tasks are assigned to you or when project statuses change. Stay completely informed about important progress.
                </p>
              </div>
              <div className="mt-5 pt-4 border-t border-slate-200/70 text-xs font-semibold text-primary flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Helpful Alerts &amp; Activity Feeds</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. How It Works Section (User-Focused Workflow) */}
      <section id="how-it-works" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-primary bg-primary-50 px-3 py-1 rounded-full border border-primary-200/80">
              How It Works
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-4">
              A straightforward path from kickoff to completion.
            </h2>
            <p className="text-sm sm:text-base text-slate-500 mt-3 leading-relaxed">
              WorkSpace makes it simple for teams to organize projects, share responsibilities, and get work done together.
            </p>
          </div>

          {/* Workflow Steps Horizontal Progression */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Step 1: Create Your Project */}
            <div className="bg-white rounded-2xl p-7 border border-slate-200/80 shadow-xs relative flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white font-bold flex items-center justify-center mb-5 text-sm shadow-sm shadow-purple-600/30">
                  01
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                    Administrator
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight mb-2">
                  Create Your Project
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Administrators create new projects, set project details, and choose a project manager to lead the initiative based on your team&apos;s requirements.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
                Step 1: Set up the workspace
              </div>
            </div>

            {/* Step 2: Build Your Team */}
            <div className="bg-white rounded-2xl p-7 border border-slate-200/80 shadow-xs relative flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center mb-5 text-sm shadow-sm shadow-indigo-600/30">
                  02
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    Project Manager
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight mb-2">
                  Build Your Team
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Project managers invite team members with a shareable link, review requests to join, organize tasks on the board, and assign responsibilities.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
                Step 2: Plan and assign work
              </div>
            </div>

            {/* Step 3: Get Work Done Together */}
            <div className="bg-white rounded-2xl p-7 border border-slate-200/80 shadow-xs relative flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center mb-5 text-sm shadow-sm shadow-emerald-600/30">
                  03
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Team Member
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight mb-2">
                  Get Work Done Together
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Team members work on assigned tasks, drag cards forward as progress is made, discuss details in comments, and stay connected with teammates.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
                Step 3: Collaborate and deliver
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Product Preview Section (User-Friendly Labels & Real Product Scenarios) */}
      <section id="preview" className="py-20 bg-white border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-widest text-primary bg-primary-50 px-3 py-1 rounded-full border border-primary-200/80">
              Product Preview
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-4">
              Explore how your team will work.
            </h2>
            <p className="text-sm sm:text-base text-slate-500 mt-3 leading-relaxed">
              Switch between views to see how WorkSpace helps teams manage tasks, view project summaries, and communicate.
            </p>
          </div>

          {/* View Mode Switcher Pills */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200/80">
              <button
                onClick={() => setActivePreviewTab('KANBAN')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activePreviewTab === 'KANBAN'
                    ? 'bg-white text-primary shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Task Board
              </button>
              <button
                onClick={() => setActivePreviewTab('DASHBOARD')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activePreviewTab === 'DASHBOARD'
                    ? 'bg-white text-primary shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Project Dashboard
              </button>
              <button
                onClick={() => setActivePreviewTab('CHAT')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activePreviewTab === 'CHAT'
                    ? 'bg-white text-primary shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Team Conversation
              </button>
            </div>
          </div>

          {/* Interactive Preview Container */}
          <div className="bg-canvas border border-slate-200 rounded-2xl p-5 sm:p-7 shadow-elevated">
            {activePreviewTab === 'KANBAN' && (
              <div className="space-y-4 animate-fade-in">
                {/* Board Bar */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-primary text-white">
                      GROWTH
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Q4 Customer Onboarding &amp; Expansion
                      </h4>
                      <span className="text-[11px] text-slate-500">
                        Project Manager: Sarah Chen &bull; 5 active tasks
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="primary" size="sm">
                      ACTIVE SPRINT
                    </Badge>
                  </div>
                </div>

                {/* 5 Kanban Columns */}
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                  {/* Backlog */}
                  <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-xs space-y-2.5">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-700">Backlog</span>
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">
                        1
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-xs space-y-2">
                      <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-slate-200 text-slate-700">
                        LOW PRIORITY
                      </span>
                      <h5 className="font-semibold text-slate-800 leading-tight">
                        Prepare onboarding checklist for new clients
                      </h5>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                        <span>Assigned: Sarah C.</span>
                        <span>Due in 2 weeks</span>
                      </div>
                    </div>
                  </div>

                  {/* To Do */}
                  <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-xs space-y-2.5">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="text-xs font-bold text-blue-600">To Do</span>
                      <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.2 rounded">
                        1
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-xs space-y-2">
                      <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-amber-100 text-amber-700">
                        MEDIUM PRIORITY
                      </span>
                      <h5 className="font-semibold text-slate-800 leading-tight">
                        Draft welcome email sequence for team
                      </h5>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                        <span>Assigned: Alex R.</span>
                        <span>Due Friday</span>
                      </div>
                    </div>
                  </div>

                  {/* In Progress */}
                  <div className="bg-white rounded-xl p-3 border border-primary-200 shadow-xs space-y-2.5">
                    <div className="flex items-center justify-between pb-2 border-b border-primary-100">
                      <span className="text-xs font-bold text-primary">In Progress</span>
                      <span className="text-[10px] font-bold bg-primary-100 text-primary px-1.5 py-0.2 rounded">
                        1
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-primary-50/50 border border-primary-200 text-xs space-y-2 shadow-xs">
                      <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-red-100 text-red-700">
                        URGENT
                      </span>
                      <h5 className="font-semibold text-slate-900 leading-tight">
                        Review customer feedback responses
                      </h5>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                        <span className="text-primary font-bold">Assigned to You</span>
                        <span>Due tomorrow</span>
                      </div>
                    </div>
                  </div>

                  {/* Testing */}
                  <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-xs space-y-2.5">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="text-xs font-bold text-amber-600">Testing</span>
                      <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-1.5 py-0.2 rounded">
                        1
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-xs space-y-2">
                      <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-amber-100 text-amber-700">
                        MEDIUM PRIORITY
                      </span>
                      <h5 className="font-semibold text-slate-800 leading-tight">
                        Verify client portal sign-in flow
                      </h5>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                        <span>Assigned: Marcus V.</span>
                        <span>In Review</span>
                      </div>
                    </div>
                  </div>

                  {/* Done */}
                  <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-xs space-y-2.5">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="text-xs font-bold text-emerald-600">Done</span>
                      <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-1.5 py-0.2 rounded">
                        1
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-xs space-y-2 opacity-80">
                      <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-emerald-100 text-emerald-700">
                        COMPLETED
                      </span>
                      <h5 className="font-semibold text-slate-700 leading-tight line-through">
                        Publish user guide documentation
                      </h5>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                        <span>Elena T.</span>
                        <span className="text-emerald-600 font-semibold">&check; Done</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activePreviewTab === 'DASHBOARD' && (
              <div className="space-y-4 animate-fade-in">
                {/* Sprint Summary Bar */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-primary bg-primary-50 px-2 py-0.5 rounded-full border border-primary-200">
                      Active Sprint
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-1">
                      Team Sprint Summary &amp; Progress
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-semibold">
                      18 Total Tasks Across Active Workstreams
                    </span>
                  </div>
                </div>

                {/* Status Segmented Bar */}
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex mb-3">
                    <div className="bg-slate-400 h-full w-[15%]" title="Backlog" />
                    <div className="bg-blue-500 h-full w-[25%]" title="To Do" />
                    <div className="bg-primary h-full w-[30%]" title="In Progress" />
                    <div className="bg-amber-500 h-full w-[15%]" title="Testing" />
                    <div className="bg-emerald-500 h-full w-[15%]" title="Done" />
                  </div>
                  <div className="grid grid-cols-5 gap-2 text-center text-xs">
                    <div className="p-2 rounded bg-slate-50 font-medium">
                      Backlog: <span className="font-bold">3</span>
                    </div>
                    <div className="p-2 rounded bg-slate-50 font-medium">
                      To Do: <span className="font-bold">5</span>
                    </div>
                    <div className="p-2 rounded bg-primary-50 text-primary font-bold">
                      In Progress: 6
                    </div>
                    <div className="p-2 rounded bg-slate-50 font-medium">
                      Testing: <span className="font-bold">2</span>
                    </div>
                    <div className="p-2 rounded bg-slate-50 font-medium">
                      Done: <span className="font-bold">2</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activePreviewTab === 'CHAT' && (
              <div className="space-y-4 animate-fade-in">
                {/* Chat Mock Interface */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-80">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold text-slate-800">
                        #customer-onboarding &bull; Project Team Chat
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      4 team members in channel
                    </span>
                  </div>

                  <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 text-[10px]">
                        SC
                      </div>
                      <div className="bg-slate-100 p-2.5 rounded-xl rounded-tl-none max-w-md">
                        <span className="font-bold text-slate-900 block text-[11px]">
                          Sarah Chen (Project Manager)
                        </span>
                        <p className="text-slate-700 mt-0.5 leading-snug">
                          Welcome everyone! I&apos;ve added the latest client onboarding tasks to our project board.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 justify-end">
                      <div className="bg-primary text-white p-2.5 rounded-xl rounded-tr-none max-w-md">
                        <span className="font-bold text-primary-100 block text-[11px]">You</span>
                        <p className="mt-0.5 leading-snug">
                          Thanks Sarah! I&apos;ve started reviewing customer feedback and will share notes today.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0 text-[10px]">
                        AR
                      </div>
                      <div className="bg-slate-100 p-2.5 rounded-xl rounded-tl-none max-w-md">
                        <span className="font-bold text-slate-900 block text-[11px]">
                          Alex Rivera
                        </span>
                        <p className="text-slate-700 mt-0.5 leading-snug">
                          Great, I&apos;m drafting the welcome email sequence now and will move the card to Testing soon.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center gap-2">
                    <input
                      type="text"
                      disabled
                      placeholder="Type a message to your team..."
                      className="flex-1 text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-400"
                    />
                    <Button variant="primary" size="sm" disabled>
                      Send
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 6. Product Benefits Section (User-Focused Value) */}
      <section id="about" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-primary bg-primary-50 px-3 py-1 rounded-full border border-primary-200/80">
              Why Teams Choose WorkSpace
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-4">
              Everything your team needs to stay organized.
            </h2>
            <p className="text-sm sm:text-base text-slate-500 mt-3 leading-relaxed">
              Designed to remove friction, eliminate confusion, and help your team do their best work every day.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary flex items-center justify-center mb-4">
                  <Eye className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1.5">
                  Clear Project Visibility
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Know exactly what is happening across all your projects in real time. No more guessing statuses or searching through scattered spreadsheets.
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                  <Users className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1.5">
                  Organized Teamwork
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Everyone understands their responsibilities with clearly defined project roles and assigned task ownership from start to finish.
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1.5">
                  Smooth Collaboration
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Keep conversations and project work connected in one place so decisions, context, and feedback are always easy to find.
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1.5">
                  Progress at a Glance
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Quickly see what is completed, what is currently underway, and what needs immediate attention to keep deadlines on track.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FAQ Section (Customer-Friendly Questions & Answers) */}
      <section id="faq" className="py-20 bg-white border-t border-slate-200/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-primary bg-primary-50 px-3 py-1 rounded-full border border-primary-200/80">
              Frequently Asked Questions
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-3">
              Clear answers to common questions.
            </h2>
          </div>

          <div className="divide-y divide-slate-200/80 border-y border-slate-200/80">
            {faqItems.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={idx} className="py-5">
                  <button
                    onClick={() => toggleFaq(idx)}
                    className="w-full flex items-center justify-between text-left gap-4 group cursor-pointer"
                  >
                    <span className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">
                      {item.q}
                    </span>
                    <span className="text-slate-400 group-hover:text-primary transition-colors shrink-0">
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                  </button>
                  {isOpen && (
                    <p className="text-xs sm:text-sm text-slate-600 mt-3 leading-relaxed animate-fade-in pr-6">
                      {item.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 8. Final Call to Action Section */}
      <section className="py-16 sm:py-20 bg-gradient-to-br from-slate-900 via-primary-950 to-slate-900 text-white relative overflow-hidden">
        {/* Subtle Decorative Ambient Glows */}
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-primary/30 mx-auto mb-6">
            <Layers className="w-6 h-6" />
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Make teamwork simpler with WorkSpace.
          </h2>

          <p className="mt-4 text-sm sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed">
            Bring your projects, tasks and conversations together. Give your team a clearer way to work.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            {isAuthenticated ? (
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate('/dashboard')}
                rightIcon={<ArrowRight className="w-4 h-4" />}
                className="px-6 text-sm font-semibold shadow-md"
              >
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/register')}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  className="px-6 text-sm font-semibold shadow-md"
                >
                  Get Started
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate('/login')}
                  className="px-6 text-sm font-semibold bg-white/10 text-white border-white/20 hover:bg-white/20"
                >
                  Sign In
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* 9. Professional Customer-Facing Footer */}
      <footer className="bg-slate-950 text-slate-400 text-xs py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-slate-800/80">
            {/* Column 1 — WorkSpace */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white">
                  <Layers className="w-4 h-4" />
                </div>
                <span className="font-extrabold text-sm tracking-tight text-white">
                  WorkSpace
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.2 rounded bg-primary-900/60 text-primary-300 border border-primary-700/50">
                  SaaS
                </span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                A simpler way to organize projects, manage tasks and work together.
              </p>
            </div>

            {/* Column 2 — Product */}
            <div>
              <h5 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] mb-3">
                Product
              </h5>
              <ul className="space-y-2 text-[11px]">
                <li>
                  <button onClick={() => scrollToSection('features')} className="hover:text-white transition-colors cursor-pointer">
                    Features
                  </button>
                </li>
                <li>
                  <button onClick={() => scrollToSection('how-it-works')} className="hover:text-white transition-colors cursor-pointer">
                    How It Works
                  </button>
                </li>
                <li>
                  <button onClick={() => scrollToSection('preview')} className="hover:text-white transition-colors cursor-pointer">
                    Product Preview
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 3 — Company */}
            <div>
              <h5 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] mb-3">
                Company
              </h5>
              <ul className="space-y-2 text-[11px]">
                <li>
                  <button onClick={() => scrollToSection('about')} className="hover:text-white transition-colors cursor-pointer">
                    About
                  </button>
                </li>
                <li>
                  <button onClick={() => scrollToSection('faq')} className="hover:text-white transition-colors cursor-pointer">
                    Frequently Asked Questions
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 4 — Get Started */}
            <div>
              <h5 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] mb-3">
                Get Started
              </h5>
              <ul className="space-y-2 text-[11px]">
                <li>
                  <button onClick={() => navigate('/login')} className="hover:text-white transition-colors cursor-pointer">
                    Login
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/register')} className="hover:text-white transition-colors cursor-pointer">
                    Create an Account
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
            <span>
              &copy; {new Date().getFullYear()} WorkSpace. All rights reserved.
            </span>
            <span>Simple, connected project management for teams.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

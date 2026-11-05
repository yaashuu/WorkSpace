import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Users,
  Shield,
  Wifi,
  WifiOff,
  AlertCircle,
  Hash,
  ExternalLink,
} from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { Avatar } from '../components/ui/Avatar';
import { EmptyState } from '../components/ui/EmptyState';
import { chatApi } from '../lib/chatApi';
import { projectApi } from '../lib/projectApi';
import { ApiClientError } from '../lib/api';
import {
  joinConversationRoom,
  leaveConversationRoom,
  subscribeToMessage,
  subscribeToConnectionState,
  subscribeToEviction,
} from '../lib/socket';
import {
  ConversationResponse,
  MessageResponse,
  ConversationType,
} from '../types/chat';
import { ProjectItem, isDetailedProject } from '../types/project';
import { AuthUser } from '../types/auth';

export interface ChatPageProps {
  currentUser: AuthUser;
  initialProjectId?: string | null;
  onNavigateToProject?: (projectId: string) => void;
  onTriggerToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
}

interface ChannelOption {
  id: string; // project ID or manager ID
  type: ConversationType;
  title: string;
  subtitle: string;
  projectKey?: string;
  projectId?: string;
  managerId?: string;
}

export const ChatPage: React.FC<ChatPageProps> = ({
  currentUser,
  initialProjectId,
  onNavigateToProject,
  onTriggerToast,
}) => {
  // Navigation & Channels State
  const [activeTab, setActiveTab] = useState<'PROJECTS' | 'DIRECT'>('PROJECTS');
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [directChannels, setDirectChannels] = useState<ChannelOption[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<ChannelOption | null>(null);

  // Active Conversation State
  const [activeConversation, setActiveConversation] = useState<ConversationResponse | null>(null);
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoadingChannels, setIsLoadingChannels] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Socket Connection State
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isAdmin = currentUser.globalRole === 'ADMIN';

  // 1. Subscribe to Socket Connection State
  useEffect(() => {
    const unsubState = subscribeToConnectionState((connected) => {
      setIsSocketConnected(connected);
    });

    const unsubEvict = subscribeToEviction((data) => {
      onTriggerToast(
        'warning',
        'Evicted from Channel',
        'Your access to this project conversation has ended.'
      );
      if (selectedChannel?.projectId === data.projectId) {
        setActiveConversation(null);
        setMessages([]);
      }
    });

    return () => {
      unsubState();
      unsubEvict();
    };
  }, [selectedChannel, onTriggerToast]);

  // 2. Load User Projects & PM Direct Channels
  useEffect(() => {
    let isMounted = true;

    async function loadChannelDirectory() {
      setIsLoadingChannels(true);
      setError(null);
      try {
        const projectsData: ProjectItem[] = await projectApi.getProjects();

        if (!isMounted) return;

        // Accessible project group channels (user has detailed membership or is admin)
        const projChannels: ChannelOption[] = projectsData
          .filter(isDetailedProject)
          .map((p) => ({
            id: p._id,
            type: 'PROJECT_GROUP',
            title: p.name,
            subtitle: `Project #${p.key}`,
            projectKey: p.key,
            projectId: p._id,
          }));

        setChannels(projChannels);

        // Build Direct Messaging channels
        if (isAdmin) {
          // Admin can direct message any project manager
          try {
            const managers = await projectApi.getEligibleManagers();
            if (isMounted) {
              const dmChannels: ChannelOption[] = managers.map((m) => ({
                id: m._id,
                type: 'ADMIN_PM_DM',
                title: m.fullName,
                subtitle: m.email,
                managerId: m._id,
              }));
              setDirectChannels(dmChannels);
            }
          } catch {
            // Ignore if eligible managers fails
          }
        } else {
          // Primary PM has a direct line to Admin
          const isUserPM = projectsData.some(
            (p) => isDetailedProject(p) && p.primaryManagerId === currentUser._id
          );
          if (isUserPM) {
            setDirectChannels([
              {
                id: 'admin-line',
                type: 'ADMIN_PM_DM',
                title: 'Organization Administrator',
                subtitle: 'Direct Executive Line',
                managerId: currentUser._id,
              },
            ]);
          }
        }

        // Auto-select initial channel if specified or default to first project
        if (initialProjectId) {
          const match = projChannels.find((c) => c.projectId === initialProjectId);
          if (match) {
            setSelectedChannel(match);
            return;
          }
        }

        if (projChannels.length > 0 && !selectedChannel) {
          setSelectedChannel(projChannels[0]);
        }
      } catch (err) {
        if (isMounted) {
          const msg = err instanceof ApiClientError ? err.message : 'Failed to load channels';
          setError(msg);
        }
      } finally {
        if (isMounted) setIsLoadingChannels(false);
      }
    }

    loadChannelDirectory();

    return () => {
      isMounted = false;
    };
  }, [currentUser._id, isAdmin, initialProjectId]);

  // 3. Connect to Active Conversation and Load Message History
  useEffect(() => {
    if (!selectedChannel) return;

    let isMounted = true;
    let currentConvId: string | null = null;

    async function initConversation() {
      setIsLoadingMessages(true);
      setError(null);
      try {
        let conv: ConversationResponse;
        if (selectedChannel!.type === 'PROJECT_GROUP' && selectedChannel!.projectId) {
          conv = await chatApi.getProjectConversation(selectedChannel!.projectId);
        } else if (selectedChannel!.type === 'ADMIN_PM_DM' && selectedChannel!.managerId) {
          conv = await chatApi.getAdminPmConversation(selectedChannel!.managerId);
        } else {
          throw new Error('Invalid channel selection');
        }

        if (!isMounted) return;

        setActiveConversation(conv);
        currentConvId = conv._id;

        // Join socket room
        joinConversationRoom(conv._id);

        // Fetch message history
        const history = await chatApi.getMessages(conv._id, { limit: 50 });
        if (isMounted) {
          // Reverse messages because backend returns newest first
          setMessages(history.reverse());
        }
      } catch (err) {
        if (isMounted) {
          const msg = err instanceof ApiClientError ? err.message : 'Failed to load conversation';
          setError(msg);
          setActiveConversation(null);
          setMessages([]);
        }
      } finally {
        if (isMounted) setIsLoadingMessages(false);
      }
    }

    initConversation();

    return () => {
      isMounted = false;
      if (currentConvId) {
        leaveConversationRoom(currentConvId);
      }
    };
  }, [selectedChannel]);

  // 4. Real-Time Socket Listener for Incoming Messages
  useEffect(() => {
    if (!activeConversation) return;

    const unsubMessage = subscribeToMessage((incomingMsg) => {
      if (incomingMsg.conversationId === activeConversation._id) {
        setMessages((prev) => {
          // Deduplicate if already present
          if (prev.some((m) => m._id === incomingMsg._id)) {
            return prev;
          }
          return [...prev, incomingMsg];
        });
      }
    });

    return () => {
      unsubMessage();
    };
  }, [activeConversation]);

  // 5. Scroll to bottom on messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoadingMessages]);

  // 6. Handle Message Sending
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = inputText.trim();
    if (!content || !activeConversation || isSending) return;

    setIsSending(true);
    try {
      const savedMsg = await chatApi.sendMessage(activeConversation._id, content);
      // Append immediately if not received via socket yet
      setMessages((prev) => {
        if (prev.some((m) => m._id === savedMsg._id)) return prev;
        return [...prev, savedMsg];
      });
      setInputText('');
      inputRef.current?.focus();
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to send message';
      onTriggerToast('error', 'Message Delivery Failed', msg);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="h-[calc(100vh-135px)] flex flex-col space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary-50 text-primary flex items-center justify-center font-bold">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Team Communication Hub
            </h2>
            <p className="text-xs text-slate-500">
              Live Socket.IO group channels and confidential Admin–PM direct messaging.
            </p>
          </div>
        </div>

        {/* Real-time indicator pill */}
        <div className="flex items-center gap-2">
          <Badge
            variant={isSocketConnected ? 'primary' : 'neutral'}
            size="sm"
            dot
            className={isSocketConnected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}
          >
            {isSocketConnected ? (
              <span className="flex items-center gap-1 font-mono text-[10px]">
                <Wifi className="w-3 h-3 text-emerald-500" />
                Live WebSocket
              </span>
            ) : (
              <span className="flex items-center gap-1 font-mono text-[10px]">
                <WifiOff className="w-3 h-3 text-slate-400" />
                Connecting...
              </span>
            )}
          </Badge>
        </div>
      </div>

      {/* Main Chat Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 min-h-0">
        {/* Left: Channels Sidebar (4 cols) */}
        <div className="md:col-span-4 lg:col-span-3 flex flex-col bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden h-full">
          {/* Channel Tabs */}
          <div className="p-2 border-b border-slate-100 flex items-center gap-1 bg-slate-50/70">
            <button
              onClick={() => setActiveTab('PROJECTS')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors text-center cursor-pointer ${
                activeTab === 'PROJECTS'
                  ? 'bg-white text-primary shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Projects ({channels.length})
            </button>
            <button
              onClick={() => setActiveTab('DIRECT')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors text-center cursor-pointer ${
                activeTab === 'DIRECT'
                  ? 'bg-white text-primary shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Direct Line ({directChannels.length})
            </button>
          </div>

          {/* Channels List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100/80 p-1.5">
            {isLoadingChannels ? (
              <div className="flex flex-col items-center justify-center p-8 text-slate-400 gap-2">
                <Spinner size="sm" />
                <span className="text-xs">Loading channels...</span>
              </div>
            ) : activeTab === 'PROJECTS' ? (
              channels.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  You are not a member of any active project channels.
                </div>
              ) : (
                channels.map((chan) => {
                  const isSelected = selectedChannel?.id === chan.id;
                  return (
                    <button
                      key={chan.id}
                      onClick={() => setSelectedChannel(chan)}
                      className={`w-full text-left p-3 rounded-lg transition-all flex items-start gap-2.5 cursor-pointer ${
                        isSelected
                          ? 'bg-primary-50/60 border border-primary-200/60 text-slate-900'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs ${
                          isSelected ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <Hash className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold truncate">{chan.title}</span>
                          {chan.projectKey && (
                            <span className="font-mono text-[10px] text-primary font-semibold px-1 py-0.2 bg-primary-100/50 rounded shrink-0">
                              {chan.projectKey}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {chan.subtitle}
                        </p>
                      </div>
                    </button>
                  );
                })
              )
            ) : directChannels.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                {isAdmin
                  ? 'No designated Project Managers available for direct messaging.'
                  : 'Direct line to Administrator is reserved for active Project Managers.'}
              </div>
            ) : (
              directChannels.map((chan) => {
                const isSelected = selectedChannel?.id === chan.id;
                return (
                  <button
                    key={chan.id}
                    onClick={() => setSelectedChannel(chan)}
                    className={`w-full text-left p-3 rounded-lg transition-all flex items-start gap-2.5 cursor-pointer ${
                      isSelected
                        ? 'bg-primary-50/60 border border-primary-200/60 text-slate-900'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs ${
                        isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold truncate block">{chan.title}</span>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {chan.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Active Message History & Composer (8 cols) */}
        <div className="md:col-span-8 lg:col-span-9 flex flex-col bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden h-full">
          {!selectedChannel ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <EmptyState
                icon={<MessageSquare className="w-8 h-8" />}
                title="Select a Conversation"
                description="Choose a project group channel or confidential direct line from the sidebar to start collaborating."
              />
            </div>
          ) : (
            <>
              {/* Conversation Top Header */}
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/40 shrink-0">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${
                      selectedChannel.type === 'PROJECT_GROUP'
                        ? 'bg-primary'
                        : 'bg-indigo-600'
                    }`}
                  >
                    {selectedChannel.type === 'PROJECT_GROUP' ? (
                      <Users className="w-4 h-4" />
                    ) : (
                      <Shield className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">
                        {selectedChannel.title}
                      </h3>
                      <Badge
                        variant={selectedChannel.type === 'PROJECT_GROUP' ? 'primary' : 'neutral'}
                        size="sm"
                      >
                        {selectedChannel.type === 'PROJECT_GROUP' ? 'Project Channel' : 'Confidential DM'}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {selectedChannel.subtitle}
                    </p>
                  </div>
                </div>

                {selectedChannel.projectId && onNavigateToProject && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onNavigateToProject(selectedChannel.projectId!)}
                    rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                    className="text-xs text-slate-600 hover:text-primary"
                  >
                    View Project
                  </Button>
                )}
              </div>

              {/* Message History Thread */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/30">
                {isLoadingMessages ? (
                  <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-2">
                    <Spinner size="md" />
                    <span className="text-xs">Loading message history...</span>
                  </div>
                ) : error ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center space-y-2">
                    <div className="flex items-center justify-center gap-2 text-red-700 text-xs font-semibold">
                      <AlertCircle className="w-4 h-4" />
                      <span>{error}</span>
                    </div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary flex items-center justify-center mb-2">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold text-slate-700">No messages yet</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Be the first to post a message in this channel.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.senderId === currentUser._id;
                    const senderName = msg.sender?.fullName || 'Team Member';
                    const timeFormatted = new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={msg._id}
                        className={`flex items-start gap-3 ${isMe ? 'flex-row-reverse' : ''}`}
                      >
                        <Avatar
                          name={senderName}
                          src={msg.sender?.avatarUrl || undefined}
                          size="sm"
                          className="shrink-0 mt-0.5"
                        />

                        <div className={`max-w-[75%] space-y-1 ${isMe ? 'items-end' : ''}`}>
                          <div
                            className={`flex items-center gap-2 text-[10px] text-slate-400 ${
                              isMe ? 'justify-end' : ''
                            }`}
                          >
                            <span className="font-bold text-slate-700">{senderName}</span>
                            {isMe && (
                              <span className="bg-primary-100 text-primary font-semibold px-1 rounded text-[9px]">
                                You
                              </span>
                            )}
                            <span>{timeFormatted}</span>
                          </div>

                          <div
                            className={`p-3 rounded-2xl text-xs leading-relaxed break-words shadow-xs ${
                              isMe
                                ? 'bg-primary text-white rounded-tr-none'
                                : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-none'
                            }`}
                          >
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer */}
              <div className="p-3 border-t border-slate-200/80 bg-white shrink-0">
                <form onSubmit={handleSendMessage} className="space-y-2">
                  <div className="relative">
                    <textarea
                      ref={inputRef}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={
                        selectedChannel
                          ? `Message #${selectedChannel.title} (Enter to send, Shift+Enter for newline)...`
                          : 'Select a conversation to write a message...'
                      }
                      rows={2}
                      maxLength={5000}
                      disabled={!activeConversation || isSending}
                      className="w-full text-xs p-3 pr-20 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white resize-none transition-all"
                    />

                    <div className="absolute right-2.5 bottom-3.5 flex items-center gap-2">
                      <Button
                        type="submit"
                        size="sm"
                        variant="primary"
                        disabled={!inputText.trim() || !activeConversation || isSending}
                        isLoading={isSending}
                        className="h-8 px-3 rounded-lg text-xs"
                        rightIcon={<Send className="w-3 h-3" />}
                      >
                        Send
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
                    <span>Press Enter to send</span>
                    <span>{inputText.length} / 5000</span>
                  </div>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

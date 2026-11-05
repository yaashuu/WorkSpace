import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, Clock } from 'lucide-react';
import { TaskComment } from '../../types/task';
import { taskApi } from '../../lib/taskApi';
import { ApiClientError } from '../../lib/api';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { AuthUser } from '../../types/auth';

export interface TaskCommentsProps {
  taskId: string;
  currentUser: AuthUser;
  onTriggerToast: (type: 'success' | 'error' | 'warning', title: string, message?: string) => void;
}

export const TaskComments: React.FC<TaskCommentsProps> = ({
  taskId,
  currentUser,
  onTriggerToast,
}) => {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New comment input
  const [newContent, setNewContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadComments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await taskApi.getTaskComments(taskId);
      setComments(data);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load comments');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [taskId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    setIsSubmitting(true);
    try {
      const created = await taskApi.createTaskComment(taskId, {
        content: newContent.trim(),
      });
      setComments((prev) => [...prev, created]);
      setNewContent('');
      onTriggerToast('success', 'Comment Posted', 'Your comment has been added to the task.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to post comment';
      onTriggerToast('error', 'Comment Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pt-3">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
        <MessageSquare className="w-4 h-4 text-primary" />
        <span>Discussion & Comments ({comments.length})</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-6 text-slate-400 gap-2">
          <Spinner size="sm" />
          <span className="text-xs">Loading task comments...</span>
        </div>
      ) : error ? (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <Button size="sm" variant="ghost" onClick={loadComments}>
            Retry
          </Button>
        </div>
      ) : comments.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
          No comments yet. Start the conversation below.
        </div>
      ) : (
        <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
          {comments.map((c) => {
            const authorName = c.author?.fullName || 'Team Member';
            const isMe = c.authorId === currentUser._id;

            return (
              <div
                key={c._id}
                className={`p-3 rounded-xl border transition-all text-xs ${
                  isMe ? 'bg-primary-50/30 border-primary-100 ml-4' : 'bg-white border-slate-200/80 mr-4'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Avatar name={authorName} size="xs" />
                    <span className="font-bold text-slate-900">{authorName}</span>
                    {isMe && (
                      <span className="text-[10px] text-primary font-semibold bg-primary-100/60 px-1 rounded">
                        You
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(c.createdAt).toLocaleDateString()} {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap pl-6">
                  {c.content}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Comment Input Form */}
      <form onSubmit={handleSubmit} className="space-y-2 pt-2">
        <textarea
          rows={2}
          placeholder="Write a comment or update for the team..."
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          maxLength={2000}
          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none transition-colors"
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-400">
            Markdown supported • {2000 - newContent.length} chars remaining
          </span>
          <Button
            type="submit"
            size="sm"
            variant="primary"
            disabled={!newContent.trim() || isSubmitting}
            isLoading={isSubmitting}
            leftIcon={<Send className="w-3.5 h-3.5" />}
          >
            Post Comment
          </Button>
        </div>
      </form>
    </div>
  );
};

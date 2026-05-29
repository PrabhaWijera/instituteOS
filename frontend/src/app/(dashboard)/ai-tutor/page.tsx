'use client';

import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Send, Loader2, Trash2, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { AiMessage } from '@/lib/types';
import logger from '@/lib/logger';

const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'History', 'Geography', 'ICT', 'Commerce', 'Economics', 'Science', 'Combined Maths'];
const MAX_CHARS = 500;

const EXAMPLE_PROMPTS = [
  'Explain photosynthesis step by step',
  'How do I solve quadratic equations?',
  'What caused World War II?',
  'Explain Newton\'s third law with examples',
];

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function renderMarkdown(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4">$1. $2</li>')
    .replace(/\n/g, '<br/>');
}

export default function AiTutorPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [subject, setSubject] = useState('Mathematics');
  const [grade, setGrade] = useState('Grade 10');
  const [language, setLanguage] = useState<'english' | 'sinhala' | 'bilingual'>('english');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/ai/history').then(({ data }) => {
      const history = (data.data || []).map((m: AiMessage) => ({
        role: m.role,
        content: m.content,
      }));
      setMessages(history);
    }).catch((err) => logger.error('Failed to load AI history', err));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim()) return;
    const userMessage = text.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setSending(true);
    try {
      const { data } = await api.post('/ai/chat', { message: userMessage, subject, grade, language });
      setMessages(prev => [...prev, { role: 'assistant', content: data.data.reply }]);
    } catch {
      toast.error('AI tutor is unavailable');
    } finally {
      setSending(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  async function clearHistory() {
    try {
      await api.delete('/ai/history');
      setMessages([]);
      toast.success('Chat cleared');
    } catch (err) { logger.error('Clear AI history failed', err); toast.error('Failed'); }
  }

  return (
    <div className="space-y-4 h-[calc(100vh-8rem)] flex flex-col">
      <PageHeader title="AI Tutor" description="Ask questions and get Socratic-style guidance">
        <div className="flex items-center gap-2">
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Input className="w-24" placeholder="Grade" value={grade} onChange={e => setGrade(e.target.value)} />
          <Button variant={language === 'english' ? 'default' : 'outline'} size="sm" onClick={() => setLanguage(l => l === 'english' ? 'sinhala' : l === 'sinhala' ? 'bilingual' : 'english')}>
            <Globe className="h-3.5 w-3.5 mr-1" />{language.charAt(0).toUpperCase() + language.slice(1)}
          </Button>
          <Button variant="outline" size="icon" onClick={clearHistory} title="Clear chat">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </PageHeader>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Bot className="h-16 w-16 mb-4 opacity-40" />
                <p className="text-lg font-medium">Hello! I&apos;m your AI Tutor</p>
                <p className="text-sm mb-6">Ask me anything about {subject}. I&apos;ll guide you step by step using the Socratic method.</p>
                <div className="flex flex-wrap gap-2 justify-center max-w-md">
                  {EXAMPLE_PROMPTS.map((prompt, i) => (
                    <Button key={i} variant="outline" size="sm" className="text-xs" onClick={() => sendMessage(prompt)}>
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'assistant' && (
                  <div className="flex items-start gap-2 max-w-[85%]">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs mt-0.5">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="bg-muted rounded-lg px-4 py-2 text-sm">
                      <div className="whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                    </div>
                  </div>
                )}
                {msg.role === 'user' && (
                  <div className="max-w-[80%] bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm">
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="flex items-start gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs"><Bot className="h-4 w-4" /></div>
                  <div className="bg-muted rounded-lg px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
        <CardContent className="border-t p-4">
          <form onSubmit={handleSend} className="space-y-1">
            <div className="flex gap-2">
              <Input
                placeholder={`Ask about ${subject}...`}
                value={input}
                onChange={e => setInput(e.target.value.slice(0, MAX_CHARS))}
                disabled={sending}
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={sending || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-right">{input.length}/{MAX_CHARS}</p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

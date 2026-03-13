import { useState, useEffect, useCallback } from 'react';
import { apiUrl, TOKEN_KEY } from '../lib/api';

type Note = {
  id: string;
  body: string;
  createdByName?: string;
  createdAt?: string;
};

interface NotesPanelProps {
  entityType: string;
  entityId: string;
}

function formatTimestamp(s?: string): string {
  if (!s) return '—';
  try {
    const d = new Date(s);
    return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

export function NotesPanel({ entityType, entityId }: NotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteInput, setNoteInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadNotes = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token || !entityType || !entityId) return;
    setLoading(true);
    try {
      const url = new URL(apiUrl('/api/v1/notes'));
      url.searchParams.set('entityType', entityType);
      url.searchParams.set('entityId', entityId);
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setNotes(data.data || []);
      } else {
        setNotes([]);
      }
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  const saveNote = async () => {
    const trimmed = noteInput.trim();
    if (!trimmed || isSaving) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token) return;
    setIsSaving(true);
    try {
      const res = await fetch(apiUrl('/api/v1/notes'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ entityType, entityId, body: trimmed }),
      });
      if (res.ok) {
        setNoteInput('');
        await loadNotes();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void saveNote();
    }
  };

  return (
    <aside className="modal-notes-panel">
      <h3 className="form-section-title">Notes</h3>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 80 }}>
        {loading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : notes.length === 0 ? (
          <div className="text-sm text-gray-500">No notes yet. Press Enter to save.</div>
        ) : (
          <div className="space-y-3">
            {notes.map((n) => (
              <div
                key={n.id}
                className="rounded-lg border border-gray-200 p-2.5 bg-gray-50/50 text-sm"
              >
                <p className="text-gray-900 whitespace-pre-wrap">{n.body}</p>
                <div className="text-xs text-gray-500 mt-1">
                  {n.createdByName || 'User'} · {formatTimestamp(n.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <textarea
          value={noteInput}
          onChange={(e) => setNoteInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a note (Enter to save)"
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          disabled={isSaving}
        />
      </div>
    </aside>
  );
}

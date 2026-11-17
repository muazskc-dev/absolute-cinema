import { useEffect, useRef, useState, type FormEvent } from "react";
import { MessageSquare, Send } from "lucide-react";

import type { RoomSummary } from "../../lib/rooms/types";
import { useAppStore } from "../../stores/app-store";
import { Button } from "../../components/ui/Button";
import { Drawer } from "../../components/ui/Drawer";
import { EmptyState } from "../../components/ui/EmptyState";

function timeLabel(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function ChatDrawer({
  room,
  open,
  onClose,
}: {
  room: RoomSummary;
  open: boolean;
  onClose: () => void;
}) {
  const { chatByRoom, sendChatMessage, clearChat } = useAppStore();
  const messages = chatByRoom[room.id] ?? [];
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);

  useEffect(() => {
    if (!open || !nearBottom.current) return;
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [messages.length, open]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.trim()) return;
    sendChatMessage(room.id, draft);
    setDraft("");
    nearBottom.current = true;
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Chat"
      description="Local to this window"
      footer={
        <form onSubmit={submit} className="p-3">
          <div className="rounded-md border border-line bg-surface-1 focus-within:ring-2 focus-within:ring-white/90 focus-within:ring-offset-2 focus-within:ring-offset-surface-2">
            <textarea
              data-drawer-autofocus
              value={draft}
              onChange={(event) => setDraft(event.target.value.slice(0, 2000))}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (draft.trim()) {
                    sendChatMessage(room.id, draft);
                    setDraft("");
                    nearBottom.current = true;
                  }
                }
              }}
              rows={2}
              placeholder="Write a message…"
              aria-label="Chat message"
              className="block w-full resize-none bg-transparent px-3 py-2 text-[12px] leading-5 text-ink outline-none placeholder:text-ink-secondary"
            />
            <div className="flex items-center justify-between gap-2 border-t border-line-subtle px-2 py-1.5">
              <span className="text-[10px] text-ink-secondary">
                Enter to send · Shift+Enter for a new line
              </span>
              <Button
                type="submit"
                size="sm"
                variant="primary"
                icon={<Send size={13} />}
                disabled={!draft.trim()}
              >
                Send
              </Button>
            </div>
          </div>
          <p className="mt-2 text-[10px] leading-4 text-ink-secondary">
            Messages stay in memory and disappear when the app closes. A real
            chat service and retention policy arrive with the backend.
          </p>
        </form>
      }
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line-subtle px-4 py-2">
        <span className="text-[10px] uppercase tracking-[0.12em] text-ink-secondary">
          {messages.length === 0
            ? "No messages"
            : `${messages.length} message${messages.length === 1 ? "" : "s"}`}
        </span>
        <button
          type="button"
          onClick={() => clearChat(room.id)}
          disabled={messages.length === 0}
          className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-ink-secondary transition-colors duration-100 hover:text-ink disabled:opacity-40"
        >
          Clear
        </button>
      </div>

      <div
        ref={listRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          nearBottom.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            48;
        }}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
      >
        {messages.length === 0 ? (
          <EmptyState
            compact
            icon={<MessageSquare size={16} />}
            title="No messages yet"
            description="Say something to the other participant. This prototype keeps the conversation in local memory only."
          />
        ) : (
          <ul className="flex flex-col gap-3" aria-label="Chat messages">
            {messages.map((message) => (
              <li
                key={message.id}
                className="border-b border-line-subtle pb-3 last:border-b-0 last:pb-0"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] font-medium text-ink">
                    {message.author === "you" ? "You" : "Partner"}
                  </span>
                  <time
                    dateTime={message.at}
                    className="font-mono text-[10px] text-ink-secondary"
                  >
                    {timeLabel(message.at)}
                  </time>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-[12px] leading-5 text-ink-secondary">
                  {message.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Drawer>
  );
}

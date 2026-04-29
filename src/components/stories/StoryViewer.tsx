import { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { StoryGroup, Story } from "@/hooks/useStories";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthProvider";
import { X, ChevronLeft, ChevronRight, Heart, Eye, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const REACTIONS = ["❤️", "🔥", "😂", "😮", "👏", "😢"];

interface Props {
  groups: StoryGroup[];
  initialGroupIndex: number;
  onClose: () => void;
  onMarkSeen: (storyId: string) => void;
  onDeleted: () => void;
}

export function StoryViewer({ groups, initialGroupIndex, onClose, onMarkSeen, onDeleted }: Props) {
  const { user } = useAuth();
  const [gi, setGi] = useState(initialGroupIndex);
  const [si, setSi] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [viewers, setViewers] = useState<{ display_name: string; avatar_url: string | null }[]>([]);
  const [showViewers, setShowViewers] = useState(false);
  const timer = useRef<number | null>(null);

  const group = groups[gi];
  const story: Story | undefined = group?.stories[si];
  const isMine = story?.author_id === user?.id;

  useEffect(() => {
    if (!story) return;
    onMarkSeen(story.id);
    setProgress(0);
    setShowViewers(false);
    if (isMine) {
      supabase
        .from("story_views")
        .select("viewer_id, viewed_at")
        .eq("story_id", story.id)
        .then(async ({ data }) => {
          if (!data || data.length === 0) { setViewers([]); return; }
          const { data: profs } = await supabase
            .from("profiles")
            .select("user_id, display_name, avatar_url")
            .in("user_id", data.map((v: any) => v.viewer_id));
          setViewers((profs ?? []).map((p: any) => ({ display_name: p.display_name, avatar_url: p.avatar_url })));
        });
    }
  }, [story?.id, isMine, onMarkSeen]);

  useEffect(() => {
    if (paused || !story) return;
    const start = Date.now();
    const DURATION = 5000;
    timer.current = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min(100, (elapsed / DURATION) * 100);
      setProgress(p);
      if (p >= 100) next();
    }, 50);
    return () => { if (timer.current) clearInterval(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id, paused]);

  const next = () => {
    if (!group) return;
    if (si < group.stories.length - 1) setSi(si + 1);
    else if (gi < groups.length - 1) { setGi(gi + 1); setSi(0); }
    else onClose();
  };

  const prev = () => {
    if (si > 0) setSi(si - 1);
    else if (gi > 0) { setGi(gi - 1); setSi(groups[gi - 1].stories.length - 1); }
  };

  const react = async (emoji: string) => {
    if (!user || !story) return;
    setPaused(true);
    const { error } = await supabase
      .from("story_reactions")
      .insert({ story_id: story.id, user_id: user.id, emoji });
    if (error && !error.message.includes("duplicate")) {
      toast.error(error.message);
    } else {
      toast.success(`Reacted ${emoji}`);
    }
    setTimeout(() => setPaused(false), 800);
  };

  const remove = async () => {
    if (!story || !confirm("Delete this story?")) return;
    const { error } = await supabase.from("stories").delete().eq("id", story.id);
    if (error) return toast.error(error.message);
    toast.success("Story deleted");
    onDeleted();
    onClose();
  };

  if (!group || !story) return null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="h-[90vh] max-h-[800px] w-full max-w-md overflow-hidden border-0 bg-black p-0">
        {/* Progress bars */}
        <div className="absolute left-3 right-3 top-3 z-20 flex gap-1">
          {group.stories.map((_, i) => (
            <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full bg-white transition-[width] duration-100"
                style={{ width: `${i < si ? 100 : i === si ? progress : 0}%` }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute left-3 right-3 top-7 z-20 flex items-center gap-2 pt-2">
          <div className="h-8 w-8 overflow-hidden rounded-full bg-white/20">
            {group.author_avatar ? (
              <img src={group.author_avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-bold text-white">
                {group.author_name[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">{group.author_name}</div>
            <div className="text-[10px] text-white/70">
              {formatDistanceToNow(new Date(story.created_at), { addSuffix: true })}
              {story.visibility === "section" && story.section ? ` · Section ${story.section}` : ""}
            </div>
          </div>
          {isMine && (
            <Button
              size="icon"
              variant="ghost"
              onClick={remove}
              className="h-8 w-8 text-white hover:bg-white/20"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="h-8 w-8 text-white hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Story content */}
        <div
          className="relative flex h-full w-full items-center justify-center"
          onMouseDown={() => setPaused(true)}
          onMouseUp={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
          style={story.type === "text" ? { background: story.background ?? "#222" } : undefined}
        >
          {story.type === "image" && story.media_url && (
            <img src={story.media_url} alt="" className="max-h-full max-w-full object-contain" />
          )}
          {story.type === "text" && (
            <div className="px-8 text-center text-2xl font-bold text-white">{story.content}</div>
          )}

          {/* Tap zones */}
          <button
            type="button"
            onClick={prev}
            className="absolute left-0 top-0 h-full w-1/3 cursor-pointer"
            aria-label="Previous"
          />
          <button
            type="button"
            onClick={next}
            className="absolute right-0 top-0 h-full w-1/3 cursor-pointer"
            aria-label="Next"
          />

          {/* Side arrows for desktop */}
          {(gi > 0 || si > 0) && (
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white opacity-0 transition hover:bg-black/60 group-hover:opacity-100 sm:opacity-50"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={next}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white opacity-0 transition hover:bg-black/60 group-hover:opacity-100 sm:opacity-50"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Bottom actions */}
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 to-transparent p-4">
          {isMine ? (
            <button
              onClick={() => setShowViewers((s) => !s)}
              className="flex items-center gap-1.5 text-sm text-white"
            >
              <Eye className="h-4 w-4" /> {viewers.length} {viewers.length === 1 ? "view" : "views"}
            </button>
          ) : (
            <div className="flex justify-center gap-2">
              {REACTIONS.map((e) => (
                <button
                  key={e}
                  onClick={() => react(e)}
                  className="text-2xl transition-transform hover:scale-125 active:scale-150"
                >
                  {e}
                </button>
              ))}
            </div>
          )}

          {showViewers && isMine && (
            <div className="mt-3 max-h-40 overflow-y-auto rounded-lg bg-white/10 p-2 backdrop-blur">
              {viewers.length === 0 ? (
                <p className="py-2 text-center text-xs text-white/70">No viewers yet</p>
              ) : (
                viewers.map((v, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 text-sm text-white">
                    <div className="h-6 w-6 overflow-hidden rounded-full bg-white/20">
                      {v.avatar_url ? <img src={v.avatar_url} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <span>{v.display_name}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

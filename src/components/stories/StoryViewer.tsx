import { useEffect, useState, useRef, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { StoryGroup, Story } from "@/hooks/useStories";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthProvider";
import { X, ChevronLeft, ChevronRight, Eye, Trash2, Heart } from "lucide-react";
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
  const [viewers, setViewers] = useState<
    { user_id: string; display_name: string; avatar_url: string | null; emoji: string | null }[]
  >([]);
  const [reactions, setReactions] = useState<{ user_id: string; emoji: string }[]>([]);
  const [showViewers, setShowViewers] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const group = groups[gi];
  const story: Story | undefined = group?.stories[si];
  const isMine = story?.author_id === user?.id;

  const loadReactions = useCallback(async (storyId: string) => {
    const { data } = await supabase
      .from("story_reactions")
      .select("user_id, emoji")
      .eq("story_id", storyId);
    setReactions(data ?? []);
  }, []);

  const loadViewers = useCallback(async (storyId: string) => {
    const { data: views } = await supabase
      .from("story_views")
      .select("viewer_id")
      .eq("story_id", storyId);
    if (!views || views.length === 0) {
      setViewers([]);
      return;
    }
    const ids = views.map((v: any) => v.viewer_id);
    const [{ data: profs }, { data: rxs }] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", ids),
      supabase.from("story_reactions").select("user_id, emoji").eq("story_id", storyId),
    ]);
    const rxMap = new Map((rxs ?? []).map((r: any) => [r.user_id, r.emoji]));
    setViewers(
      (profs ?? []).map((p: any) => ({
        user_id: p.user_id,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        emoji: rxMap.get(p.user_id) ?? null,
      }))
    );
  }, []);

  useEffect(() => {
    if (!story) return;
    onMarkSeen(story.id);
    setProgress(0);
    setShowViewers(false);
    loadReactions(story.id);
    if (isMine) loadViewers(story.id);
  }, [story?.id, isMine, onMarkSeen, loadReactions, loadViewers]);

  // Realtime: refresh reactions/viewers as they come in
  useEffect(() => {
    if (!story) return;
    const sid = story.id;
    const ch = supabase
      .channel(`story-${sid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "story_reactions", filter: `story_id=eq.${sid}` },
        () => {
          loadReactions(sid);
          if (isMine) loadViewers(sid);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "story_views", filter: `story_id=eq.${sid}` },
        () => {
          if (isMine) loadViewers(sid);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [story?.id, isMine, loadReactions, loadViewers]);

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
    const existing = reactions.find((r) => r.user_id === user.id);

    if (existing && existing.emoji === emoji) {
      // toggle off
      const { error } = await supabase
        .from("story_reactions")
        .delete()
        .eq("story_id", story.id)
        .eq("user_id", user.id)
        .eq("emoji", emoji);
      if (error) toast.error(error.message);
      else setReactions((r) => r.filter((x) => !(x.user_id === user.id && x.emoji === emoji)));
    } else {
      // remove old, insert new
      if (existing) {
        await supabase
          .from("story_reactions")
          .delete()
          .eq("story_id", story.id)
          .eq("user_id", user.id);
      }
      const { error } = await supabase
        .from("story_reactions")
        .insert({ story_id: story.id, user_id: user.id, emoji });
      if (error) {
        toast.error(error.message);
      } else {
        setReactions((r) => [...r.filter((x) => x.user_id !== user.id), { user_id: user.id, emoji }]);
        setFlash(emoji);
        setTimeout(() => setFlash(null), 700);
      }
    }
    setTimeout(() => setPaused(false), 600);
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

        {/* Floating reaction flash */}
        {flash && (
          <div
            className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
            aria-hidden
          >
            <span className="animate-ping text-7xl drop-shadow-2xl">{flash}</span>
          </div>
        )}

        {/* Bottom actions */}
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 pt-10">
          {isMine ? (
            <button
              onClick={() => setShowViewers((s) => !s)}
              className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm text-white backdrop-blur transition hover:bg-white/25"
            >
              <Eye className="h-4 w-4" />
              <span className="font-semibold">{viewers.length}</span>
              <span className="text-white/80">{viewers.length === 1 ? "view" : "views"}</span>
              {reactions.length > 0 && (
                <>
                  <span className="mx-1 h-3 w-px bg-white/30" />
                  <Heart className="h-3.5 w-3.5 fill-rose-400 text-rose-400" />
                  <span className="font-semibold">{reactions.length}</span>
                </>
              )}
            </button>
          ) : (
            <>
              {/* Existing reactions summary */}
              {reactions.length > 0 && (
                <div className="mb-2 flex justify-center gap-1">
                  {Object.entries(
                    reactions.reduce<Record<string, number>>((acc, r) => {
                      acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                      return acc;
                    }, {})
                  ).map(([e, n]) => (
                    <span
                      key={e}
                      className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs text-white backdrop-blur"
                    >
                      <span>{e}</span>
                      <span className="font-semibold">{n}</span>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex justify-center gap-1.5 rounded-full bg-white/10 p-1.5 backdrop-blur-md">
                {REACTIONS.map((e) => {
                  const mine = reactions.some((r) => r.user_id === user?.id && r.emoji === e);
                  return (
                    <button
                      key={e}
                      onClick={() => react(e)}
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-2xl transition-all hover:scale-125 active:scale-150 ${
                        mine ? "bg-white/30 ring-2 ring-white" : ""
                      }`}
                    >
                      {e}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {showViewers && isMine && (
            <div className="mt-3 max-h-60 overflow-y-auto rounded-xl bg-white/10 p-2 backdrop-blur-md">
              {viewers.length === 0 ? (
                <p className="py-3 text-center text-xs text-white/70">No viewers yet</p>
              ) : (
                viewers.map((v) => (
                  <div
                    key={v.user_id}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white hover:bg-white/10"
                  >
                    <div className="h-7 w-7 overflow-hidden rounded-full bg-white/20">
                      {v.avatar_url ? (
                        <img src={v.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] font-bold">
                          {v.display_name[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className="flex-1 truncate">{v.display_name}</span>
                    {v.emoji && <span className="text-base">{v.emoji}</span>}
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

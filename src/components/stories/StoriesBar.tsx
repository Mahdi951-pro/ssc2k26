import { useState } from "react";
import { useStories } from "@/hooks/useStories";
import { useAuth } from "@/components/auth/AuthProvider";
import { Plus } from "lucide-react";
import { StoryComposer } from "./StoryComposer";
import { StoryViewer } from "./StoryViewer";

export function StoriesBar() {
  const { user } = useAuth();
  const { groups, loading, refresh, markSeen } = useStories(user?.id);
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);

  const myGroup = groups.find((g) => g.author_id === user?.id);
  const others = groups.filter((g) => g.author_id !== user?.id);

  if (loading) return null;

  return (
    <div className="border-b border-sidebar-border/50 px-2 py-2 sm:px-3 sm:py-3">
      <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] sm:gap-3 [&::-webkit-scrollbar]:hidden">
        {/* Add / your story */}
        <button
          type="button"
          onClick={() => {
            if (myGroup) setViewerIdx(groups.indexOf(myGroup));
            else setComposerOpen(true);
          }}
          className="group flex w-14 shrink-0 flex-col items-center gap-1 sm:w-16"
        >
          <div className="relative h-12 w-12 sm:h-14 sm:w-14">
            {myGroup ? (
              <div className="h-full w-full rounded-full bg-gradient-brand p-[2px]">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-background">
                  {myGroup.stories[0].type === "image" && myGroup.stories[0].media_url ? (
                    <img
                      src={myGroup.stories[0].media_url}
                      alt=""
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center rounded-full text-[9px] font-bold text-white"
                      style={{ background: myGroup.stories[0].background ?? "var(--gradient-brand)" }}
                    >
                      {myGroup.stories[0].content?.slice(0, 12) ?? "Aa"}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/40 bg-muted/40 text-muted-foreground">
                <Plus className="h-5 w-5" />
              </div>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setComposerOpen(true); }}
              className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background transition hover:scale-110"
              aria-label="Post story"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
          <div className="w-14 truncate text-center text-[10px] font-medium sm:w-16">Your story</div>
        </button>

        {others.map((g) => {
          const idx = groups.indexOf(g);
          return (
            <button
              key={g.author_id}
              type="button"
              onClick={() => setViewerIdx(idx)}
                className="flex w-14 shrink-0 flex-col items-center gap-1 sm:w-16"
            >
              <div className={`h-12 w-12 rounded-full p-[2px] sm:h-14 sm:w-14 ${g.hasUnseen ? "bg-gradient-brand" : "bg-muted-foreground/30"}`}>
                <div className="h-full w-full overflow-hidden rounded-full bg-background p-[2px]">
                  {g.author_avatar ? (
                    <img src={g.author_avatar} alt="" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-bold">
                      {g.author_name[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
              <div className="w-14 truncate text-center text-[10px] font-medium sm:w-16">{g.author_name}</div>
            </button>
          );
        })}
      </div>

      <StoryComposer open={composerOpen} onOpenChange={setComposerOpen} onPosted={refresh} />
      {viewerIdx !== null && (
        <StoryViewer
          groups={groups}
          initialGroupIndex={viewerIdx}
          onClose={() => setViewerIdx(null)}
          onMarkSeen={markSeen}
          onDeleted={refresh}
        />
      )}
    </div>
  );
}

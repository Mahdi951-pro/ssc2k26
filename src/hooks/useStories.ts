import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Story {
  id: string;
  author_id: string;
  type: "text" | "image";
  content: string | null;
  media_url: string | null;
  background: string | null;
  visibility: "public" | "section";
  section: string | null;
  created_at: string;
  expires_at: string;
  author?: {
    display_name: string;
    avatar_url: string | null;
    section: string | null;
  } | null;
}

export interface StoryGroup {
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  stories: Story[];
  hasUnseen: boolean;
}

export function useStories(currentUserId?: string) {
  const [stories, setStories] = useState<Story[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentUserId) return;
    const { data: rows } = await supabase
      .from("stories")
      .select("*")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (!rows || rows.length === 0) {
      setStories([]);
      setLoading(false);
      return;
    }

    const authorIds = Array.from(new Set(rows.map((r: any) => r.author_id)));
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url, section")
      .in("user_id", authorIds);
    const pMap = new Map((profs ?? []).map((p: any) => [p.user_id, p]));

    const enriched: Story[] = rows.map((r: any) => ({
      ...r,
      author: pMap.get(r.author_id) ?? null,
    }));
    setStories(enriched);

    const { data: views } = await supabase
      .from("story_views")
      .select("story_id")
      .eq("viewer_id", currentUserId)
      .in("story_id", rows.map((r: any) => r.id));
    setSeenIds(new Set((views ?? []).map((v: any) => v.story_id)));
    setLoading(false);
  }, [currentUserId]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("stories-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const groups: StoryGroup[] = (() => {
    const m = new Map<string, StoryGroup>();
    for (const s of stories) {
      const key = s.author_id;
      if (!m.has(key)) {
        m.set(key, {
          author_id: s.author_id,
          author_name: s.author?.display_name ?? "Unknown",
          author_avatar: s.author?.avatar_url ?? null,
          stories: [],
          hasUnseen: false,
        });
      }
      const g = m.get(key)!;
      g.stories.push(s);
      if (!seenIds.has(s.id) && s.author_id !== currentUserId) g.hasUnseen = true;
    }
    // Order: own first, then unseen, then seen
    return Array.from(m.values()).sort((a, b) => {
      if (a.author_id === currentUserId) return -1;
      if (b.author_id === currentUserId) return 1;
      if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
      return 0;
    });
  })();

  const markSeen = async (storyId: string) => {
    if (!currentUserId) return;
    if (seenIds.has(storyId)) return;
    setSeenIds((s) => new Set(s).add(storyId));
    await supabase
      .from("story_views")
      .insert({ story_id: storyId, viewer_id: currentUserId })
      // ignore duplicate-key errors silently
      .then(() => {});
  };

  return { stories, groups, loading, refresh: load, markSeen };
}

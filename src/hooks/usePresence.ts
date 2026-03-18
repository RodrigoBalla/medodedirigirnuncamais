import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface OnlineUser {
  user_id: string;
  display_name: string;
  page_path: string;
  last_seen: string;
}

export function usePresenceTracker() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel("online-users", {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {})
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
            page_path: window.location.pathname,
          });
        }
      });

    // Update presence on navigation
    const interval = setInterval(() => {
      channel.track({
        user_id: user.id,
        online_at: new Date().toISOString(),
        page_path: window.location.pathname,
      });
    }, 30000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [user]);
}

export function useOnlineUsers() {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const profilesCache = useRef<Record<string, string>>({});

  useEffect(() => {
    const channel = supabase.channel("online-users-admin");

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const users: OnlineUser[] = [];

        Object.values(state).forEach((presences: any[]) => {
          presences.forEach((p) => {
            users.push({
              user_id: p.user_id,
              display_name: profilesCache.current[p.user_id] || "...",
              page_path: p.page_path || "/",
              last_seen: p.online_at || new Date().toISOString(),
            });
          });
        });

        setOnlineUsers(users);

        // Fetch display names for any unknown users
        const unknownIds = users
          .filter((u) => !profilesCache.current[u.user_id])
          .map((u) => u.user_id);
        
        if (unknownIds.length > 0) {
          supabase
            .from("profiles")
            .select("user_id, display_name")
            .in("user_id", unknownIds)
            .then(({ data }) => {
              if (data) {
                data.forEach((p) => {
                  profilesCache.current[p.user_id] = p.display_name || "Sem nome";
                });
                // Re-trigger with names
                setOnlineUsers((prev) =>
                  prev.map((u) => ({
                    ...u,
                    display_name: profilesCache.current[u.user_id] || u.display_name,
                  }))
                );
              }
            });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return onlineUsers;
}

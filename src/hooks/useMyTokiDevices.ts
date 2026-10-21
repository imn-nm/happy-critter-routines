/**
 * The MyToki handhelds connected to one child (mytoki_devices). Connecting one makes a token here
 * in the browser and saves only its SHA-256: the grown-up sees the token once, to put into the
 * handheld, which then sends it with every request to the mytoki-device function
 * (supabase/functions/mytoki-device).
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** The handheld's Day plan URL and Events URL (both the same function). The project is the one in
 * supabase/config.toml. */
export const MYTOKI_DEVICE_URL = "https://xbtgkklhdhgwxtzbcvgd.supabase.co/functions/v1/mytoki-device";

export interface MyTokiDevice {
  id: string;
  child_id: string;
  name: string;
  created_at: string;
  last_seen_at: string | null;
}

const sha256Hex = async (text: string) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

/** 32 random bytes, URL-safe: "mtk_" and 43 characters. */
const newToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return "mtk_" + btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const useMyTokiDevices = (childId: string) => {
  const [devices, setDevices] = useState<MyTokiDevice[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("mytoki_devices")
      .select("id, child_id, name, created_at, last_seen_at")
      .eq("child_id", childId)
      .order("created_at", { ascending: true });
    if (error) console.error("mytoki devices:", error);
    setDevices((data as MyTokiDevice[]) ?? []);
    setLoading(false);
  }, [childId]);

  useEffect(() => { load(); }, [load]);

  /** Connects a new handheld and returns its token (shown once; only its hash is saved). */
  const connect = async (name = "MyToki") => {
    const token = newToken();
    const { error } = await supabase.from("mytoki_devices").insert({ child_id: childId, name, token_hash: await sha256Hex(token) });
    if (error) throw error;
    await load();
    return token;
  };

  /** The handheld stops getting the day (it shows "Let's reconnect" until connected again). */
  const disconnect = async (id: string) => {
    const { error } = await supabase.from("mytoki_devices").delete().eq("id", id);
    if (error) throw error;
    await load();
  };

  return { devices, loading, connect, disconnect, reload: load };
};

"use client";

import { useEffect, useRef, useState } from "react";
import { PeerMesh, type RemoteMedia } from "@/lib/webrtc";

/**
 * Connects this tab to everyone else in the meeting over WebRTC and returns
 * their audio, camera and screen streams, keyed by participant id.
 */
export function usePeerMesh(me: number, peerIds: number[], local: MediaStream | null, screen: MediaStream | null) {
  const [remote, setRemote] = useState<Record<number, RemoteMedia>>({});
  const mesh = useRef<PeerMesh | null>(null);

  useEffect(() => {
    if (typeof RTCPeerConnection === "undefined") return; // very old browser: no calls, the rest still works
    const m = new PeerMesh(me, setRemote);
    mesh.current = m;
    return () => {
      m.destroy();
      mesh.current = null;
      setRemote({});
    };
  }, [me]);

  // A string key so the effect only runs when the set of people really changes.
  const key = [...peerIds].sort((a, b) => a - b).join(",");
  useEffect(() => {
    mesh.current?.setPeers(key ? key.split(",").map(Number) : []);
  }, [key]);

  useEffect(() => {
    mesh.current?.setLocal(local, screen);
  }, [local, screen]);

  return remote;
}

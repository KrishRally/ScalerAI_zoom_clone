// Real audio, video and screen sharing between people, using WebRTC.
//
// How it works, in short:
// - Every pair of people in a meeting gets one direct browser-to-browser
//   connection (a "mesh"). Fine for small meetings; big ones would need a media server.
// - To connect, browsers swap two notes through our API: an "offer" and an
//   "answer". Each note says what media will be sent and how to reach the
//   sender (its network addresses, found with a STUN server). This swap is
//   called signalling. After that, media flows directly between the browsers.
// - The person with the lower participant id always sends the offer, so two
//   people never offer to each other at the same time.
// - Each connection carries three slots in a fixed order: microphone, camera
//   and screen share. Turning the camera off, switching devices or starting
//   a share just swaps the track in a slot (replaceTrack), so there is no
//   need to renegotiate the connection.

import { api, ApiError } from "@/lib/api";
import type { SignalData } from "@/lib/types";

export type Slot = "audio" | "camera" | "screen";
const SLOTS: Slot[] = ["audio", "camera", "screen"];
const KINDS = ["audio", "video", "video"] as const;

export interface RemoteMedia {
  audio: MediaStream | null;
  camera: MediaStream | null;
  screen: MediaStream | null;
  state: RTCPeerConnectionState;
}

/** Used only if the server can't be asked (old server or network trouble). */
const FALLBACK_ICE: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302"] }];

/** How the calls are doing overall, for messages in the room. */
export interface MeshStatus {
  /** The server has a TURN relay, so strict networks can still connect. */
  hasRelay: boolean;
  /** The server doesn't know about video calls yet (an old version is running). */
  serverOutdated: boolean;
}

// We send each note once, with all network addresses inside, instead of
// trickling them one by one. Simpler with polling; this is the longest we wait.
const GATHER_MAX_MS = 5000; // relay addresses can take a few seconds
// If nobody answers our offer in this time (they may still be joining), offer again.
const ANSWER_TIMEOUT_MS = 10_000;
// An answered connection that still isn't up after this long is started again.
const CONNECT_TIMEOUT_MS = 20_000;
// A connection that drops ("disconnected") and doesn't come back by itself in this time is restarted.
const DROPPED_MS = 6000;
// Check for notes often while a connection is being set up, slowly otherwise.
const POLL_FAST_MS = 700;
const POLL_SLOW_MS = 2500;

interface Peer {
  pc: RTCPeerConnection;
  /** A random id per attempt, so a late answer to an old offer is ignored. */
  session: string;
  offerer: boolean;
  senders: RTCRtpSender[];
  startedAt: number;
  answered: boolean;
  droppedAt: number | null;
}

const newSession = () => Math.random().toString(36).slice(2, 10);

function waitForAddresses(pc: RTCPeerConnection): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();
    const timer = setTimeout(resolve, GATHER_MAX_MS);
    pc.addEventListener("icegatheringstatechange", () => {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

/** All of this browser's connections to the other people in one meeting. */
export class PeerMesh {
  private peers = new Map<number, Peer>();
  private wanted = new Set<number>();
  private remote: Record<number, RemoteMedia> = {};
  private local: MediaStream | null = null;
  private screen: MediaStream | null = null;
  private stopped = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setInterval>;
  private iceServers: RTCIceServer[] = FALLBACK_ICE;
  private relayOnly = false;
  /** Resolves once we know which STUN / TURN servers to use. */
  private ready: Promise<void>;
  private status: MeshStatus = { hasRelay: false, serverOutdated: false };
  private isReady = false;

  constructor(
    private readonly me: number,
    private readonly onChange: (remote: Record<number, RemoteMedia>) => void,
    private readonly onStatus: (status: MeshStatus) => void = () => {},
  ) {
    this.ready = api
      .iceServers(me)
      .then((res) => {
        this.iceServers = res.ice_servers as RTCIceServer[];
        this.relayOnly = res.relay_only;
        this.setStatus({ hasRelay: res.has_relay });
      })
      .catch((e) => {
        if (e instanceof ApiError && (e.status === 404 || e.status === 405)) this.setStatus({ serverOutdated: true });
      });
    this.ready.then(() => {
      this.isReady = true;
      this.poll();
      this.checkConnections(); // start the offers that were waiting
    });
    this.watchdog = setInterval(() => this.checkConnections(), 2000);
  }

  private setStatus(changes: Partial<MeshStatus>) {
    this.status = { ...this.status, ...changes };
    this.onStatus(this.status);
  }

  /** The people (participant ids) who are in the meeting right now, not counting us. */
  setPeers(ids: number[]) {
    this.wanted = new Set(ids.filter((id) => id !== this.me));
    for (const id of Array.from(this.peers.keys())) {
      if (!this.wanted.has(id)) this.close(id);
    }
    if (!this.isReady) return; // offers start once we know the servers
    for (const id of Array.from(this.wanted)) {
      if (!this.peers.has(id) && this.me < id) this.offer(id);
    }
  }

  /** Our camera and mic, and our screen share. Called whenever either changes. */
  setLocal(local: MediaStream | null, screen: MediaStream | null) {
    this.local = local;
    this.screen = screen;
    this.peers.forEach((p) => this.sendTracks(p));
  }

  destroy() {
    this.stopped = true;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    clearInterval(this.watchdog);
    for (const id of Array.from(this.peers.keys())) this.close(id, false);
  }

  // ---------- Media ----------

  private sendTracks(peer: Peer) {
    const tracks = [
      this.local?.getAudioTracks()[0] ?? null,
      this.local?.getVideoTracks()[0] ?? null,
      this.screen?.getVideoTracks()[0] ?? null,
    ];
    peer.senders.forEach((sender, i) => {
      if (sender.track !== tracks[i]) sender.replaceTrack(tracks[i]).catch(() => {});
    });
  }

  private update(id: number, changes: Partial<RemoteMedia>) {
    const before = this.remote[id] ?? { audio: null, camera: null, screen: null, state: "new" as const };
    this.remote = { ...this.remote, [id]: { ...before, ...changes } };
    this.onChange(this.remote);
  }

  // ---------- Connections ----------

  private create(id: number, offerer: boolean, session: string): Peer {
    this.close(id, false);
    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceTransportPolicy: this.relayOnly ? "relay" : "all",
    });
    const peer: Peer = { pc, session, offerer, senders: [], startedAt: Date.now(), answered: false, droppedAt: null };

    pc.ontrack = (e) => {
      // The slot is known from the transceiver's position: 0 mic, 1 camera, 2 screen.
      const slot = SLOTS[pc.getTransceivers().indexOf(e.transceiver)];
      if (slot) this.update(id, { [slot]: new MediaStream([e.track]) });
    };
    pc.onconnectionstatechange = () => {
      if (this.peers.get(id) !== peer) return;
      peer.droppedAt = pc.connectionState === "disconnected" ? peer.droppedAt ?? Date.now() : null;
      this.update(id, { state: pc.connectionState });
    };

    this.peers.set(id, peer);
    this.update(id, { audio: null, camera: null, screen: null, state: "new" });
    return peer;
  }

  private close(id: number, forget = true) {
    const peer = this.peers.get(id);
    if (peer) {
      peer.pc.ontrack = null;
      peer.pc.onconnectionstatechange = null;
      peer.pc.close();
      this.peers.delete(id);
    }
    if (forget && this.remote[id]) {
      const rest = { ...this.remote };
      delete rest[id];
      this.remote = rest;
      this.onChange(this.remote);
    }
  }

  /** We have the lower id: start a connection and send the offer. */
  private async offer(id: number) {
    await this.ready;
    if (this.stopped || !this.wanted.has(id)) return;
    const session = newSession();
    const peer = this.create(id, true, session);
    const { pc } = peer;
    peer.senders = KINDS.map((kind) => pc.addTransceiver(kind, { direction: "sendrecv" }).sender);
    this.sendTracks(peer);
    try {
      await pc.setLocalDescription(await pc.createOffer());
      await waitForAddresses(pc);
      if (this.peers.get(id) !== peer || !pc.localDescription) return;
      await api.sendSignal(this.me, id, { type: "offer", session, sdp: pc.localDescription.sdp });
    } catch {
      // They may have left, or not be in the meeting yet. The watchdog tries again.
    }
  }

  /** Someone with a lower id wants to connect: answer them. */
  private async answer(from: number, data: SignalData) {
    await this.ready;
    const existing = this.peers.get(from);
    if (existing?.session === data.session) return; // already handled this offer
    const peer = this.create(from, false, data.session);
    const { pc } = peer;
    try {
      await pc.setRemoteDescription({ type: "offer", sdp: data.sdp });
      const transceivers = pc.getTransceivers();
      transceivers.forEach((t) => (t.direction = "sendrecv"));
      peer.senders = transceivers.slice(0, 3).map((t) => t.sender);
      this.sendTracks(peer);
      await pc.setLocalDescription(await pc.createAnswer());
      await waitForAddresses(pc);
      if (this.peers.get(from) !== peer || !pc.localDescription) return;
      await api.sendSignal(this.me, from, { type: "answer", session: data.session, sdp: pc.localDescription.sdp });
      peer.answered = true;
    } catch {
      this.close(from);
    }
  }

  private async accept(from: number, data: SignalData) {
    const peer = this.peers.get(from);
    if (!peer || !peer.offerer || peer.session !== data.session) return; // an answer to an old offer
    if (peer.pc.signalingState !== "have-local-offer") return;
    try {
      await peer.pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
      peer.answered = true;
    } catch {
      // Broken answer: the watchdog will start over.
    }
  }

  /** Restart connections that never got an answer or that broke. */
  private checkConnections() {
    if (!this.isReady || this.stopped) return;
    const now = Date.now();
    this.peers.forEach((peer, id) => {
      const state = peer.pc.connectionState;
      const broken =
        state === "failed" ||
        state === "closed" ||
        (peer.droppedAt !== null && now - peer.droppedAt > DROPPED_MS) ||
        (peer.answered && state !== "connected" && now - peer.startedAt > CONNECT_TIMEOUT_MS);
      const ignored = !peer.answered && now - peer.startedAt > ANSWER_TIMEOUT_MS;
      if (peer.offerer && (broken || ignored)) this.offer(id);
      // The other side restarts it; we just wait for their new offer.
      if (!peer.offerer && broken) this.close(id, false);
    });
    // Anyone we should be offering to but aren't (for example after a failed send).
    this.wanted.forEach((id) => {
      if (!this.peers.has(id) && this.me < id) this.offer(id);
    });
  }

  // ---------- Signalling ----------

  private settling() {
    if (this.peers.size < this.wanted.size) return true;
    return Array.from(this.peers.values()).some((p) => p.pc.connectionState !== "connected");
  }

  private async poll() {
    if (this.stopped) return;
    try {
      const notes = await api.takeSignals(this.me);
      for (const note of notes) {
        if (note.data.type === "offer") await this.answer(note.from_id, note.data);
        else if (note.data.type === "answer") await this.accept(note.from_id, note.data);
      }
    } catch (e) {
      // An old server without the signals endpoint: say so instead of trying forever.
      if (e instanceof ApiError && (e.status === 404 || e.status === 405)) this.setStatus({ serverOutdated: true });
      // Otherwise a network hiccup: try again on the next tick.
    }
    if (!this.stopped) this.pollTimer = setTimeout(() => this.poll(), this.settling() ? POLL_FAST_MS : POLL_SLOW_MS);
  }
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { MUSIC_BOARD_ABI } from "@/abi/MusicBoardABI";
import { MusicBoardAddresses } from "@/abi/MusicBoardAddresses";

type Note = {
  id: bigint;
  author: string;
  track: string;
  message: string;
  aliasName: string;
  timestamp: bigint;
  applausePlain?: number;
};

type Status = "idle" | "loading" | "ready" | "error";

export default function Page() {
  const [provider, setProvider] = useState<ethers.BrowserProvider>();
  const [signer, setSigner] = useState<ethers.Signer>();
  const [account, setAccount] = useState<string>();
  const [chainId, setChainId] = useState<number>();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [items, setItems] = useState<Note[]>([]);

  // form
  const [track, setTrack] = useState("");
  const [aliasName, setAliasName] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApplauding, setIsApplauding] = useState<Set<string>>(new Set());

  const [fhevm, setFhevm] = useState<any>();

  const contractAddress = useMemo(() => {
    const entry = MusicBoardAddresses["11155111"] || (chainId ? MusicBoardAddresses[String(chainId) as any] : undefined);
    return entry?.address;
  }, [chainId]);

  const contract = useMemo(() => {
    if (!contractAddress || !signer) return undefined;
    return new ethers.Contract(contractAddress, MUSIC_BOARD_ABI, signer);
  }, [contractAddress, signer]);

  useEffect(() => {
    const setup = async () => {
      if (!(window as any).ethereum) return;
      const prov = new ethers.BrowserProvider((window as any).ethereum);
      setProvider(prov);
      const net = await prov.getNetwork();
      setChainId(Number(net.chainId));
      const s = await prov.getSigner().catch(() => undefined);
      if (s) {
        setSigner(s);
        setAccount(await s.getAddress());
      }
      (window as any).ethereum?.on?.("chainChanged", () => window.location.reload());
      (window as any).ethereum?.on?.("accountsChanged", () => window.location.reload());
    };
    setup();
  }, []);

  useEffect(() => {
    const boot = async () => {
      try {
        setStatus("loading");
        let sdk: any;
        try {
          const mod: any = await import("@zama-fhe/relayer-sdk/bundle");
          sdk = (mod && (mod.initSDK || mod.createInstance)) ? mod : mod?.default;
        } catch {
          sdk = undefined;
        }
        if (!sdk || !sdk.initSDK || !sdk.createInstance) {
          if (typeof window === "undefined") throw new Error("window not available for UMD load");
          if (!(window as any).relayerSDK) {
            await new Promise<void>((resolve, reject) => {
              const script = document.createElement("script");
              script.src = "https://cdn.zama.ai/relayer-sdk-js/0.2.0/relayer-sdk-js.umd.cjs";
              script.async = true;
              script.onload = () => resolve();
              script.onerror = () => reject(new Error("Failed to load Relayer SDK UMD"));
              document.head.appendChild(script);
            });
          }
          sdk = (window as any).relayerSDK;
        }
        await sdk.initSDK();
        const instance = await sdk.createInstance({ ...sdk.SepoliaConfig, network: (window as any).ethereum });
        setFhevm(instance);
        setStatus("ready");
      } catch (e: any) {
        setStatus("error");
        setMessage(String(e?.message || e));
      }
    };
    if (typeof window !== "undefined") boot();
  }, []);

  const connect = async () => {
    if (!(window as any).ethereum) return;
    await (window as any).ethereum.request({ method: "eth_requestAccounts" });
    const prov = new ethers.BrowserProvider((window as any).ethereum);
    const s = await prov.getSigner();
    setSigner(s);
    setAccount(await s.getAddress());
    const net = await prov.getNetwork();
    setChainId(Number(net.chainId));
  };

  const refresh = async () => {
    if (!contractAddress || !provider) return;
    const readonly = new ethers.Contract(contractAddress, MUSIC_BOARD_ABI, provider);
    const list = await readonly.getNotes();
    const arr: Note[] = list.map((x: any) => ({
      id: x.id,
      author: x.author,
      track: x.track,
      message: x.message,
      aliasName: x.aliasName,
      timestamp: x.timestamp,
      applausePlain: x.applausePlain ? Number(x.applausePlain) : 0,
    }));
    arr.sort((a, b) => Number(b.timestamp - a.timestamp));
    setItems(arr);
  };

  useEffect(() => { refresh(); }, [contractAddress]);

  const submit = async () => {
    if (!contract || !track || !note) { setMessage("Please fill track and message"); return; }
    setIsSubmitting(true);
    try {
      const tx = await contract.addNote(track, note, aliasName || "");
      setMessage("Submitting...");
      await tx.wait();
      setMessage("Note published!");
      setTrack(""); setAliasName(""); setNote("");
      setTimeout(() => refresh(), 1200);
    } catch (e: any) {
      setMessage(`Failed: ${e?.message || e}`);
    } finally { setIsSubmitting(false); }
  };

  const applaud = async (id: bigint) => {
    if (!contract || !fhevm || !account) { setMessage("Connect wallet and wait for FHEVM"); return; }
    const idStr = String(id);
    setIsApplauding(prev => new Set([...prev, idStr]));
    try {
      const buffer = fhevm.createEncryptedInput(contract.target as string, account);
      buffer.add32(BigInt(1));
      const enc = await buffer.encrypt();
      const tx = await contract.applaudNote(id, enc.handles[0], enc.inputProof);
      setMessage("Sending applause...");
      await tx.wait();
      setTimeout(() => refresh(), 1000);
    } catch (e: any) {
      setMessage(`Applause failed: ${e?.message || e}`);
    } finally {
      setIsApplauding(prev => { const n = new Set(prev); n.delete(idStr); return n; });
    }
  };

  const decryptApplause = async (id: bigint) => {
    if (!fhevm || !provider || !contractAddress) { setMessage("FHEVM not ready"); return; }
    try {
      const readonly = new ethers.Contract(contractAddress, MUSIC_BOARD_ABI, provider);
      const handle = await readonly.getApplauseHandle(id);
      let clear;
      if (typeof fhevm.decrypt === 'function') {
        try { clear = await fhevm.decrypt(contractAddress, handle); }
        catch { if (typeof fhevm.decryptPublic === 'function') clear = await fhevm.decryptPublic(contractAddress, handle); }
      } else if (typeof fhevm.decryptPublic === 'function') {
        clear = await fhevm.decryptPublic(contractAddress, handle);
      }
      if (clear === undefined) { setMessage(`Handle: ${String(handle)}`); return; }
      setMessage(`Applause: ${String(clear)}`);
    } catch (e: any) {
      setMessage(`Decrypt failed: ${e?.message || e}`);
    }
  };

  return (
    <div className="container">
      <header className="header">
        <div>
          <div className="title">MusicBoard</div>
          <div className="subtitle">Leave a note about your favorite tracks. Encrypted applause included.</div>
        </div>
        <div className="row right">
          <div className={`status ${status === 'ready' ? 'ready' : status === 'loading' ? 'loading' : status === 'error' ? 'error' : ''}`}>
            <span>SDK</span>
          </div>
          {!account ? (
            <button className="btn" onClick={connect}>Connect Wallet</button>
          ) : (
            <span className="badge">{account.slice(0,6)}...{account.slice(-4)} | {chainId === 11155111 ? 'Sepolia' : `Chain ${chainId}`}</span>
          )}
        </div>
      </header>

      {message && (<div className="panel" style={{marginBottom:12}}>{message}</div>)}

      <section className="grid" style={{marginBottom: 16}}>
        <div className="panel">
          <div className="row" style={{marginBottom: 10}}>
            <div className="badge">Publish Note</div>
          </div>
          <div className="spacer" />
          <label>Track Title</label>
          <input value={track} onChange={(e) => setTrack(e.target.value)} placeholder="e.g. Nujabes - Luv(sic) pt3" maxLength={100} />
          <div className="spacer" />
          <label>Alias (optional)</label>
          <input value={aliasName} onChange={(e) => setAliasName(e.target.value)} maxLength={64} placeholder="Your alias" />
          <div className="spacer" />
          <label>Message</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={240} placeholder="Why do you love this track?" />
          <div className="spacer" />
          <button className="btn" disabled={!track || !note || isSubmitting} onClick={submit}>
            {isSubmitting ? "Publishing..." : "Publish"}
          </button>
        </div>

        <div className="panel">
          <div className="row header">
            <div className="badge">All Notes</div>
            <button className="btn ghost" onClick={refresh}>Refresh</button>
          </div>
          <div className="list">
            {items.map((it) => (
              <div className="card" key={String(it.id)}>
                <div className="row" style={{justifyContent:'space-between'}}>
                  <div className="row" style={{gap:8}}>
                    <span className="tag">{it.aliasName || `${it.author.slice(0,6)}...${it.author.slice(-4)}`}</span>
                    <span className="muted">{new Date(Number(it.timestamp) * 1000).toLocaleString()}</span>
                  </div>
                  <span className="badge">{it.track}</span>
                </div>
                <div className="spacer" />
                <div className="note">{it.message}</div>
                <div className="spacer" />
                <div className="row">
                  <button className="btn alt" onClick={() => applaud(it.id)} disabled={isApplauding.has(String(it.id))}>{isApplauding.has(String(it.id)) ? "Applauding..." : `Applaud ${it.applausePlain ? `(${it.applausePlain})` : ""}`}</button>
                  <button className="btn ghost" onClick={() => decryptApplause(it.id)}>Decrypt Applause</button>
                </div>
              </div>
            ))}
            {items.length === 0 && (<div className="muted">No notes yet. Be the first.</div>)}
          </div>
        </div>
      </section>
    </div>
  );
}



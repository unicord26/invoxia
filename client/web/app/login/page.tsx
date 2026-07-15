"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { COUNTRIES, DEFAULT_COUNTRY, type Country } from "../../lib/countries";

// ─── Country Code Selector ───────────────────────────────────────────────────
function CountrySelect({ value, onChange }: { value: Country; onChange: (c: Country) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const needle = q.trim().toLowerCase();
  const list = needle
    ? COUNTRIES.filter(
        (c) => c.name.toLowerCase().includes(needle) || c.dial.includes(needle) || c.iso.toLowerCase() === needle,
      )
    : COUNTRIES;

  return (
    <div className="lx-cc-wrap" ref={wrapRef}>
      <button type="button" className="lx-cc-btn" onClick={() => setOpen((v) => !v)} aria-label="Select country code">
        <span style={{ fontSize: 18, lineHeight: 1 }}>{value.flag}</span>
        <span style={{ fontWeight: 600, fontSize: 13 }}>+{value.dial}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="lx-cc-dropdown">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search country…"
            className="lx-cc-search"
          />
          <div className="lx-cc-list">
            {list.map((c) => (
              <button
                key={c.iso}
                type="button"
                className="lx-cc-item"
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                  setQ("");
                }}
              >
                <span style={{ fontSize: 18 }}>{c.flag}</span>
                <span style={{ flex: 1, textAlign: "left" }}>{c.name}</span>
                <span style={{ color: "#6b7280", fontWeight: 600 }}>+{c.dial}</span>
              </button>
            ))}
            {list.length === 0 && <div className="lx-cc-empty">No matches</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Falling Leaves Canvas ───────────────────────────────────────────────────
function LeavesBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth ?? window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight ?? window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Leaf shapes & light themes colors
    const leafColors = [
      "rgba(22,163,74,0.60)",
      "rgba(16,120,60,0.55)",
      "rgba(74,222,128,0.55)",
      "rgba(6,95,70,0.50)",
      "rgba(134,239,172,0.50)",
      "rgba(21,128,61,0.58)",
      "rgba(187,247,208,0.45)",
    ];

    interface Leaf {
      x: number;
      y: number;
      size: number;
      speedY: number;
      speedX: number;
      rot: number;
      rotSpeed: number;
      color: string;
      sway: number;
      swaySpeed: number;
      swayOffset: number;
    }

    function makeLeaf(): Leaf {
      const parentWidth = canvas?.parentElement?.clientWidth ?? window.innerWidth;
      return {
        x: Math.random() * parentWidth,
        y: -20 - Math.random() * 100,
        size: 8 + Math.random() * 14,
        speedY: 0.6 + Math.random() * 1.0,
        speedX: (Math.random() - 0.5) * 0.4,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.025,
        color: leafColors[Math.floor(Math.random() * leafColors.length)]!,
        sway: 18 + Math.random() * 30,
        swaySpeed: 0.008 + Math.random() * 0.012,
        swayOffset: Math.random() * Math.PI * 2,
      };
    }

    function drawLeaf(ctx: CanvasRenderingContext2D, leaf: Leaf, t: number) {
      ctx.save();
      const sx = leaf.x + Math.sin(t * leaf.swaySpeed + leaf.swayOffset) * leaf.sway;
      ctx.translate(sx, leaf.y);
      ctx.rotate(leaf.rot);
      ctx.fillStyle = leaf.color;
      ctx.beginPath();
      ctx.moveTo(0, -leaf.size);
      ctx.bezierCurveTo(leaf.size * 0.6, -leaf.size * 0.5, leaf.size, leaf.size * 0.3, 0, leaf.size);
      ctx.bezierCurveTo(-leaf.size, leaf.size * 0.3, -leaf.size * 0.6, -leaf.size * 0.5, 0, -leaf.size);
      ctx.fill();

      // Midrib
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, -leaf.size * 0.8);
      ctx.lineTo(0, leaf.size * 0.8);
      ctx.stroke();
      ctx.restore();
    }

    const LEAF_COUNT = 20;
    const leaves: Leaf[] = Array.from({ length: LEAF_COUNT }, makeLeaf).map((l) => ({
      ...l,
      y: Math.random() * (canvas?.parentElement?.clientHeight ?? window.innerHeight),
    }));

    let t = 0;
    function animate() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t++;
      const parentHeight = canvas.parentElement?.clientHeight ?? window.innerHeight;
      for (const leaf of leaves) {
        leaf.y += leaf.speedY;
        leaf.x += leaf.speedX;
        leaf.rot += leaf.rotSpeed;
        if (leaf.y > parentHeight + 30) {
          Object.assign(leaf, makeLeaf());
        }
        drawLeaf(ctx, leaf, t);
      }
      animId = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}

// ─── Login Page ───────────────────────────────────────────────────────────────
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
const ORG_TYPES = ["Retailer", "Wholesaler", "Distributor", "Manufacturer", "Service Provider", "Other"];
const post = (path: string, body: unknown) =>
  fetch(`${API}/api/auth${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json().then((d) => ({ ok: r.ok, d })));

export default function LoginPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [signUpStep, setSignUpStep] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // login state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // signup state
  const [f, setF] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    orgType: "Retailer",
    orgName: "",
    suUsername: "",
    suPassword: "",
    confirm: "",
  });
  const [unameFree, setUnameFree] = useState<boolean | null>(null);
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);

  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function setSessionFromLogin(u: string, p: string) {
    const { ok, d } = await post("/login", { username: u, password: p });
    if (!ok || !d.access_token) {
      setError(
        d.error === "email_not_confirmed"
          ? "Please confirm your email first — check your inbox for the verification link."
          : "Invalid username or password.",
      );
      return false;
    }
    await supabase.auth.setSession({ access_token: d.access_token, refresh_token: d.refresh_token });
    return true;
  }

  async function doLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    await setSessionFromLogin(username.trim().toLowerCase(), password);
    setBusy(false);
  }

  async function checkUsername() {
    const u = f.suUsername.trim().toLowerCase();
    if (u.length < 3) return setUnameFree(null);
    const { d } = await post("/username-available", { username: u });
    setUnameFree(d.available);
  }

  async function doRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (f.suPassword.length < 6) return setError("Password must be at least 6 characters.");
    if (f.suPassword !== f.confirm) return setError("Passwords do not match.");
    if (unameFree === false) return setError("That username is taken.");
    setBusy(true);
    const phoneDigits = f.phone.replace(/\D/g, "");
    const { ok, d } = await post("/register", {
      firstName: f.firstName,
      lastName: f.lastName,
      phone: phoneDigits ? `+${country.dial}${phoneDigits}` : "",
      email: f.email,
      username: f.suUsername,
      orgType: f.orgType,
      orgName: f.orgName,
      password: f.suPassword,
    });
    if (!ok) {
      setBusy(false);
      return setError(
        d.error === "username_taken"
          ? "That username is taken."
          : d.error === "email_taken"
            ? "An account with that email already exists."
            : "Could not create account: " + (d.error ?? "error"),
      );
    }
    setBusy(false);
    // Accounts are created pre-confirmed (no email verification) — sign in directly.
    await setSessionFromLogin(f.suUsername.trim().toLowerCase(), f.suPassword);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background-color: #f4f8f5;
          font-family: 'Inter', sans-serif;
        }

        .lx-layout-root {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr;
        }

        @media (min-width: 1024px) {
          .lx-layout-root {
            grid-template-columns: 1.1fr 0.9fr;
          }
        }

        /* Left Split Panel (Visual branding zone, only on Desktop) */
        .lx-branding-panel {
          display: none;
          position: relative;
          background: linear-gradient(135deg, #0d2818 0%, #061c0f 50%, #020a05 100%);
          flex-direction: column;
          justify-content: space-between;
          padding: 60px;
          overflow: hidden;
        }

        @media (min-width: 1024px) {
          .lx-branding-panel {
            display: flex;
          }
        }

        /* Subtle organic ambient light blobs */
        .lx-branding-panel::before {
          content: '';
          position: absolute;
          width: 500px;
          height: 500px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(34,197,94,0.12) 0%, transparent 70%);
          top: -100px;
          left: -100px;
          pointer-events: none;
        }

        .lx-branding-panel::after {
          content: '';
          position: absolute;
          width: 600px;
          height: 600px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(21,128,61,0.08) 0%, transparent 80%);
          bottom: -200px;
          right: -100px;
          pointer-events: none;
        }

        .lx-branding-header {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .lx-branding-logo {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 24px rgba(0,0,0,0.25);
          overflow: hidden;
        }

        .lx-branding-logo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .lx-branding-logo-text h2 {
          font-size: 20px;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: -0.3px;
          line-height: 1;
        }

        .lx-branding-logo-text p {
          font-size: 12px;
          color: rgba(255,255,255,0.45);
          margin-top: 4px;
        }

        .lx-branding-content {
          position: relative;
          z-index: 2;
          max-width: 480px;
          margin: auto 0;
        }

        .lx-branding-tag {
          display: inline-block;
          font-size: 11px;
          font-weight: 600;
          color: #4ade80;
          background: rgba(74,222,128,0.1);
          padding: 6px 12px;
          border-radius: 20px;
          margin-bottom: 20px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .lx-branding-title {
          font-size: 38px;
          font-weight: 600;
          color: #f0fdf4;
          line-height: 1.25;
          letter-spacing: -1px;
          margin-bottom: 16px;
        }

        .lx-branding-desc {
          font-size: 16px;
          color: rgba(240,253,244,0.7);
          line-height: 1.6;
          margin-bottom: 32px;
        }

        .lx-feature-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .lx-feature-item {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 14px;
          color: rgba(240,253,244,0.85);
        }

        .lx-feature-check {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          background: rgba(74,222,128,0.15);
          border-radius: 50%;
          color: #4ade80;
          flex-shrink: 0;
        }

        .lx-branding-footer {
          position: relative;
          z-index: 2;
          font-size: 12px;
          color: rgba(255,255,255,0.3);
        }

        /* Right Panel (Forms wrapper) */
        .lx-form-panel {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          position: relative;
        }

        /* Full page leaves visual on Mobile fallback, standard canvas in branding pane on desktop */
        .lx-mobile-canvas-wrap {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }

        @media (min-width: 1024px) {
          .lx-mobile-canvas-wrap {
            display: none;
          }
        }

        .lx-card {
          width: 100%;
          max-width: 440px;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.7);
          border-radius: 24px;
          padding: 40px;
          box-shadow:
            0 10px 40px -10px rgba(0,0,0,0.04),
            0 20px 50px -20px rgba(22,163,74,0.05),
            0 0 0 1px rgba(22,163,74,0.04);
          position: relative;
          z-index: 1;
        }

        @media (max-width: 640px) {
          .lx-card {
            padding: 30px 20px;
          }
        }

        /* Header for Card (Mainly visible on mobile) */
        .lx-card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }

        @media (min-width: 1024px) {
          .lx-card-header {
            display: none; /* Hide since desktop has split panel logo */
          }
        }

        /* Steps Stepper Bar */
        .lx-stepper {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 24px;
        }

        .lx-step-pill {
          flex: 1;
          height: 4px;
          background: #e5e7eb;
          border-radius: 2px;
          transition: background-color 0.3s ease;
        }

        .lx-step-pill.active {
          background: linear-gradient(135deg, #16a34a, #22c55e);
        }

        .lx-step-indicator {
          font-size: 11px;
          font-weight: 600;
          color: #16a34a;
          margin-left: 8px;
          white-space: nowrap;
        }

        /* Typography */
        .lx-heading {
          font-size: 26px;
          font-weight: 600;
          color: #111827;
          letter-spacing: -0.5px;
          margin-bottom: 6px;
        }

        .lx-subheading {
          font-size: 14px;
          color: #6b7280;
          margin-bottom: 32px;
        }

        /* Input Controls */
        .lx-field-group {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }

        @media (min-width: 480px) {
          .lx-field-group.cols-2 {
            grid-template-columns: 1fr 1fr;
          }
        }

        .lx-field {
          position: relative;
        }

        .lx-label {
          display: block;
          font-size: 12px;
          font-weight: 500;
          color: #374151;
          margin-bottom: 6px;
          letter-spacing: 0.1px;
        }

        .lx-input-wrap {
          position: relative;
        }

        .lx-input {
          width: 100%;
          height: 44px;
          padding: 0 14px;
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 12px;
          font-size: 14px;
          color: #111827;
          font-family: 'Inter', sans-serif;
          outline: none;
          transition: all 0.2s ease;
        }

        .lx-input::placeholder {
          color: #9ca3af;
        }

        .lx-input:focus {
          border-color: #22c55e;
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(34,197,94,0.1);
        }

        .lx-input:disabled {
          background-color: #f3f4f6;
          color: #9ca3af;
          cursor: not-allowed;
        }

        .lx-input-btn-wrap {
          display: flex;
          gap: 8px;
        }

        /* Phone row: country selector + number */
        .lx-phone-row {
          display: flex;
          gap: 8px;
          align-items: stretch;
        }

        .lx-cc-wrap {
          position: relative;
          flex-shrink: 0;
        }

        .lx-cc-btn {
          height: 44px;
          padding: 0 12px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 12px;
          cursor: pointer;
          color: #111827;
          font-family: 'Inter', sans-serif;
          transition: all 0.2s ease;
        }

        .lx-cc-btn:hover {
          border-color: #22c55e;
        }

        .lx-cc-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          z-index: 20;
          width: 300px;
          max-width: 78vw;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 16px 40px -12px rgba(0,0,0,0.2);
          overflow: hidden;
        }

        .lx-cc-search {
          width: 100%;
          height: 42px;
          padding: 0 14px;
          border: none;
          border-bottom: 1px solid #eef2f0;
          outline: none;
          font-size: 14px;
          font-family: 'Inter', sans-serif;
          color: #111827;
        }

        .lx-cc-list {
          max-height: 240px;
          overflow-y: auto;
        }

        .lx-cc-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 13.5px;
          color: #374151;
          font-family: 'Inter', sans-serif;
          transition: background 0.12s ease;
        }

        .lx-cc-item:hover {
          background: #f0fdf4;
        }

        .lx-cc-empty {
          padding: 16px;
          text-align: center;
          font-size: 13px;
          color: #9ca3af;
        }

        /* Secondary actions/inline verification buttons */
        .lx-inline-btn {
          height: 44px;
          padding: 0 16px;
          border-radius: 12px;
          border: 1px solid rgba(22,163,74,0.2);
          background: rgba(34,197,94,0.06);
          color: #15803d;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          white-space: nowrap;
        }

        .lx-inline-btn:hover:not(:disabled) {
          background: rgba(34,197,94,0.12);
          border-color: rgba(22,163,74,0.3);
        }

        .lx-inline-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Password input icon overlay */
        .lx-input.has-right-icon {
          padding-right: 44px;
        }

        .lx-right-btn {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #9ca3af;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          transition: all 0.2s ease;
        }

        .lx-right-btn:hover {
          color: #4b5563;
          background: rgba(0,0,0,0.05);
        }

        .lx-verified-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: #16a34a;
          font-size: 11px;
          font-weight: 600;
          margin-top: 4px;
        }

        .lx-taken-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: #dc2626;
          font-size: 11px;
          font-weight: 600;
          margin-top: 4px;
        }

        /* DEV Otp Hint block */
        .lx-dev-otp-hint {
          margin-top: 6px;
          padding: 8px 12px;
          background: #fef08a;
          color: #854d0e;
          border-radius: 8px;
          font-size: 11.5px;
          display: flex;
          align-items: center;
          gap: 6px;
          border: 1px solid #fef08a;
        }

        /* Messages */
        .lx-message {
          margin-bottom: 20px;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 13px;
          display: flex;
          align-items: flex-start;
          gap: 8px;
          line-height: 1.4;
        }

        .lx-message.error {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fee2e2;
        }

        .lx-message.info {
          background: #f0fdf4;
          color: #15803d;
          border: 1px solid #dcfce7;
        }

        .lx-message svg {
          flex-shrink: 0;
          margin-top: 2px;
        }

        /* Buttons styles */
        .lx-btn {
          width: 100%;
          height: 48px;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          font-size: 15px;
          font-weight: 600;
          font-family: 'Inter', sans-serif;
          background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%);
          color: #ffffff;
          box-shadow: 0 4px 18px rgba(34,197,94,0.25);
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }

        .lx-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(34,197,94,0.35);
        }

        .lx-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .lx-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .lx-btn.secondary {
          background: #ffffff;
          color: #374151;
          border: 1px solid #d1d5db;
          box-shadow: none;
        }

        .lx-btn.secondary:hover:not(:disabled) {
          background: #f9fafb;
          border-color: #c0c4cc;
          box-shadow: none;
          transform: none;
        }

        .lx-btn-shimmer {
          position: absolute;
          top: 0; left: -100%; width: 60%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          animation: shimmer 1.5s infinite;
        }

        /* Footer switch triggers */
        .lx-toggle {
          text-align: center;
          font-size: 14px;
          color: #6b7280;
          margin-top: 24px;
        }

        .lx-toggle button {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          color: #16a34a;
          font-family: 'Inter', sans-serif;
          padding: 0;
          margin-left: 4px;
          transition: color 0.2s;
        }

        .lx-toggle button:hover {
          color: #15803d;
          text-decoration: underline;
        }

        .lx-divider {
          height: 1px;
          background: #e5e7eb;
          margin: 24px 0;
        }

        /* Autofill Overrides */
        .lx-input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 1000px #ffffff inset !important;
          -webkit-text-fill-color: #111827 !important;
        }
      `}</style>

      <div className="lx-layout-root">
        {/* Left branding panel (Desktop only) */}
        <div className="lx-branding-panel">
          <LeavesBackground />

          <div className="lx-branding-header">
            <div className="lx-branding-logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Invoixe" />
            </div>
            <div className="lx-branding-logo-text">
              <h2>Invoixe</h2>
              <p>GST Billing &amp; Accounting</p>
            </div>
          </div>

          <div className="lx-branding-content">
            <span className="lx-branding-tag">Seamless SME Operations</span>
            <h1 className="lx-branding-title">Simplify your invoicing &amp; bookkeeping.</h1>
            <p className="lx-branding-desc">
              Join thousands of businesses who trust Invoixe to manage their GST returns, sales records, purchases, inventory, and clients.
            </p>

            <div className="lx-feature-list">
              <div className="lx-feature-item">
                <span className="lx-feature-check">✓</span>
                Instant automated GST Invoice generation
              </div>
              <div className="lx-feature-item">
                <span className="lx-feature-check">✓</span>
                Interactive stocks and items inventory tracking
              </div>
              <div className="lx-feature-item">
                <span className="lx-feature-check">✓</span>
                Comprehensive banking and expense ledgers
              </div>
            </div>
          </div>

          <div className="lx-branding-footer">
            © {new Date().getFullYear()} Invoixe Technologies. All rights reserved.
          </div>
        </div>

        {/* Right side form panel */}
        <div className="lx-form-panel">
          {/* Mobile Background Leaves (hidden on desktop) */}
          <div className="lx-mobile-canvas-wrap">
            <LeavesBackground />
          </div>

          <div className="lx-card">
            {/* Header for Mobile only */}
            <div className="lx-card-header">
              <div className="lx-branding-logo" style={{ width: 40, height: 40, borderRadius: 10 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="Invoixe" />
              </div>
              <div className="lx-branding-logo-text">
                <h2 style={{ fontSize: 16, color: "#111827" }}>Invoixe</h2>
                <p style={{ fontSize: 10 }}>GST Billing &amp; Accounting</p>
              </div>
            </div>

            {(
            <>
            {/* Form headings */}
            <h2 className="lx-heading">
              {mode === "in" ? "Welcome back" : "Create account"}
            </h2>
            <p className="lx-subheading">
              {mode === "in" ? "Please sign in to continue." : "Let's set up your business workspace."}
            </p>

            {/* Stepper bar for signup */}
            {mode === "up" && (
              <div className="lx-stepper">
                <div className={`lx-step-pill active`} />
                <div className={`lx-step-pill ${signUpStep === 2 ? "active" : ""}`} />
                <span className="lx-step-indicator">Step {signUpStep} of 2</span>
              </div>
            )}

            {/* System Info/Error alerts */}
            {error && (
              <div className="lx-message error">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <div>{error}</div>
              </div>
            )}
            {info && (
              <div className="lx-message info">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <div>{info}</div>
              </div>
            )}

            <form onSubmit={mode === "in" ? doLogin : doRegister}>
              {mode === "in" ? (
                /* ── LOGIN FORM ── */
                <>
                  <div className="lx-field-group">
                    <div className="lx-field">
                      <label className="lx-label">Username</label>
                      <div className="lx-input-wrap">
                        <input
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          required
                          placeholder="Enter your username"
                          className="lx-input"
                          autoComplete="username"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="lx-field-group" style={{ marginBottom: 24 }}>
                    <div className="lx-field">
                      <label className="lx-label">Password</label>
                      <div className="lx-input-wrap">
                        <input
                          type={showPass ? "text" : "password"}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="lx-input has-right-icon"
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          className="lx-right-btn"
                          onClick={() => setShowPass((v) => !v)}
                          aria-label="Toggle password visibility"
                        >
                          {showPass ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                              <line x1="1" y1="1" x2="23" y2="23"/>
                            </svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                              <circle cx="12" cy="12" r="3"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button type="submit" disabled={busy} className="lx-btn">
                    {busy && <span className="lx-btn-shimmer" />}
                    {busy ? "Signing in..." : "Sign in to account"}
                  </button>
                </>
              ) : (
                /* ── SIGNUP FORM (MULTI-STEP) ── */
                <>
                  {signUpStep === 1 ? (
                    /* Step 1: Personal & Verification */
                    <>
                      <div className="lx-field-group cols-2">
                        <div className="lx-field">
                          <label className="lx-label">First name</label>
                          <input
                            value={f.firstName}
                            onChange={(e) => set("firstName", e.target.value)}
                            required
                            placeholder="John"
                            className="lx-input"
                          />
                        </div>
                        <div className="lx-field">
                          <label className="lx-label">Last name</label>
                          <input
                            value={f.lastName}
                            onChange={(e) => set("lastName", e.target.value)}
                            placeholder="Doe"
                            className="lx-input"
                          />
                        </div>
                      </div>

                      <div className="lx-field-group">
                        <div className="lx-field">
                          <label className="lx-label">Phone Number</label>
                          <div className="lx-phone-row">
                            <CountrySelect value={country} onChange={setCountry} />
                            <input
                              value={f.phone}
                              onChange={(e) => set("phone", e.target.value.replace(/[^\d]/g, ""))}
                              placeholder="9876543210"
                              className="lx-input"
                              inputMode="numeric"
                              style={{ flex: 1 }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="lx-field-group" style={{ marginBottom: 24 }}>
                        <div className="lx-field">
                          <label className="lx-label">Email address</label>
                          <input
                            type="email"
                            value={f.email}
                            onChange={(e) => set("email", e.target.value)}
                            required
                            placeholder="john@example.com"
                            className="lx-input"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          if (!f.firstName) return setError("First name is required.");
                          if (!f.email.trim()) return setError("Email address is required.");
                          setSignUpStep(2);
                        }}
                        className="lx-btn"
                      >
                        Next Step
                      </button>
                    </>
                  ) : (
                    /* Step 2: Business & Security */
                    <>
                      <div className="lx-field-group cols-2">
                        <div className="lx-field">
                          <label className="lx-label">Org Type</label>
                          <select
                            value={f.orgType}
                            onChange={(e) => set("orgType", e.target.value)}
                            className="lx-input"
                          >
                            {ORG_TYPES.map((o) => (
                              <option key={o}>{o}</option>
                            ))}
                          </select>
                        </div>
                        <div className="lx-field">
                          <label className="lx-label">Org Name</label>
                          <input
                            value={f.orgName}
                            onChange={(e) => set("orgName", e.target.value)}
                            required
                            placeholder="My Business Ltd."
                            className="lx-input"
                          />
                        </div>
                      </div>

                      <div className="lx-field-group">
                        <div className="lx-field">
                          <label className="lx-label">
                            Choose Username
                            {unameFree === true && <span className="lx-verified-badge"> · available</span>}
                            {unameFree === false && <span className="lx-taken-badge"> · taken</span>}
                          </label>
                          <input
                            value={f.suUsername}
                            onChange={(e) => {
                              set("suUsername", e.target.value);
                              setUnameFree(null);
                            }}
                            onBlur={checkUsername}
                            required
                            placeholder="username"
                            className="lx-input"
                            autoComplete="username"
                          />
                        </div>
                      </div>

                      <div className="lx-field-group cols-2" style={{ marginBottom: 24 }}>
                        <div className="lx-field">
                          <label className="lx-label">Password</label>
                          <div className="lx-input-wrap">
                            <input
                              type={showPass ? "text" : "password"}
                              value={f.suPassword}
                              onChange={(e) => set("suPassword", e.target.value)}
                              minLength={6}
                              required
                              placeholder="••••••••"
                              className="lx-input has-right-icon"
                              autoComplete="new-password"
                            />
                            <button
                              type="button"
                              className="lx-right-btn"
                              onClick={() => setShowPass((v) => !v)}
                              aria-label="Toggle password visibility"
                            >
                              {showPass ? (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                                  <line x1="1" y1="1" x2="23" y2="23"/>
                                </svg>
                              ) : (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                  <circle cx="12" cy="12" r="3"/>
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="lx-field">
                          <label className="lx-label">Confirm Password</label>
                          <input
                            type={showPass ? "text" : "password"}
                            value={f.confirm}
                            onChange={(e) => set("confirm", e.target.value)}
                            required
                            placeholder="••••••••"
                            className="lx-input"
                            autoComplete="new-password"
                          />
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 12 }}>
                        <button
                          type="button"
                          onClick={() => setSignUpStep(1)}
                          className="lx-btn secondary"
                          style={{ flex: 0.4 }}
                        >
                          Back
                        </button>
                        <button type="submit" disabled={busy} className="lx-btn" style={{ flex: 0.6 }}>
                          {busy && <span className="lx-btn-shimmer" />}
                          {busy ? "Registering..." : "Create workspace"}
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}

              <p className="lx-toggle">
                {mode === "in" ? "New to Invoixe?" : "Already have an account?"}
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === "in" ? "up" : "in");
                    setSignUpStep(1);
                    setError(null);
                    setInfo(null);
                  }}
                >
                  {mode === "in" ? "Create one" : "Sign in"}
                </button>
              </p>
            </form>
            </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

"use client";

import { useEffect, useRef, ReactNode } from "react";

interface HeroVideoProps {
  src: string;
  /** Smaller encode served to phones (≤768px wide). */
  mobileSrc?: string;
  poster?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: ReactNode;
}

/**
 * Full-screen autoplay hero. Replaces the old scroll-scrubbed ScrollVideo,
 * which had to download the whole file before showing anything and
 * seeked the decoder on every scroll frame (laggy on PC + mobile).
 *
 * The forward-then-reverse "boomerang" is baked into the file itself
 * (ffmpeg command noted in next.config.ts), so a native `loop` gives a
 * seamless ping-pong with zero JS — browsers can't play video backwards
 * smoothly, so reversing at runtime isn't an option.
 *
 * The poster shows instantly while the first bytes stream in; the file
 * is encoded with +faststart so playback begins before it's fully loaded.
 */
export default function HeroVideo({ src, mobileSrc, poster, className = "", style, children }: HeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Respect reduced-motion: leave the poster frame up.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.pause();
      return;
    }

    // Some mobile browsers ignore the autoplay attribute until a gesture
    // or a nudge — try once on mount, then once on first touch.
    const tryPlay = () => { video.play().catch(() => {}); };
    tryPlay();
    document.addEventListener("touchstart", tryPlay, { once: true, passive: true });
    return () => document.removeEventListener("touchstart", tryPlay);
  }, []);

  return (
    // Fills the viewport below the fixed 5rem navbar (layout's <main> has
    // pt-20), so the bottom CTAs are visible without scrolling.
    <div className={`relative h-[calc(100svh-5rem)] w-full overflow-hidden bg-dark ${className}`} style={style}>
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster={poster}
        className="absolute inset-0 w-full h-full object-cover"
      >
        {mobileSrc && <source src={mobileSrc} type="video/mp4" media="(max-width: 768px)" />}
        <source src={src} type="video/mp4" />
      </video>

      {children}
    </div>
  );
}

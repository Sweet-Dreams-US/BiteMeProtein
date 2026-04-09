"use client";

import { useEffect, useRef, useState, ReactNode } from "react";
import Image from "next/image";

interface ScrollVideoProps {
  src: string;
  poster?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: ReactNode;
}

export default function ScrollVideo({ src, poster, className = "", style, children }: ScrollVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const rafRef = useRef<number>(0);

  // Load video — retry on mobile
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoaded = () => setLoaded(true);
    const onError = () => {
      // Retry once on error (mobile often fails first attempt)
      setTimeout(() => {
        video.load();
      }, 1000);
    };
    const onStalled = () => {
      // If stalled, try triggering play then pause to force buffer
      video.play().then(() => video.pause()).catch(() => {});
    };

    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("error", onError);
    video.addEventListener("stalled", onStalled);

    // If already loaded (cached)
    if (video.readyState >= 2) setLoaded(true);

    // Force load on mobile — touch to trigger
    const touchLoad = () => {
      if (!loaded) {
        video.load();
        video.play().then(() => video.pause()).catch(() => {});
      }
    };
    document.addEventListener("touchstart", touchLoad, { once: true });

    // Timeout fallback — if not loaded in 8s, show poster
    const timeout = setTimeout(() => {
      if (!loaded) setFailed(true);
    }, 8000);

    return () => {
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("error", onError);
      video.removeEventListener("stalled", onStalled);
      clearTimeout(timeout);
    };
  }, [loaded]);

  // Scroll-linked playback
  useEffect(() => {
    const video = videoRef.current;
    const section = sectionRef.current;
    if (!video || !section || !loaded || !video.duration) return;

    const update = () => {
      const rect = section.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) return;

      const scrolled = -rect.top;
      const progress = Math.max(0, Math.min(1, scrolled / scrollable));
      const target = progress * video.duration;

      if (Math.abs(video.currentTime - target) > 0.02) {
        video.currentTime = target;
      }

      rafRef.current = requestAnimationFrame(update);
    };

    rafRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafRef.current);
  }, [loaded]);

  return (
    <div ref={sectionRef} className={className} style={style}>
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* The video */}
        <video
          ref={videoRef}
          src={src}
          muted
          playsInline
          preload="auto"
          poster={poster}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ display: loaded ? "block" : "none" }}
        />

        {/* Poster fallback for mobile when video won't load */}
        {(!loaded && poster) && (
          <Image
            src={poster}
            alt=""
            fill
            className="object-cover"
            priority
          />
        )}

        {/* Loading state — only show spinner if no poster */}
        {!loaded && !poster && !failed && (
          <div className="absolute inset-0 bg-cream flex items-center justify-center z-30">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-burgundy border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-dark/30 text-xs">Loading video...</p>
            </div>
          </div>
        )}

        {/* Children (overlays, text, etc.) */}
        {children}
      </div>
    </div>
  );
}

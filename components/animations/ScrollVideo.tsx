"use client";

import { useEffect, useRef, useState, ReactNode } from "react";

interface ScrollVideoProps {
  src: string;
  poster?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: ReactNode;
}

export default function ScrollVideo({ src, className = "", style, children }: ScrollVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const rafRef = useRef<number>(0);
  const currentTimeRef = useRef<number>(0);

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

    return () => {
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("error", onError);
      video.removeEventListener("stalled", onStalled);
    };
  }, [loaded]);

  // Scroll-linked playback with smooth interpolation
  // On Mac, direct seeks are fast (hardware VideoToolbox).
  // On Windows/PC, seeks are slower — lerp smooths it out so we
  // don't hammer the decoder with a seek every single frame.
  useEffect(() => {
    const video = videoRef.current;
    const section = sectionRef.current;
    if (!video || !section || !loaded || !video.duration) return;

    currentTimeRef.current = video.currentTime;

    const update = () => {
      const rect = section.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) {
        rafRef.current = requestAnimationFrame(update);
        return;
      }

      const scrolled = -rect.top;
      const progress = Math.max(0, Math.min(1, scrolled / scrollable));
      const target = progress * video.duration;

      // Lerp: glide toward target instead of jumping (0.1 = smooth, 1 = instant)
      currentTimeRef.current += (target - currentTimeRef.current) * 0.1;

      // Only seek if the difference is meaningful (avoids micro-seeks that cause jank)
      if (Math.abs(video.currentTime - currentTimeRef.current) > 0.05) {
        video.currentTime = currentTimeRef.current;
      }

      rafRef.current = requestAnimationFrame(update);
    };

    rafRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafRef.current);
  }, [loaded]);

  return (
    <div ref={sectionRef} className={className} style={style}>
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* The video — no poster attribute, no Image fallback */}
        <video
          ref={videoRef}
          src={src}
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ display: loaded ? "block" : "none" }}
        />

        {/* Simple loading state — no poster image */}
        {!loaded && (
          <div className="absolute inset-0 bg-dark flex items-center justify-center z-30">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-salmon border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-white/40 text-xs tracking-wider uppercase">Loading</p>
            </div>
          </div>
        )}

        {/* Children (overlays, text, etc.) */}
        {children}
      </div>
    </div>
  );
}

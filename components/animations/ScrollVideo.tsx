"use client";

import { useEffect, useRef, useState, ReactNode, useCallback } from "react";

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
  const targetTimeRef = useRef<number>(0);

  // Smooth interpolation for scroll-linked playback
  const lerp = useCallback((current: number, target: number, factor: number) => {
    return current + (target - current) * factor;
  }, []);

  // Load video
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onCanPlay = () => {
      setLoaded(true);
      // Seek to frame 0 so the first frame shows immediately
      video.currentTime = 0;
    };

    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("loadeddata", onCanPlay);

    // If already loaded (cached)
    if (video.readyState >= 3) {
      setLoaded(true);
      video.currentTime = 0;
    }

    // Force load
    video.load();

    // Force buffer on mobile — play/pause trick
    const touchLoad = () => {
      if (!loaded) {
        video.play().then(() => {
          video.pause();
          video.currentTime = 0;
        }).catch(() => {});
      }
    };
    document.addEventListener("touchstart", touchLoad, { once: true });

    return () => {
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("loadeddata", onCanPlay);
    };
  }, [loaded]);

  // Scroll-linked playback with smooth interpolation
  useEffect(() => {
    const video = videoRef.current;
    const section = sectionRef.current;
    if (!video || !section || !loaded || !video.duration) return;

    const update = () => {
      const rect = section.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) {
        rafRef.current = requestAnimationFrame(update);
        return;
      }

      const scrolled = -rect.top;
      const progress = Math.max(0, Math.min(1, scrolled / scrollable));
      targetTimeRef.current = progress * video.duration;

      // Smooth lerp toward target (0.12 = smoothing factor)
      currentTimeRef.current = lerp(
        currentTimeRef.current,
        targetTimeRef.current,
        0.12
      );

      // Only update if meaningful difference (reduces jank)
      if (Math.abs(video.currentTime - currentTimeRef.current) > 0.01) {
        video.currentTime = currentTimeRef.current;
      }

      rafRef.current = requestAnimationFrame(update);
    };

    // Initialize
    currentTimeRef.current = 0;
    targetTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafRef.current);
  }, [loaded, lerp]);

  return (
    <div ref={sectionRef} className={className} style={style}>
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* The video — always visible, first frame shows immediately */}
        <video
          ref={videoRef}
          src={src}
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Loading overlay — only before video is ready */}
        {!loaded && (
          <div className="absolute inset-0 bg-dark/90 flex items-center justify-center z-30">
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

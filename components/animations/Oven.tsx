"use client";

import { motion, AnimatePresence } from "framer-motion";

/**
 * <Oven /> — bakery-style oven that bakes alongside the quiz answers.
 *
 * Design intent: match the original /oven page aesthetic (warm, friendly,
 * white card with a dashed-border interior — looks like a homemade bakery
 * sketch, not an industrial appliance). The earlier dark stone-gradient
 * version felt off-brand for Bite Me's warm/pink palette.
 *
 * Behavior is preserved from the dark version:
 *   - cooking: 🔥 emoji pulses, steam puffs above, warm gradient inside
 *     intensifies with `progress` (0..1)
 *   - open:    🔥 swaps for the treat emoji which springs into place;
 *     no complex door rotation — simpler matches the original aesthetic
 *
 * Why no 3D door? The original /oven design didn't have one — the magic
 * was the "tap to open → emoji appears" beat. Restoring that simplicity
 * keeps the visual language consistent with the rest of the site.
 */

interface OvenProps {
  state: "cooking" | "open";
  /** 0..1 — drives glow intensity, pulse speed, and steam density. */
  progress: number;
  /** Emoji shown after the door opens. */
  treatEmoji: string;
}

export default function Oven({ state, progress, treatEmoji }: OvenProps) {
  const isOpen = state === "open";
  // Clamp progress so NaN / overflow can't break gradient math.
  const p = Math.max(0, Math.min(1, progress));
  // Pulse speed shrinks as the oven heats up: from a calm 2.0s at 0%
  // down to a frantic 0.8s at 100%. When open, freeze the animation so
  // the treat reveal isn't competing with movement underneath.
  const pulseDuration = isOpen ? 0 : 2.0 - 1.2 * p;

  return (
    <div className="relative mx-auto max-w-xs">
      {/* Steam ♨️ puffs above the oven. Density + speed scale with p so
          the page visibly "warms up" as the user works through questions.
          Three offset particles so they don't pulse in lockstep. */}
      <AnimatePresence>
        {!isOpen && (
          <>
            {[0, 0.5, 1.0].map((delay, i) => (
              <motion.div
                key={i}
                className="absolute text-2xl pointer-events-none select-none"
                style={{
                  top: -8,
                  left: `${28 + i * 22}%`,
                }}
                initial={{ y: 0, opacity: 0 }}
                animate={{
                  y: [-4, -34],
                  opacity: [0, 0.35 + p * 0.45, 0],
                }}
                exit={{ opacity: 0 }}
                transition={{
                  repeat: Infinity,
                  duration: 2.6 - p * 0.8,
                  delay,
                  ease: "easeOut",
                }}
              >
                ♨️
              </motion.div>
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Oven body — white card with rounded corners + subtle shadow.
          Same DNA as card-bakery elsewhere on the site so the oven feels
          like another piece of the same bakery, not an alien widget. */}
      <div className="bg-white rounded-3xl p-7 shadow-xl border-2 border-dark/10 relative">
        {/* The "viewing window" — a dashed-border container that holds
            either the 🔥 (cooking) or the treat emoji (open). Dashed
            border evokes a sketchbook / recipe-card feel: warm and
            handmade. */}
        <div
          className="rounded-2xl h-48 flex items-center justify-center border-2 border-dashed border-dark/10 relative overflow-hidden transition-colors"
          // The interior tints warmer as p climbs. At 0 it's near-white;
          // at 1 it's a soft amber. Inline style because Tailwind can't
          // interpolate continuously between two tones.
          style={{
            background: isOpen
              ? "linear-gradient(180deg, #FFF5EE 0%, #FFEAD9 100%)"
              : `linear-gradient(180deg, rgba(255,245,238,${1 - p * 0.2}) 0%, rgba(255,200,140,${0.05 + p * 0.35}) 100%)`,
          }}
        >
          {/* Floating glow blob behind the emoji — subtle warmth that
              grows with progress. Hidden when open so the treat reveal
              owns the spotlight. */}
          {!isOpen && (
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(ellipse at 50% 65%, rgba(255,180,100,${0.15 + p * 0.45}) 0%, transparent 60%)`,
              }}
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          )}

          {/* The hero emoji. Pre-reveal: pulsing 🔥 that quickens with
              progress. Post-reveal: the treat emoji, springing in with
              a gentle wiggle.

              AnimatePresence + mode="wait" makes the 🔥 fade out THEN
              the treat fade in, so they never overlap mid-air. */}
          <AnimatePresence mode="wait">
            {!isOpen ? (
              <motion.div
                key="cooking-flame"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: [1, 1.15, 1] }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{
                  scale: {
                    repeat: Infinity,
                    duration: pulseDuration,
                    ease: "easeInOut",
                  },
                  opacity: { duration: 0.3 },
                }}
                className="text-7xl relative z-10 drop-shadow-[0_4px_10px_rgba(220,100,40,0.25)]"
              >
                🔥
              </motion.div>
            ) : (
              <motion.div
                key="revealed-treat"
                initial={{ y: 30, scale: 0.4, opacity: 0, rotate: -8 }}
                animate={{
                  y: 0,
                  scale: 1,
                  opacity: 1,
                  rotate: 0,
                }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 14,
                  delay: 0.15,
                }}
                className="relative z-10"
              >
                <motion.span
                  className="text-7xl block drop-shadow-[0_4px_12px_rgba(132,52,48,0.35)]"
                  animate={{ rotate: [0, -4, 4, -2, 0] }}
                  transition={{
                    duration: 1.8,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  {treatEmoji}
                </motion.span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* "Tap to open"-style caption inside the window, but only when
              cooking. Replaces the old caption-below-oven so the white
              card stays focused on the emoji + reveal. */}
          {!isOpen && (
            <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-burgundy/40 text-[10px] font-bold uppercase tracking-widest">
              Baking…
            </p>
          )}
        </div>

        {/* Oven handle — horizontal bar at the bottom of the white card.
            Same dark/20 tone as the original /oven design — looks like a
            real handle without being noisy. */}
        <div className="mt-4 mx-auto w-24 h-3 bg-dark/15 rounded-full" />
      </div>

      {/* Progress caption below the oven. Subtle, supportive — gives the
          user a sense of how far they are without competing for attention
          with the question card alongside this. */}
      <p className="text-center text-burgundy/60 text-xs font-bold uppercase tracking-widest mt-4">
        {isOpen ? "✨ Your treat is ready ✨" : `Baking… ${Math.round(p * 100)}%`}
      </p>
    </div>
  );
}

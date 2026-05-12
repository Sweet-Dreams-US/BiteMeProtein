"use client";

import { motion, AnimatePresence } from "framer-motion";

/**
 * <Oven /> — animated oven that bakes alongside the user's quiz answers,
 * then opens to reveal their treat match.
 *
 * Three logical states:
 *   - "cooking"  → door closed, glowing window, steam rising. The intensity
 *                  scales with `progress` (0..1) so it visibly heats up as
 *                  the user answers more questions.
 *   - "open"     → door swings open, bright flash, treat emoji rises out
 *                  and settles above the oven.
 *
 * Why a separate component instead of inlining into /quiz:
 *   1. Isolates SVG/animation work from the quiz's scoring/state logic
 *      so each file stays focused.
 *   2. Lets us reuse the same oven elsewhere (homepage Easter egg, the
 *      old /oven random-reveal experience could come back later) without
 *      copy-pasting markup.
 *   3. Makes the oven testable on its own — `progress=0.5 state=cooking`
 *      should always look identical regardless of the surrounding page.
 *
 * No props for the "treat name" because it'd push the type surface around
 * a single line of text; the caller composes the name beneath the oven.
 */

interface OvenProps {
  state: "cooking" | "open";
  /** 0..1 — drives glow intensity + steam density while cooking. */
  progress: number;
  /** Emoji shown rising out when the door opens. */
  treatEmoji: string;
}

export default function Oven({ state, progress, treatEmoji }: OvenProps) {
  const isOpen = state === "open";
  // Clamp progress so partial NaNs / overflow can't break the gradient.
  const p = Math.max(0, Math.min(1, progress));
  // Glow ramps from 0.25 (cold) to 0.95 (almost done). At "open" we pin
  // it to 1 regardless so the result reveal is visually decisive.
  const glow = isOpen ? 1 : 0.25 + 0.7 * p;

  return (
    <div className="relative w-full max-w-xs mx-auto">
      {/* Steam puffs — only while cooking; density scales with progress.
          Three offset puffs so they don't pulse in lockstep. */}
      <AnimatePresence>
        {!isOpen && (
          <>
            {[0, 0.6, 1.2].map((delay, i) => (
              <motion.div
                key={i}
                className="absolute left-1/2 -translate-x-1/2 text-2xl pointer-events-none"
                style={{ top: -10, left: `${30 + i * 20}%` }}
                initial={{ y: 0, opacity: 0 }}
                animate={{
                  y: [-4, -28],
                  opacity: [0, 0.4 + p * 0.4, 0],
                }}
                exit={{ opacity: 0 }}
                transition={{
                  repeat: Infinity,
                  duration: 2.4 - p * 0.6,
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

      {/* The treat itself — rises out of the oven when the door opens.
          Initial state is "tucked inside the oven" so the motion reads
          as the door releasing it, not as a card teleporting in. */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="treat"
            className="absolute left-1/2 -translate-x-1/2 z-20"
            style={{ top: -56 }}
            initial={{ y: 50, scale: 0.3, opacity: 0, rotate: -10 }}
            animate={{ y: 0, scale: 1, opacity: 1, rotate: 0 }}
            exit={{ y: -20, scale: 0.5, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 180,
              damping: 14,
              delay: 0.5, // wait for door to open before treat appears
            }}
          >
            <motion.span
              className="text-6xl drop-shadow-[0_4px_12px_rgba(132,52,48,0.35)] block"
              animate={{ rotate: [0, -4, 4, -2, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            >
              {treatEmoji}
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Oven body */}
      <div className="bg-gradient-to-b from-stone-700 to-stone-900 rounded-2xl p-3 shadow-2xl relative overflow-hidden">
        {/* Subtle inner glow rim — makes the oven feel "warm" even when cold */}
        <div className="absolute inset-3 rounded-xl border border-amber-500/10" />

        {/* The "window" / door area. We render glow + door + open-flash
            as siblings stacked with z-index so the door slides over the
            glowing interior. */}
        <div className="relative aspect-[5/4] rounded-xl overflow-hidden bg-stone-950">
          {/* Hot interior glow — visible through the door window, then
              fully revealed when the door opens. Gradient origin is at
              the bottom (where the heating element would be in a real
              oven), so the light grows upward. */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at 50% 110%, rgba(255,180,90,${glow}) 0%, rgba(220,80,40,${glow * 0.7}) 30%, rgba(40,10,5,0.95) 75%)`,
            }}
            animate={{ opacity: [0.85, 1, 0.85] }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* Heating coil — three glowing lines at the bottom. Brightness
              tracks the same glow value so progress = visible heat. */}
          <div className="absolute bottom-3 left-3 right-3 space-y-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="h-0.5 rounded-full"
                style={{
                  background: `linear-gradient(90deg, rgba(255,140,40,${glow * 0.4}), rgba(255,200,80,${glow}), rgba(255,140,40,${glow * 0.4}))`,
                  boxShadow: `0 0 ${4 + p * 8}px rgba(255,170,60,${glow * 0.8})`,
                }}
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{
                  duration: 1.2 + i * 0.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>

          {/* The door — covers the window during cooking, swings down/open
              on reveal. Using rotateX from the top so it hinges like a
              real oven door. perspective on the parent keeps the 3D
              transform visible. */}
          <motion.div
            className="absolute inset-0 origin-top"
            style={{ transformPerspective: 800 }}
            animate={{ rotateX: isOpen ? 72 : 0 }}
            transition={{
              duration: 0.85,
              ease: [0.65, 0, 0.35, 1], // weighty easing — door has mass
            }}
          >
            {/* Door body: dark metal with a slight inner shadow for depth */}
            <div className="absolute inset-0 bg-gradient-to-b from-stone-800 to-stone-900 rounded-xl">
              {/* Window cutout: shows the interior glow while cooking.
                  Slightly inset from the door edge so it reads as a real
                  oven window. */}
              <div className="absolute inset-x-4 top-3 bottom-8 rounded-lg overflow-hidden border-2 border-stone-700/80 bg-stone-950">
                {/* Mirror the interior glow inside the window so the
                    "we can see through the door" illusion holds. */}
                <motion.div
                  className="absolute inset-0"
                  style={{
                    background: `radial-gradient(ellipse at 50% 100%, rgba(255,180,90,${glow * 0.95}) 0%, rgba(180,60,30,${glow * 0.6}) 40%, rgba(20,8,5,0.95) 80%)`,
                  }}
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{
                    duration: 1.4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                {/* Tiny pulsing dots inside the window to suggest food
                    actively cooking — like little bubbling treats. */}
                {[0.2, 0.5, 0.8].map((x, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1.5 h-1.5 rounded-full bg-amber-300/80 blur-[1px]"
                    style={{ left: `${x * 100}%`, bottom: "30%" }}
                    animate={{
                      y: [0, -4, 0],
                      opacity: [0.4, 1, 0.4],
                    }}
                    transition={{
                      duration: 1.6,
                      repeat: Infinity,
                      delay: i * 0.4,
                      ease: "easeInOut",
                    }}
                  />
                ))}
              </div>

              {/* Door handle — a horizontal bar near the bottom. */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-2 w-16 h-1.5 bg-stone-600 rounded-full shadow-inner" />
            </div>
          </motion.div>

          {/* Light flash that bursts out the moment the door opens.
              Short-lived white-hot bloom to make the reveal feel earned. */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                className="absolute inset-0 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.6, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, times: [0, 0.25, 1], delay: 0.3 }}
                style={{
                  background:
                    "radial-gradient(ellipse at 50% 100%, rgba(255,240,200,1) 0%, rgba(255,210,140,0.6) 35%, transparent 75%)",
                }}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Bottom panel with vent slits — pure cosmetic detail to sell
            the "this is an oven, not a box" read. */}
        <div className="mt-3 flex justify-center gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-6 h-1 rounded-full bg-stone-600/60 shadow-inner"
            />
          ))}
        </div>
      </div>

      {/* Caption that updates with cooking state. Subtle, supportive —
          doesn't compete with the question for attention. */}
      <p className="text-center text-burgundy/60 text-xs font-bold uppercase tracking-widest mt-4">
        {isOpen ? "✨ Your treat is ready ✨" : `Baking… ${Math.round(p * 100)}%`}
      </p>
    </div>
  );
}

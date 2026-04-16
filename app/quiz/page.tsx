"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import AnimatedSquiggly from "@/components/animations/AnimatedSquiggly";

interface Question {
  category: string;
  question: string;
  answers: { text: string; emoji: string; score: Record<string, number> }[];
}

const questions: Question[] = [
  {
    category: "Energy",
    question: "What's your gym energy today?",
    answers: [
      {
        text: "Beast mode — I'm lifting heavy",
        emoji: "🔥",
        score: { brownie: 3, muffin: 1 },
      },
      {
        text: "Zen mode — yoga and stretching",
        emoji: "🧘",
        score: { bites: 3, bread: 1 },
      },
      {
        text: "Cardio queen — treadmill till I drop",
        emoji: "🏃",
        score: { muffin: 3, bites: 1 },
      },
      {
        text: "Rest day — I'm on the couch",
        emoji: "🛋️",
        score: { brownie: 2, bites: 2 },
      },
    ],
  },
  {
    category: "Cravings",
    question: "Pick your ideal cheat meal:",
    answers: [
      {
        text: "Triple-layer chocolate fudge cake",
        emoji: "🍫",
        score: { brownie: 3, bites: 1 },
      },
      {
        text: "Warm banana bread with butter",
        emoji: "🍌",
        score: { bread: 3, muffin: 1 },
      },
      {
        text: "Blueberry scones from a cafe",
        emoji: "🫐",
        score: { muffin: 3, bread: 1 },
      },
      {
        text: "Raw cookie dough straight from the bowl",
        emoji: "🍪",
        score: { bites: 3, brownie: 1 },
      },
    ],
  },
  {
    category: "Snacking",
    question: "How do you snack?",
    answers: [
      {
        text: "Dense & filling — practically a meal",
        emoji: "💪",
        score: { brownie: 3, bread: 1 },
      },
      {
        text: "Light & quick — grab and go",
        emoji: "⚡",
        score: { bites: 3, muffin: 1 },
      },
      {
        text: "Something to share with friends",
        emoji: "🤝",
        score: { bites: 2, muffin: 2 },
      },
      {
        text: "Pure treat mode — no guilt allowed",
        emoji: "✨",
        score: { brownie: 2, bites: 2 },
      },
    ],
  },
  {
    category: "Priority",
    question: "What's your protein priority?",
    answers: [
      {
        text: "Max protein per serving",
        emoji: "🏋️",
        score: { brownie: 3, bread: 1 },
      },
      {
        text: "Low calorie is king",
        emoji: "📉",
        score: { muffin: 3, bites: 1 },
      },
      {
        text: "Clean ingredients matter most",
        emoji: "🌿",
        score: { bread: 2, muffin: 2 },
      },
      {
        text: "I just want it to taste good",
        emoji: "😋",
        score: { bites: 3, brownie: 1 },
      },
    ],
  },
  {
    category: "Timing",
    question: "When do you usually snack?",
    answers: [
      {
        text: "Pre-workout fuel",
        emoji: "🚀",
        score: { bread: 3, muffin: 1 },
      },
      {
        text: "Post-workout recovery",
        emoji: "💪",
        score: { brownie: 3, bread: 1 },
      },
      {
        text: "Afternoon crash rescue",
        emoji: "😴",
        score: { muffin: 2, bites: 2 },
      },
      {
        text: "Late night guilty pleasure",
        emoji: "🌙",
        score: { bites: 3, brownie: 1 },
      },
    ],
  },
  {
    category: "Texture",
    question: "Pick a texture:",
    answers: [
      {
        text: "Fudgy & dense",
        emoji: "🍫",
        score: { brownie: 3 },
      },
      {
        text: "Soft & fluffy",
        emoji: "☁️",
        score: { muffin: 3 },
      },
      {
        text: "Smooth & creamy",
        emoji: "🍦",
        score: { bites: 3 },
      },
      {
        text: "Chocolate chips mixed in",
        emoji: "🍫",
        score: { bread: 3 },
      },
    ],
  },
  {
    category: "Personality",
    question: "Your dessert personality:",
    answers: [
      {
        text: "Classic & reliable",
        emoji: "🎯",
        score: { muffin: 3, bread: 1 },
      },
      {
        text: "Bold & adventurous",
        emoji: "🎪",
        score: { bites: 3, brownie: 1 },
      },
      {
        text: "Fruity & fresh",
        emoji: "🍓",
        score: { muffin: 2, bread: 2 },
      },
      {
        text: "Rich & indulgent",
        emoji: "👑",
        score: { brownie: 3, bites: 1 },
      },
    ],
  },
  {
    category: "Vibe",
    question: "How do you take your coffee?",
    answers: [
      {
        text: "Black — no games",
        emoji: "☕",
        score: { brownie: 2, bread: 2 },
      },
      {
        text: "Iced oat milk latte",
        emoji: "🧊",
        score: { muffin: 2, bites: 2 },
      },
      {
        text: "Caramel cold brew",
        emoji: "🤤",
        score: { brownie: 3, bites: 1 },
      },
      {
        text: "I don't do coffee",
        emoji: "🚫",
        score: { bread: 2, muffin: 2 },
      },
    ],
  },
];

interface ResultData {
  title: string;
  product: string;
  tagline: string;
  emoji: string;
  shopAnchor: string;
  whyMatch: string;
  facts: string[];
}

const results: Record<string, ResultData> = {
  brownie: {
    title: "Protein Brownies",
    product: "Protein Brownies",
    tagline: "Rich, decadent, unapologetic.",
    emoji: "🍫",
    shopAnchor: "/shop#product-brownies",
    whyMatch:
      "You go hard and you snack hard. You want something dense, satisfying, and unapologetically indulgent. You're not here for sad, chalky bars — you want a protein snack that feels like a cheat meal but isn't. The brownie matches your intensity: fudgy, rich, and packed with enough protein to back up your workout.",
    facts: [
      "~5g protein per brownie",
      "Fudgy, dense, melt-in-your-mouth texture",
      "Gluten-free",
    ],
  },
  muffin: {
    title: "Blueberry Protein Muffin",
    product: "Blueberry Protein Muffin",
    tagline: "Fresh, light, clean.",
    emoji: "🫐",
    shopAnchor: "/shop#product-muffins",
    whyMatch:
      "You keep things balanced. You like clean ingredients, light textures, and flavors that feel fresh — not heavy. You're the type to grab something quick between meetings or before a run. The blueberry muffin matches your vibe: soft, naturally sweet, and made with real fruit. No protein aftertaste, no weird ingredients, just a reliable snack that delivers.",
    facts: [
      "~5g protein per muffin",
      "Soft, fluffy, real blueberry pieces",
      "Gluten-free",
    ],
  },
  bread: {
    title: "Chocolate Chip Protein Banana Bread",
    product: "Chocolate Chip Protein Banana Bread",
    tagline: "Warm, comforting, freshly baked.",
    emoji: "🍌",
    shopAnchor: "/shop#product-banana-bread",
    whyMatch:
      "You're drawn to comfort food. You like things warm, familiar, and homemade — the kind of snack that reminds you of lazy Sunday mornings. You're practical about nutrition but refuse to sacrifice flavor. The banana bread is exactly that energy: naturally sweet from real bananas, studded with chocolate chips, and packed with protein that fuels your day without feeling clinical.",
    facts: [
      "~18g protein per tin",
      "Made with real bananas & chocolate chips",
      "Gluten-free",
    ],
  },
  bites: {
    title: "Protein Vegan Cookie Dough Truffles",
    product: "Protein Vegan Cookie Dough Truffles",
    tagline: "Creamy, soft, addictive.",
    emoji: "🍪",
    shopAnchor: "/shop#product-truffles",
    whyMatch:
      "You snack for the experience. You want something fun, shareable, and borderline addictive. You've got adventurous taste and you're not afraid to try something different. The cookie dough truffles are your spirit snack: pop-and-go, creamy, slightly dangerous (you won't stop at one), and completely plant-based. They're the dessert-first, questions-later approach to protein.",
    facts: [
      "~5g protein per truffle",
      "100% vegan, smooth & creamy texture",
      "Gluten-free",
    ],
  },
};

const categoryLabels: Record<string, string> = {
  brownie: "fudgy, max-protein",
  muffin: "light, clean-eating",
  bread: "comfort-food, balanced",
  bites: "adventurous, treat-first",
};

const timingLabels: Record<number, string> = {
  0: "pre-workout",
  1: "post-workout",
  2: "afternoon crash",
  3: "late night",
};

const textureLabels: Record<number, string> = {
  0: "fudgy",
  1: "soft & fluffy",
  2: "smooth & creamy",
  3: "crunchy",
};

export default function QuizPage() {
  const [currentQ, setCurrentQ] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [showResult, setShowResult] = useState(false);
  const [answers, setAnswers] = useState<number[]>([]);
  const [direction, setDirection] = useState(1);

  const handleAnswer = (
    answerScores: Record<string, number>,
    answerIndex: number
  ) => {
    const newScores = { ...scores };
    Object.entries(answerScores).forEach(([key, val]) => {
      newScores[key] = (newScores[key] || 0) + val;
    });
    setScores(newScores);
    setAnswers([...answers, answerIndex]);
    setDirection(1);

    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      setShowResult(true);
    }
  };

  const resultKey = useMemo(() => {
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || "brownie";
  }, [scores]);

  const result = results[resultKey];

  const snackProfile = useMemo(() => {
    const timing = answers[4] !== undefined ? timingLabels[answers[4]] : "";
    const texture = answers[5] !== undefined ? textureLabels[answers[5]] : "";
    const style = categoryLabels[resultKey] || "";
    return `You're a ${timing}, ${texture}, ${style} kind of snacker.`;
  }, [answers, resultKey]);

  const restart = () => {
    setCurrentQ(0);
    setScores({});
    setShowResult(false);
    setAnswers([]);
    setDirection(1);
  };

  const progress = showResult
    ? 100
    : (currentQ / questions.length) * 100;

  const slideVariants = {
    enter: (d: number) => ({
      x: d > 0 ? 80 : -80,
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({
      x: d > 0 ? -80 : 80,
      opacity: 0,
    }),
  };

  return (
    <div className="bg-warm-bg min-h-screen">
      {/* Header */}
      <section className="pt-20 pb-6 relative overflow-hidden">
        <div className="absolute top-8 left-[12%] w-16 h-16 rounded-full bg-salmon/10 animate-float" />
        <div className="absolute top-20 right-[10%] w-12 h-12 rounded-full bg-golden-light/20 animate-float-reverse" />

        <div className="max-w-2xl mx-auto px-6 text-center relative z-10">
          <span className="stamp inline-block bg-burgundy text-cream text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-4">
            Snack Quiz
          </span>
          <h1 className="font-fun text-4xl md:text-5xl text-burgundy leading-tight">
            Find Your{" "}
            <AnimatedSquiggly color="#FF9A8B">Perfect</AnimatedSquiggly>{" "}
            Protein Match
          </h1>
          <p className="text-gray mt-3 text-sm">
            8 questions. Zero judgment. Maximum snack clarity.
          </p>
        </div>
      </section>

      <section className="min-h-[70vh] flex flex-col items-center justify-center py-8">
        <div className="max-w-2xl mx-auto px-6 w-full">
          {/* Progress Bar */}
          <div className="h-2.5 bg-cream-dark/30 rounded-full mb-10 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-burgundy to-salmon rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>

          <AnimatePresence mode="wait" custom={direction}>
            {!showResult ? (
              <motion.div
                key={currentQ}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.35, ease: "easeInOut" }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="stamp inline-block bg-salmon/10 text-salmon text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                    {questions[currentQ].category}
                  </span>
                  <span className="text-gray/50 text-sm font-medium">
                    {currentQ + 1} / {questions.length}
                  </span>
                </div>
                <h2 className="font-display text-3xl md:text-4xl text-burgundy mb-8">
                  {questions[currentQ].question}
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {questions[currentQ].answers.map((answer, i) => (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.07 }}
                      onClick={() => handleAnswer(answer.score, i)}
                      className="text-left card-bakery rounded-2xl p-6 border-2 border-transparent hover:border-salmon/40 transition-all group cursor-pointer active:scale-[0.97]"
                    >
                      <span className="text-2xl mb-2 block">{answer.emoji}</span>
                      <span className="text-dark font-medium text-lg group-hover:text-burgundy transition-colors">
                        {answer.text}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="text-center"
              >
                <div className="card-bakery rounded-3xl p-8 md:p-12 relative overflow-hidden">
                  {/* Floating decorative circles */}
                  <div className="absolute -top-6 -left-6 w-24 h-24 bg-golden-light/25 rounded-full animate-float" />
                  <div className="absolute -bottom-8 -right-8 w-28 h-28 bg-salmon-light/20 rounded-full animate-float-reverse" />
                  <div className="absolute top-12 right-10 w-10 h-10 bg-burgundy/10 rounded-full animate-wiggle" />
                  <div className="absolute bottom-16 left-8 w-8 h-8 bg-green/10 rounded-full animate-bounce-gentle" />
                  <div className="absolute top-1/3 left-[15%] w-6 h-6 bg-salmon/15 rounded-full animate-float" />

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="relative z-10"
                  >
                    <span className="stamp inline-block bg-golden/20 text-golden text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-3">
                      Your Match
                    </span>
                    <h2 className="font-fun text-4xl md:text-5xl text-burgundy mb-2">
                      {result.title}
                    </h2>
                    <p className="text-salmon text-lg font-display italic mb-6">
                      &ldquo;{result.tagline}&rdquo;
                    </p>
                  </motion.div>

                  {/* Why this is your match */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55 }}
                    className="relative z-10 mb-8"
                  >
                    <h3 className="font-display text-lg text-burgundy mb-2 font-semibold">
                      Why this is your match
                    </h3>
                    <p className="text-gray max-w-lg mx-auto text-sm leading-relaxed">
                      {result.whyMatch}
                    </p>
                  </motion.div>

                  {/* Quick facts */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.65 }}
                    className="relative z-10 mb-8"
                  >
                    <div className="grid sm:grid-cols-3 gap-3 max-w-lg mx-auto">
                      {result.facts.map((fact, i) => (
                        <div
                          key={i}
                          className="bg-cream/60 rounded-xl px-4 py-3 text-sm text-dark font-medium"
                        >
                          {fact}
                        </div>
                      ))}
                    </div>
                  </motion.div>

                  {/* Snack profile */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.75 }}
                    className="relative z-10 mb-8"
                  >
                    <div className="bg-burgundy/5 rounded-2xl px-6 py-4 max-w-md mx-auto border border-burgundy/10">
                      <p className="text-xs text-burgundy/60 uppercase tracking-widest font-bold mb-1">
                        Your Snack Profile
                      </p>
                      <p className="text-burgundy font-display text-sm italic">
                        {snackProfile}
                      </p>
                    </div>
                  </motion.div>

                  {/* CTA buttons */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.85 }}
                    className="flex flex-col sm:flex-row gap-4 justify-center relative z-10"
                  >
                    <Link
                      href={result.shopAnchor}
                      className="btn-primary inline-flex items-center justify-center px-8 py-4 text-base font-semibold hover:scale-105 transition-transform"
                    >
                      Shop {result.product}
                    </Link>
                    <button
                      onClick={restart}
                      className="btn-secondary inline-flex items-center justify-center px-8 py-4 text-base font-medium"
                    >
                      Retake Quiz
                    </button>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}

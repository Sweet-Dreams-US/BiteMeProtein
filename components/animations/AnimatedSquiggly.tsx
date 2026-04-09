"use client";

import { useRef, useEffect } from "react";
import { motion } from "framer-motion";

interface AnimatedSquigglyProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
  delay?: number;
}

export default function AnimatedSquiggly({
  children,
  color = "#FF9A8B",
  className = "",
  delay = 0,
}: AnimatedSquigglyProps) {
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const length = path.getTotalLength();
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;
  }, []);

  return (
    <span className={`relative inline-block ${className}`}>
      {children}
      <motion.svg
        viewBox="0 0 200 12"
        className="absolute -bottom-2 left-0 w-full h-3 overflow-visible"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <motion.path
          ref={pathRef}
          d="M0,6 C10,2 20,10 30,6 C40,2 50,10 60,6 C70,2 80,10 90,6 C100,2 110,10 120,6 C130,2 140,10 150,6 C160,2 170,10 180,6 C190,2 200,10 200,6"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          variants={{
            hidden: { pathLength: 0, opacity: 0 },
            visible: {
              pathLength: 1,
              opacity: 1,
              transition: { duration: 1, delay: delay + 0.3, ease: "easeOut" },
            },
          }}
        />
      </motion.svg>
    </span>
  );
}

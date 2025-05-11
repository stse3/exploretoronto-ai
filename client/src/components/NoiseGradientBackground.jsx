import React, { useState } from 'react';
import { motion } from 'framer-motion';

export default function NoiseGradientBackground({
  fromColor = "#4f46e5",  // Indigo
  toColor = "#7e22ce",    // Purple
  noiseOpacity = 0.07,    // Subtle noise
  interactive = true,
  children,
  className = ""
}) {
  const [mousePosition, setMousePosition] = useState({ x: 0.5, y: 0.5 });
  
  // Handle mouse movement if interactive mode is enabled
  const handleMouseMove = interactive ? (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height
    });
  } : null;
  
  return (
    <motion.div 
      className={`relative overflow-hidden ${className}`}
      style={{ 
        width: "100%", 
        height: "100%",
        backgroundImage: `
          radial-gradient(
            circle at ${mousePosition.x * 100}% ${mousePosition.y * 100}%, 
            ${fromColor}, 
            ${toColor}
          )
        `,
        backgroundSize: "cover",
        position: "relative",
      }}
      initial={{ backgroundPosition: "0% 0%" }}
      animate={{ 
        backgroundPosition: interactive ? 
          `${mousePosition.x * 100}% ${mousePosition.y * 100}%` : 
          ["0% 0%", "100% 100%"]
      }}
      transition={{
        backgroundPosition: {
          duration: interactive ? 0.8 : 15,
          ease: "easeOut",
          repeat: interactive ? 0 : Infinity,
          repeatType: "reverse"
        }
      }}
      onMouseMove={handleMouseMove}
    >
      {/* Noise overlay */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          opacity: noiseOpacity,
          mixBlendMode: "overlay",
        }}
        animate={{
          opacity: [noiseOpacity, noiseOpacity * 1.2, noiseOpacity],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          repeatType: "reverse"
        }}
      />
      
      {/* Content */}
      <div className="relative z-10 h-full w-full">
        {children}
      </div>
    </motion.div>
  );
}
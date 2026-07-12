import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function LandingAnimation({ onDone }) {
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
    const timer = setTimeout(onDone, 2000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      style={{
        height: "100vh",
        background: "#000",
        display: "flex",
        justifyContent: "center",
        alignItems: "center"
      }}
    >
      <AnimatePresence>
        <motion.img
          key="logo"
          src="/logo-G.jpg"
          alt="Gatekeeper Logo"
          initial={{ scale: 1, opacity: 1 }}
          animate={{ scale: 7, opacity: 0 }}
          transition={{ duration: 2, ease: [0.4, 0, 0.2, 1] }}
          style={{
            width: "9rem",
            height: "9rem",
            objectFit: "cover",
            borderRadius: "50%",
            background: "#222",
            boxShadow: "0 8px 42px #0008"
          }}
        />
      </AnimatePresence>
      <audio ref={audioRef} src="/landing-sound.wav" preload="auto" />
    </div>
  );
}

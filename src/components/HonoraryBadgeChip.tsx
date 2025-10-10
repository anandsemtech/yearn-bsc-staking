import React from "react";
import { motion } from "framer-motion";

type Props = { imageUrl: string; title: string; onClick: () => void };

const HonoraryBadgeChip: React.FC<Props> = ({ imageUrl, title, onClick }) => (
  <motion.button
    onClick={onClick}
    className="relative flex items-center gap-2 rounded-full bg-white/8 hover:bg-white/12 border border-white/15 px-2.5 py-1"
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    title={title}
  >
    <motion.img
      src={imageUrl}
      alt={title}
      className="w-6 h-6 rounded-md ring-1 ring-white/20 object-cover"
      animate={{ boxShadow: ["0 0 0px rgba(0,0,0,0)", "0 0 10px rgba(255,195,70,0.35)", "0 0 0px rgba(0,0,0,0)"] }}
      transition={{ repeat: Infinity, duration: 2.8 }}
    />
    <span className="hidden sm:block text-xs text-white/85 font-medium pr-0.5">Badge</span>
  </motion.button>
);

export default HonoraryBadgeChip;

// src/components/YearnTogetherMark.tsx
import React from "react";

type Props = {
  imgClassName?: string;
  className?: string;
  showBar?: boolean;
};

const YearnTogetherMark: React.FC<Props> = ({
  imgClassName = "h-[1.75rem] sm:h-[2rem]",
  className = "",
  showBar = false, // default OFF so it won’t double up with the SVG’s own mark
}) => {
  return (
    <div className={`flex items-center ${showBar ? "gap-2" : ""} ${className}`}>
      {showBar && (
        <span
          aria-hidden
          className="inline-block h-[1.6em] w-[0.28em] rounded-full bg-gradient-to-b from-[#2F6BFF] to-[#1D4FFF] relative"
        >
          <span className="absolute top-[0.18em] left-1/2 -translate-x-1/2 h-[0.36em] w-[0.14em] rounded-full bg-white/90" />
        </span>
      )}
      <img
        src="/assets/YearntogetherLight.svg"
        alt="YearnTogether"
        className={`block w-auto select-none ${imgClassName}`}
        draggable={false}
      />
    </div>
  );
};

export default YearnTogetherMark;

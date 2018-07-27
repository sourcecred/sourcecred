import React from "react";

export default function credLogo() {
  return (
    <svg
      version="1.1"
      baseProfile="full"
      width="256"
      height="256"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="100%" height="100%" fill="teal" />
      <circle
        cx="128"
        cy="128"
        r="48"
        fill="none"
        stroke="white"
        stroke-width="24"
      />
      <path d="M64 64 L96 96" stroke="white" stroke-width="24" />
      <path d="M192 64 L160 96" stroke="white" stroke-width="24" />
      <path d="M64 192 L96 160" stroke="white" stroke-width="24" />
      <path d="M192 192 L160 160" stroke="white" stroke-width="24" />
    </svg>
  );
}

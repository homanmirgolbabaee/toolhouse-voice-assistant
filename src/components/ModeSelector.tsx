"use client";

import { Mic, MessageSquare } from "lucide-react";
import { useState } from "react";

// Define the available interaction modes
type InteractionMode = "voice-only" | "chat-only" | "combined";

interface ModeSelectorProps {
  onSelectMode: (mode: InteractionMode) => void;
}

// Custom component to replace missing Combine icon
const CustomCombineIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <path d="M8 12h8" />
    <path d="M16 9v6" />
    <path d="M6 9v6" />
  </svg>
);

export default function ModeSelector({ onSelectMode }: ModeSelectorProps) {
  const [hoveredCard, setHoveredCard] = useState<InteractionMode | null>(null);

  // Card data for the three options
  const cards = [
    {
      id: "voice-only" as InteractionMode,
      title: "Voice Only",
      description: "Talk to your Agent",
      icon: Mic,
      gradient: "from-blue-400 to-blue-600",
      hoverGradient: "from-blue-500 to-blue-700",
      bgLight: "bg-blue-50",
      bgDark: "bg-blue-900/20",
      featured: true
    },
    {
      id: "chat-only" as InteractionMode,
      title: "Chat Only",
      description: "Traditional text-based chat interface",
      icon: MessageSquare,
      gradient: "from-pink-400 to-purple-600",
      hoverGradient: "from-pink-500 to-purple-700",
      bgLight: "bg-pink-50",
      bgDark: "bg-pink-900/20",
      featured: false
    },
    {
      id: "combined" as InteractionMode,
      title: "Voice & Chat",
      description: "Voice and Text",
      icon: CustomCombineIcon,
      gradient: "from-teal-400 to-emerald-600",
      hoverGradient: "from-teal-500 to-emerald-700",
      bgLight: "bg-teal-50",
      bgDark: "bg-teal-900/20",
      featured: false
    },
  ];

  return (
    <div className="py-6">
      <h2 className="text-2xl font-bold text-center mb-3">Choose Your Interaction Mode</h2>
      <p className="text-center text-gray-600 dark:text-gray-400 mb-4 max-w-xl mx-auto">
        Select how you'd like to interact with Toolhouse Assistant.
      </p>
      <p className="text-center text-blue-600 dark:text-blue-400 font-semibold mb-8 max-w-xl mx-auto">
        Voice Mode Dosent Suck anymore !
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        {cards.map((card) => (
          <button
            key={card.id}
            className={`
              relative overflow-hidden rounded-xl transition-all duration-300 
              ${hoveredCard === card.id ? 'scale-105 shadow-lg' : 'scale-100 shadow-md'} 
              ${card.bgLight} dark:${card.bgDark}
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
            `}
            onMouseEnter={() => setHoveredCard(card.id)}
            onMouseLeave={() => setHoveredCard(null)}
            onClick={() => onSelectMode(card.id)}
          >
            {/* Animated gradient border */}
            <div 
              className={`
                absolute inset-0 rounded-xl z-0 opacity-0 transition-opacity duration-300
                bg-gradient-to-br ${hoveredCard === card.id ? card.hoverGradient : card.gradient}
                ${hoveredCard === card.id ? 'opacity-100' : 'opacity-0'}
              `}
            />
            
            <div className="absolute inset-[1px] rounded-xl bg-white dark:bg-gray-900 z-10" />
            
            <div className="relative z-20 p-6 flex flex-col items-center text-center h-full">
              <div 
                className={`
                  p-3 rounded-full mb-4 text-white
                  bg-gradient-to-br ${card.gradient}
                `}
              >
                <card.icon size={24} />
              </div>
              <h3 className="text-xl font-semibold mb-2">{card.title}</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {card.description}
              </p>
              <div 
                className={`
                  mt-auto py-2 px-4 rounded-full text-white font-medium
                  bg-gradient-to-r ${card.gradient} transition-transform duration-300
                  ${hoveredCard === card.id ? 'scale-110' : 'scale-100'}
                `}
              >
                Select
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
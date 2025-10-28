"use client";

interface MobileControlsProps {
  onDirectionalChange: (direction: Partial<Record<"up" | "down" | "left" | "right", boolean>>) => void;
  onDash: () => void;
  onEmote: (emoji: string) => void;
}

export function MobileControls({
  onDirectionalChange,
  onDash,
  onEmote,
}: MobileControlsProps) {
  const handlePress = (key: "up" | "down" | "left" | "right", active: boolean) => {
    onDirectionalChange({ [key]: active });
  };

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 flex items-end justify-between px-6 pb-6 sm:hidden">
      <div className="grid h-32 w-32 grid-cols-3 grid-rows-3 gap-2 text-slate-200">
        <button
          className="col-start-2 row-start-1 rounded-full bg-slate-800/70 p-4"
          onTouchStart={() => handlePress("up", true)}
          onTouchEnd={() => handlePress("up", false)}
        >
          ↑
        </button>
        <button
          className="col-start-1 row-start-2 rounded-full bg-slate-800/70 p-4"
          onTouchStart={() => handlePress("left", true)}
          onTouchEnd={() => handlePress("left", false)}
        >
          ←
        </button>
        <button
          className="col-start-3 row-start-2 rounded-full bg-slate-800/70 p-4"
          onTouchStart={() => handlePress("right", true)}
          onTouchEnd={() => handlePress("right", false)}
        >
          →
        </button>
        <button
          className="col-start-2 row-start-3 rounded-full bg-slate-800/70 p-4"
          onTouchStart={() => handlePress("down", true)}
          onTouchEnd={() => handlePress("down", false)}
        >
          ↓
        </button>
      </div>
      <div className="flex flex-col items-center gap-3">
        <button
          className="rounded-full bg-sky-500 px-6 py-3 text-lg font-semibold text-white shadow-lg"
          onTouchStart={onDash}
        >
          Dash
        </button>
        <div className="flex gap-2">
          {["😀", "😂", "❤️", "👍"].map((emoji) => (
            <button
              key={emoji}
              className="rounded-full bg-slate-800/70 px-4 py-2 text-xl"
              onTouchStart={() => onEmote(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client"

interface ProgressCapsuleProps {
  current: number
  total: number
  variant?: "dots" | "bar"
}

export function ProgressCapsule({ current, total, variant = "dots" }: ProgressCapsuleProps) {
  if (variant === "bar") {
    return (
      <div className="flex items-center space-x-2">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#3F8CFF] to-[#5BA3FF] transition-all duration-300 ease-out rounded-full"
            style={{ width: `${(current / total) * 100}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 font-medium">
          {current}/{total}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center space-x-2">
      {Array.from({ length: total }, (_, index) => (
        <div
          key={index}
          className={`w-2 h-2 rounded-full transition-all duration-200 ease-out ${
            index < current ? "bg-[#3F8CFF] scale-110" : "bg-gray-300"
          }`}
        />
      ))}
    </div>
  )
}

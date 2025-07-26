"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"

interface HintBarProps {
  message: string
  type?: "info" | "success" | "warning"
  autoHide?: boolean
  duration?: number
  onClose?: () => void
}

export function HintBar({ message, type = "info", autoHide = true, duration = 3000, onClose }: HintBarProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    if (autoHide) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        onClose?.()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [autoHide, duration, onClose])

  if (!isVisible) return null

  const bgColor = {
    info: "bg-[#3F8CFF]/90",
    success: "bg-green-500/90",
    warning: "bg-[#FF9E3F]/90",
  }[type]

  return (
    <div
      className={`fixed top-4 left-4 right-4 z-50 ${bgColor} backdrop-blur-sm rounded-xl px-4 py-3 flex items-center justify-between text-white shadow-lg transition-all duration-200 ease-out`}
    >
      <span className="text-sm font-medium flex-1 text-center">{message}</span>
      <button
        onClick={() => {
          setIsVisible(false)
          onClose?.()
        }}
        className="ml-2 p-1 hover:bg-white/20 rounded-full transition-colors duration-200"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

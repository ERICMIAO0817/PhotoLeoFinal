"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Star, Camera, Palette, Lightbulb } from "lucide-react"

interface RatingCardProps {
  composition: number
  lighting: number
  creativity: number
  onRetake?: () => void
  onEdit?: () => void
  onShare?: () => void
}

export function RatingCard({ composition, lighting, creativity, onRetake, onEdit, onShare }: RatingCardProps) {
  const metrics = [
    {
      label: "构图",
      score: composition,
      icon: Camera,
      tip: "尝试三分法构图会更好",
    },
    {
      label: "光线",
      score: lighting,
      icon: Lightbulb,
      tip: "侧光能增加层次感",
    },
    {
      label: "创意",
      score: creativity,
      icon: Palette,
      tip: "角度很棒，继续保持",
    },
  ]

  const renderStars = (score: number) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Star key={index} className={`w-4 h-4 ${index < score ? "text-[#FF9E3F] fill-current" : "text-gray-300"}`} />
    ))
  }

  return (
    <Card className="w-full max-w-sm mx-auto rounded-xl shadow-lg">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-white mb-4 text-center">拍摄评分</h3>

        <div className="space-y-4 mb-6">
          {metrics.map((metric, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <metric.icon className="w-5 h-5 text-[#3F8CFF]" />
                  <span className="font-medium text-white">{metric.label}</span>
                </div>
                <div className="flex space-x-1">{renderStars(metric.score)}</div>
              </div>
              <p className="text-xs text-gray-500 ml-7">{metric.tip}</p>
            </div>
          ))}
        </div>

        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 rounded-lg border-[#3F8CFF] text-[#3F8CFF] hover:bg-[#3F8CFF] hover:text-white transition-all duration-200 bg-transparent"
            onClick={onRetake}
          >
            重拍
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 rounded-lg border-[#FF9E3F] text-[#FF9E3F] hover:bg-[#FF9E3F] hover:text-white transition-all duration-200 bg-transparent"
            onClick={onEdit}
          >
            修图
          </Button>
          <Button
            size="sm"
            className="flex-1 bg-gradient-to-r from-[#3F8CFF] to-[#5BA3FF] hover:from-[#2E7BEE] hover:to-[#4A92EE] text-white rounded-lg transition-all duration-200"
            onClick={onShare}
          >
            分享
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

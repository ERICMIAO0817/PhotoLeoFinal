"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Search, Eye, Camera, Heart } from "lucide-react"
import { BottomNavigation } from "@/components/bottom-navigation"

interface TemplatePageProps {
  onPageChange: (page: string) => void
}

export function TemplatePage({ onPageChange }: TemplatePageProps) {
  const [activeTab, setActiveTab] = useState("热门")
  const [favoriteStates, setFavoriteStates] = useState<{ [key: number]: boolean }>({})

  const tabs = ["收藏", "热门", "风景", "美食", "人像", "街拍", "建筑"]

  const templates = [
    {
      id: 1,
      title: "夕阳下的剪影人像",
      views: 12500,
      image: "/placeholder.svg?height=300&width=200",
      isFavorited: false,
    },
    {
      id: 2,
      title: "日式小清新美食",
      views: 8900,
      image: "/placeholder.svg?height=300&width=200",
      isFavorited: false,
    },
    {
      id: 3,
      title: "城市夜景光轨",
      views: 15600,
      image: "/placeholder.svg?height=300&width=200",
      isFavorited: false,
    },
    {
      id: 4,
      title: "森林系人像写真",
      views: 7200,
      image: "/placeholder.svg?height=300&width=200",
      isFavorited: false,
    },
    {
      id: 5,
      title: "咖啡拉花特写",
      views: 9800,
      image: "/placeholder.svg?height=300&width=200",
      isFavorited: false,
    },
    {
      id: 6,
      title: "极简建筑构图",
      views: 11300,
      image: "/placeholder.svg?height=300&width=200",
      isFavorited: false,
    },
    {
      id: 7,
      title: "海边日出风景",
      views: 18700,
      image: "/placeholder.svg?height=300&width=200",
      isFavorited: false,
    },
    {
      id: 8,
      title: "复古胶片人像",
      views: 6400,
      image: "/placeholder.svg?height=300&width=200",
      isFavorited: false,
    },
  ]

  const formatViews = (views: number) => {
    if (views >= 10000) {
      return `${(views / 10000).toFixed(1)}万`
    }
    return views.toString()
  }

  const toggleFavorite = (templateId: number) => {
    setFavoriteStates((prev) => ({
      ...prev,
      [templateId]: !prev[templateId],
    }))
  }

  return (
    <div className="min-h-screen bg-[#121212] pb-24">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 pt-12">
        <h1 className="text-xl font-semibold text-white">模板</h1>
        <Button variant="ghost" size="sm" className="p-2 hover:bg-white/10 rounded-full">
          <Search className="w-6 h-6 text-gray-300" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="px-4 mb-6">
        <div className="flex space-x-1 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <Button
              key={tab}
              variant="ghost"
              size="sm"
              className={`px-4 py-2 rounded-full whitespace-nowrap transition-all duration-200 ${
                activeTab === tab
                  ? "bg-[#3F8CFF] text-white"
                  : "bg-transparent text-gray-400 hover:bg-white/10 hover:text-gray-300"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </Button>
          ))}
        </div>
      </div>

      {/* Template Grid */}
      <div className="px-4">
        <div className="grid grid-cols-2 gap-4">
          {templates.map((template) => (
            <Card
              key={template.id}
              className="overflow-hidden rounded-xl bg-[#1a1a1a] border-gray-700 hover:bg-[#222] transition-all duration-200 ease-out"
            >
              <div className="aspect-[3/4] relative overflow-hidden">
                <img
                  src={template.image || "/placeholder.svg"}
                  alt={template.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                {/* 收藏按钮 */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 p-1.5 bg-black/30 hover:bg-black/50 rounded-full transition-all duration-200"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleFavorite(template.id)
                  }}
                >
                  <Heart
                    className={`w-4 h-4 transition-all duration-200 ${
                      favoriteStates[template.id] ? "text-red-500 fill-current" : "text-white"
                    }`}
                  />
                </Button>
              </div>
              <CardContent className="p-3">
                <h3 className="font-medium text-sm text-white mb-2 line-clamp-2 leading-tight">{template.title}</h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-gray-400">
                    <Eye className="w-3 h-3 mr-1" />
                    <span className="text-xs">{formatViews(template.views)}</span>
                  </div>
                  <Button
                    size="sm"
                    className="h-7 px-3 bg-gradient-to-r from-[#3F8CFF] to-[#5BA3FF] hover:from-[#2E7BEE] hover:to-[#4A92EE] text-white text-xs rounded-full transition-all duration-200"
                  >
                    <Camera className="w-3 h-3 mr-1" />
                    拍同款
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      {/* Bottom Navigation */}
      <BottomNavigation currentPage="template" onPageChange={onPageChange} />
    </div>
  )
}

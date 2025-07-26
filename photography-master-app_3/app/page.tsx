"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Mountain,
  User,
  UtensilsCrossed,
  Palette,
  Edit3,
  Star,
  BadgeIcon as IdCard,
  Layout,
  Layers,
  Play,
} from "lucide-react"
import { TemplatePage } from "@/components/template-page"
import { CameraPage } from "@/components/camera-page"
import { BottomNavigation } from "@/components/bottom-navigation"

export default function PhotographyMasterApp() {
  const [currentBanner, setCurrentBanner] = useState(0)
  const [currentPage, setCurrentPage] = useState("home") // Start with home page first
  const [cameraMode, setCameraMode] = useState("自动")

  const banners = [
    { id: 1, title: "新手摄影课程", subtitle: "7天掌握基础构图", color: "from-blue-400 to-purple-500" },
    { id: 2, title: "人像拍摄技巧", subtitle: "专业级光线运用", color: "from-orange-400 to-pink-500" },
    { id: 3, title: "风景摄影大赛", subtitle: "赢取专业器材", color: "from-green-400 to-blue-500" },
  ]

  const scenarios = [
    { icon: Mountain, label: "拍室外", color: "bg-gradient-to-br from-green-400 to-blue-400", mode: "风景" },
    { icon: User, label: "拍人像", color: "bg-gradient-to-br from-yellow-400 to-orange-400", mode: "人像" },
    { icon: UtensilsCrossed, label: "拍美食", color: "bg-gradient-to-br from-purple-400 to-pink-400", mode: "美食" },
    { icon: Palette, label: "我的专属", color: "bg-gradient-to-br from-red-400 to-orange-400", mode: "自定义" },
  ]

  const postTools = [
    { icon: Edit3, label: "帮我修图" },
    { icon: Star, label: "评图" },
    { icon: IdCard, label: "滤镜" },
    { icon: Layout, label: "海报模板" },
    { icon: Layers, label: "批量处理" },
  ]

  const recommendations = [
    {
      title: "夕阳人像拍摄技巧",
      author: "摄影师小王",
      likes: 1234,
      image: "/placeholder.svg?height=200&width=300",
    },
    {
      title: "美食摄影布光秘籍",
      author: "美食达人",
      likes: 856,
      image: "/placeholder.svg?height=200&width=300",
    },
    {
      title: "街拍构图黄金法则",
      author: "城市摄影师",
      likes: 2341,
      image: "/placeholder.svg?height=200&width=300",
    },
    {
      title: "风景摄影后期调色",
      author: "自然摄影师",
      likes: 1567,
      image: "/placeholder.svg?height=200&width=300",
    },
  ]

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  if (currentPage === "template") {
    return <TemplatePage onPageChange={setCurrentPage} />
  }

  if (currentPage === "camera") {
    return <CameraPage onClose={() => setCurrentPage("home")} initialMode={cameraMode} />
  }

  return (
    <div className="min-h-screen bg-[#121212] pb-24">
      {/* Header Banner Carousel */}
      <div className="relative h-48 overflow-hidden">
        {banners.map((banner, index) => (
          <div
            key={banner.id}
            className={`absolute inset-0 bg-gradient-to-r ${banner.color} transition-transform duration-500 ease-out ${
              index === currentBanner
                ? "translate-x-0"
                : index < currentBanner
                  ? "-translate-x-full"
                  : "translate-x-full"
            }`}
          >
            <div className="flex items-center justify-between h-full px-6 text-white">
              <div>
                <h2 className="text-2xl font-bold mb-2">{banner.title}</h2>
                <p className="text-lg opacity-90">{banner.subtitle}</p>
              </div>
              <Play className="w-12 h-12 opacity-80" />
            </div>
          </div>
        ))}

        {/* Banner Navigation Dots */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
          {banners.map((_, index) => (
            <button
              key={index}
              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                index === currentBanner ? "bg-white w-6" : "bg-white/50"
              }`}
              onClick={() => setCurrentBanner(index)}
            />
          ))}
        </div>
      </div>

      <div className="px-4 pt-6">
        {/* Direct Shot Card */}
        <div
          className="relative w-full h-48 bg-gradient-to-br from-yellow-400 via-orange-400 to-amber-500 rounded-2xl shadow-xl mb-6 overflow-hidden cursor-pointer group transition-all duration-300 ease-out hover:shadow-2xl hover:scale-[1.02]"
          onClick={() => setCurrentPage("camera")}
        >
          {/* 背景装饰 */}
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-300/20 to-orange-500/20"></div>
          <div className="absolute top-4 right-4 w-20 h-20 bg-white/10 rounded-full blur-xl"></div>
          <div className="absolute bottom-6 left-6 w-16 h-16 bg-white/5 rounded-full blur-lg"></div>

          {/* 狮子图片 */}
          <div className="absolute right-4 bottom-0 w-32 h-32 group-hover:scale-110 transition-transform duration-300">
            <img
              src="/images/lion-mascot.png"
              alt="Lion Mascot"
              className="w-full h-full object-contain drop-shadow-lg"
            />
          </div>

          {/* 文字内容 */}
          <div className="relative z-10 flex flex-col justify-center h-full pl-6 pr-36">
            <div className="mb-2">
              <span className="text-3xl font-black text-white drop-shadow-md tracking-wide">直接拍</span>
                              <span className="text-2xl ml-2">📷</span>
            </div>
            <p className="text-white/90 text-sm font-medium drop-shadow-sm">AI智能指导，轻松拍大片</p>
            <div className="flex items-center mt-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse mr-1"></div>
              <span className="text-xs text-white/80 font-medium">立即开始</span>
            </div>
          </div>
        </div>

        {/* Photography Scenarios */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">个性风格</h3>
          <div className="grid grid-cols-2 gap-4">
            {scenarios.map((scenario, index) => (
              <Button
                key={index}
                variant="ghost"
                className={`h-24 ${scenario.color} text-white hover:scale-105 transition-all duration-200 ease-out rounded-xl shadow-md`}
                onClick={() => {
                  setCurrentPage("camera")
                  // 设置相应的拍摄模式
                  setCameraMode(scenario.mode)
                }}
              >
                <div className="flex flex-col items-center">
                  <scenario.icon className="w-8 h-8 mb-2" />
                  <span className="text-base font-medium">{scenario.label}</span>
                </div>
              </Button>
            ))}
          </div>
        </div>

        {/* Post-processing Tools */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">后期工具</h3>
          <div className="flex justify-between">
            {postTools.map((tool, index) => (
              <Button
                key={index}
                variant="ghost"
                className="flex-1 h-20 mx-1 bg-transparent hover:bg-white/10 transition-all duration-200 ease-out rounded-xl"
              >
                <div className="flex flex-col items-center">
                  <tool.icon className="w-6 h-6 mb-1 text-gray-300" />
                  <span className="text-xs text-gray-300">{tool.label}</span>
                </div>
              </Button>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">为你推荐</h3>
          <div className="grid grid-cols-2 gap-4">
            {recommendations.map((item, index) => (
              <Card
                key={index}
                className="overflow-hidden rounded-xl shadow-sm hover:shadow-md transition-all duration-200 ease-out"
              >
                <div className="aspect-[4/3] bg-gray-200 relative overflow-hidden">
                  <img src={item.image || "/placeholder.svg"} alt={item.title} className="w-full h-full object-cover" />
                </div>
                <CardContent className="p-3">
                  <h4 className="font-medium text-sm text-white mb-1 line-clamp-2">{item.title}</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{item.author}</span>
                    <div className="flex items-center">
                      <Star className="w-3 h-3 text-[#FF9E3F] mr-1" />
                      <span className="text-xs text-gray-500">{item.likes}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation currentPage={currentPage} onPageChange={setCurrentPage} />
    </div>
  )
}

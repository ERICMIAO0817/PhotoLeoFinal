"use client"

import { Button } from "@/components/ui/button"
import { Home, FileImage, UserCircle } from "lucide-react"

interface BottomNavigationProps {
  currentPage: string
  onPageChange: (page: string) => void
}

export function BottomNavigation({ currentPage, onPageChange }: BottomNavigationProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#1a1a1a] border-t border-gray-700 px-4 py-3 pb-6">
      <div className="flex justify-around items-end">
        <Button
          variant="ghost"
          className="flex flex-col items-center py-2 px-4 hover:bg-transparent"
          onClick={() => onPageChange("home")}
        >
          <div className="relative">
            <Home
              className={`mb-1 ${currentPage === "home" ? "w-7 h-7 text-[#3F8CFF] fill-current" : "w-6 h-6 text-gray-400"}`}
            />
          </div>
          <span className={`text-xs ${currentPage === "home" ? "text-[#3F8CFF] font-medium" : "text-gray-400"}`}>
            首页
          </span>
          {currentPage === "home" && <div className="w-4 h-0.5 bg-[#3F8CFF] rounded-full mt-1"></div>}
        </Button>
        <Button
          variant="ghost"
          className="flex flex-col items-center py-2 px-4 hover:bg-transparent"
          onClick={() => onPageChange("template")}
        >
          <div className="relative">
            <FileImage
              className={`mb-1 ${currentPage === "template" ? "w-7 h-7 text-[#3F8CFF] fill-current" : "w-6 h-6 text-gray-400"}`}
            />
          </div>
          <span className={`text-xs ${currentPage === "template" ? "text-[#3F8CFF] font-medium" : "text-gray-400"}`}>
            模板
          </span>
          {currentPage === "template" && <div className="w-4 h-0.5 bg-[#3F8CFF] rounded-full mt-1"></div>}
        </Button>
        <Button
          variant="ghost"
          className="flex flex-col items-center py-2 px-4 hover:bg-transparent"
          onClick={() => onPageChange("profile")}
        >
          <div className="relative">
            <UserCircle
              className={`mb-1 ${currentPage === "profile" ? "w-7 h-7 text-[#3F8CFF] fill-current" : "w-6 h-6 text-gray-400"}`}
            />
          </div>
          <span className={`text-xs ${currentPage === "profile" ? "text-[#3F8CFF] font-medium" : "text-gray-400"}`}>
            我的
          </span>
          {currentPage === "profile" && <div className="w-4 h-0.5 bg-[#3F8CFF] rounded-full mt-1"></div>}
        </Button>
      </div>
    </div>
  )
}

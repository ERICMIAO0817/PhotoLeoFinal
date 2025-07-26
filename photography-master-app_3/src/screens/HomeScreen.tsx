"use client"

import { useState, useEffect } from "react"
import { View, Text, ScrollView, TouchableOpacity, Image, Dimensions, StyleSheet } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useNavigation } from "@react-navigation/native"
import { LinearGradient } from "expo-linear-gradient"
import Icon from "react-native-vector-icons/MaterialIcons"

const { width } = Dimensions.get("window")

const HomeScreen = () => {
  const navigation = useNavigation()
  const [currentBanner, setCurrentBanner] = useState(0)

  const banners = [
    { id: 1, title: "新手摄影课程", subtitle: "7天掌握基础构图", colors: ["#60A5FA", "#A855F7"] },
    { id: 2, title: "人像拍摄技巧", subtitle: "专业级光线运用", colors: ["#FB923C", "#EC4899"] },
    { id: 3, title: "风景摄影大赛", subtitle: "赢取专业器材", colors: ["#34D399", "#3B82F6"] },
  ]

  const scenarios = [
    { icon: "landscape", label: "拍室外", colors: ["#34D399", "#3B82F6"], mode: "风景" },
    { icon: "person", label: "拍人像", colors: ["#FBBF24", "#FB923C"], mode: "人像" },
    { icon: "restaurant", label: "拍美食", colors: ["#A855F7", "#EC4899"], mode: "美食" },
    { icon: "palette", label: "我的专属", colors: ["#EF4444", "#FB923C"], mode: "自定义" },
  ]

  const postTools = [
    { icon: "edit", label: "帮我修图" },
    { icon: "star", label: "评图" },
    { icon: "filter", label: "滤镜" },
    { icon: "image", label: "海报模板" },
    { icon: "layers", label: "批量处理" },
  ]

  const recommendations = [
    {
      title: "夕阳人像拍摄技巧",
      author: "摄影师小王",
      likes: 1234,
      image: "https://picsum.photos/300/200?random=1",
    },
    {
      title: "美食摄影布光秘籍",
      author: "美食达人",
      likes: 856,
      image: "https://picsum.photos/300/200?random=2",
    },
    {
      title: "街拍构图黄金法则",
      author: "城市摄影师",
      likes: 2341,
      image: "https://picsum.photos/300/200?random=3",
    },
    {
      title: "风景摄影后期调色",
      author: "自然摄影师",
      likes: 1567,
      image: "https://picsum.photos/300/200?random=4",
    },
  ]

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  const navigateToCamera = (mode = "自动") => {
    navigation.navigate("Camera", { initialMode: mode })
  }

  return (
    <SafeAreaView style={styles.container}>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Banner Carousel */}
        <View style={styles.bannerContainer}>
          {banners.map((banner, index) => (
            <LinearGradient
              key={banner.id}
              colors={banner.colors}
              style={[
                styles.banner,
                {
                  opacity: index === currentBanner ? 1 : 0,
                  transform: [
                    {
                      translateX: index === currentBanner ? 0 : index < currentBanner ? -width : width,
                    },
                  ],
                },
              ]}
            >
              <View style={styles.bannerContent}>
                <Text style={styles.bannerTitle}>{banner.title}</Text>
                <Text style={styles.bannerSubtitle}>{banner.subtitle}</Text>
              </View>
              <Icon name="play-arrow" size={48} color="rgba(255,255,255,0.8)" />
            </LinearGradient>
          ))}

          {/* Banner Dots */}
          <View style={styles.bannerDots}>
            {banners.map((_, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dot,
                  {
                    backgroundColor: index === currentBanner ? "#fff" : "rgba(255,255,255,0.5)",
                    width: index === currentBanner ? 24 : 8,
                  },
                ]}
                onPress={() => setCurrentBanner(index)}
              />
            ))}
          </View>
        </View>

        <View style={styles.content}>
          {/* Direct Shot Card */}
          <TouchableOpacity style={styles.directShotCard} onPress={() => navigateToCamera()} activeOpacity={0.9}>
            <LinearGradient colors={["#FBBF24", "#FB923C", "#F59E0B"]} style={styles.directShotGradient}>
              <View style={styles.directShotContent}>
                <View style={styles.directShotText}>
                  <Text style={styles.directShotTitle}>直接拍 📸</Text>
                  <Text style={styles.directShotSubtitle}>AI智能指导，轻松拍大片</Text>
                  <View style={styles.directShotIndicator}>
                    <View style={styles.pulsingDot} />
                    <Text style={styles.directShotCta}>立即开始</Text>
                  </View>
                </View>
                <Image
                  source={{
                    uri: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/000-DvnwPZFzPFVIZxJsHQeldGPXnmYKLB.png",
                  }}
                  style={styles.lionMascot}
                  resizeMode="contain"
                />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Photography Scenarios */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>个性风格</Text>
            <View style={styles.scenariosGrid}>
              {scenarios.map((scenario, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.scenarioCard}
                  onPress={() => navigateToCamera(scenario.mode)}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={scenario.colors} style={styles.scenarioGradient}>
                    <Icon name={scenario.icon} size={32} color="#fff" />
                    <Text style={styles.scenarioLabel}>{scenario.label}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Post-processing Tools */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>后期工具</Text>
            <View style={styles.toolsContainer}>
              {postTools.map((tool, index) => (
                <TouchableOpacity key={index} style={styles.toolCard} activeOpacity={0.7}>
                  <Icon name={tool.icon} size={24} color="#9CA3AF" />
                  <Text style={styles.toolLabel}>{tool.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Recommendations */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>为你推荐</Text>
            <View style={styles.recommendationsGrid}>
              {recommendations.map((item, index) => (
                <TouchableOpacity key={index} style={styles.recommendationCard} activeOpacity={0.8}>
                  <Image source={{ uri: item.image }} style={styles.recommendationImage} />
                  <View style={styles.recommendationContent}>
                    <Text style={styles.recommendationTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <View style={styles.recommendationMeta}>
                      <Text style={styles.recommendationAuthor}>{item.author}</Text>
                      <View style={styles.recommendationLikes}>
                        <Icon name="star" size={12} color="#FB923C" />
                        <Text style={styles.likesText}>{item.likes}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  bannerContainer: {
    height: 192,
    position: "relative",
  },
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  bannerSubtitle: {
    fontSize: 18,
    color: "rgba(255,255,255,0.9)",
  },
  bannerDots: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  content: {
    padding: 16,
  },
  directShotCard: {
    height: 192,
    borderRadius: 16,
    marginBottom: 24,
    overflow: "hidden",
  },
  directShotGradient: {
    flex: 1,
    padding: 24,
  },
  directShotContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  directShotText: {
    flex: 1,
  },
  directShotTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 8,
  },
  directShotSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    marginBottom: 8,
  },
  directShotIndicator: {
    flexDirection: "row",
    alignItems: "center",
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
    marginRight: 4,
  },
  directShotCta: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
  },
  lionMascot: {
    width: 128,
    height: 128,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 16,
  },
  scenariosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  scenarioCard: {
    width: "48%",
    height: 96,
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
  },
  scenarioGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scenarioLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#fff",
    marginTop: 8,
  },
  toolsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  toolCard: {
    flex: 1,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 2,
    borderRadius: 12,
  },
  toolLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
    textAlign: "center",
  },
  recommendationsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  recommendationCard: {
    width: "48%",
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
  },
  recommendationImage: {
    width: "100%",
    aspectRatio: 4 / 3,
  },
  recommendationContent: {
    padding: 12,
  },
  recommendationTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#fff",
    marginBottom: 4,
    lineHeight: 18,
  },
  recommendationMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  recommendationAuthor: {
    fontSize: 12,
    color: "#6B7280",
  },
  recommendationLikes: {
    flexDirection: "row",
    alignItems: "center",
  },
  likesText: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 4,
  },
})

export default HomeScreen

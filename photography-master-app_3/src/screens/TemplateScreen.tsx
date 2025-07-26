"use client"

import { useState } from "react"
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, FlatList } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import Icon from "react-native-vector-icons/MaterialIcons"

const TemplateScreen = () => {
  const [activeTab, setActiveTab] = useState("热门")
  const [favoriteStates, setFavoriteStates] = useState({})

  const tabs = ["收藏", "热门", "风景", "美食", "人像", "街拍", "建筑"]

  const templates = [
    {
      id: 1,
      title: "夕阳下的剪影人像",
      views: 12500,
      image: "https://picsum.photos/200/300?random=1",
      isFavorited: false,
    },
    {
      id: 2,
      title: "日式小清新美食",
      views: 8900,
      image: "https://picsum.photos/200/300?random=2",
      isFavorited: false,
    },
    {
      id: 3,
      title: "城市夜景光轨",
      views: 15600,
      image: "https://picsum.photos/200/300?random=3",
      isFavorited: false,
    },
    {
      id: 4,
      title: "森林系人像写真",
      views: 7200,
      image: "https://picsum.photos/200/300?random=4",
      isFavorited: false,
    },
    {
      id: 5,
      title: "咖啡拉花特写",
      views: 9800,
      image: "https://picsum.photos/200/300?random=5",
      isFavorited: false,
    },
    {
      id: 6,
      title: "极简建筑构图",
      views: 11300,
      image: "https://picsum.photos/200/300?random=6",
      isFavorited: false,
    },
  ]

  const formatViews = (views) => {
    if (views >= 10000) {
      return `${(views / 10000).toFixed(1)}万`
    }
    return views.toString()
  }

  const toggleFavorite = (templateId) => {
    setFavoriteStates((prev) => ({
      ...prev,
      [templateId]: !prev[templateId],
    }))
  }

  const renderTemplate = ({ item, index }) => (
    <TouchableOpacity style={[styles.templateCard, { marginRight: index % 2 === 0 ? 8 : 0 }]} activeOpacity={0.8}>
      <View style={styles.imageContainer}>
        <Image source={{ uri: item.image }} style={styles.templateImage} />
        <View style={styles.imageOverlay} />

        <TouchableOpacity style={styles.favoriteButton} onPress={() => toggleFavorite(item.id)}>
          <Icon
            name={favoriteStates[item.id] ? "favorite" : "favorite-border"}
            size={16}
            color={favoriteStates[item.id] ? "#EF4444" : "#fff"}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.templateContent}>
        <Text style={styles.templateTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.templateMeta}>
          <View style={styles.viewsContainer}>
            <Icon name="visibility" size={12} color="#6B7280" />
            <Text style={styles.viewsText}>{formatViews(item.views)}</Text>
          </View>
          <TouchableOpacity style={styles.shootButton}>
            <Icon name="camera-alt" size={12} color="#fff" />
            <Text style={styles.shootButtonText}>拍同款</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>模板</Text>
        <TouchableOpacity style={styles.searchButton}>
          <Icon name="search" size={24} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabButton, activeTab === tab && styles.activeTabButton]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Templates Grid */}
      <FlatList
        data={templates}
        renderItem={renderTemplate}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        contentContainerStyle={styles.templatesContainer}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
  },
  searchButton: {
    padding: 8,
  },
  tabsContainer: {
    marginBottom: 24,
  },
  tabsContent: {
    paddingHorizontal: 16,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 4,
  },
  activeTabButton: {
    backgroundColor: "#3F8CFF",
  },
  tabText: {
    fontSize: 14,
    color: "#6B7280",
  },
  activeTabText: {
    color: "#fff",
    fontWeight: "500",
  },
  templatesContainer: {
    paddingHorizontal: 16,
  },
  templateCard: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
  },
  imageContainer: {
    position: "relative",
    aspectRatio: 3 / 4,
  },
  templateImage: {
    width: "100%",
    height: "100%",
  },
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "40%",
    backgroundColor: "linear-gradient(transparent, rgba(0,0,0,0.6))",
  },
  favoriteButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  templateContent: {
    padding: 12,
  },
  templateTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#fff",
    marginBottom: 8,
    lineHeight: 18,
  },
  templateMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  viewsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewsText: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 4,
  },
  shootButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3F8CFF",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  shootButtonText: {
    fontSize: 12,
    color: "#fff",
    marginLeft: 4,
  },
})

export default TemplateScreen

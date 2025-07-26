import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import Icon from "react-native-vector-icons/MaterialIcons"
import { LinearGradient } from "expo-linear-gradient"

const ProfileScreen = () => {
  const menuItems = [
    { icon: "photo-library", title: "我的作品", subtitle: "查看拍摄历史" },
    { icon: "favorite", title: "收藏夹", subtitle: "收藏的模板和教程" },
    { icon: "school", title: "学习中心", subtitle: "摄影课程和技巧" },
    { icon: "settings", title: "设置", subtitle: "个人偏好和隐私" },
    { icon: "help", title: "帮助与反馈", subtitle: "使用指南和意见反馈" },
    { icon: "info", title: "关于我们", subtitle: "版本信息和团队介绍" },
  ]

  const stats = [
    { label: "拍摄次数", value: "128" },
    { label: "获得点赞", value: "1.2K" },
    { label: "学习时长", value: "24h" },
  ]

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <LinearGradient colors={["#3F8CFF", "#5BA3FF"]} style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: "https://picsum.photos/100/100?random=user" }} style={styles.avatar} />
            <TouchableOpacity style={styles.editButton}>
              <Icon name="edit" size={16} color="#3F8CFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.userName}>摄影爱好者</Text>
          <Text style={styles.userLevel}>初级摄影师 · Lv.3</Text>
        </LinearGradient>

        {/* Stats */}
        <View style={styles.statsContainer}>
          {stats.map((stat, index) => (
            <View key={index} style={styles.statItem}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity key={index} style={styles.menuItem} activeOpacity={0.7}>
              <View style={styles.menuIconContainer}>
                <Icon name={item.icon} size={24} color="#3F8CFF" />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <Icon name="chevron-right" size={20} color="#6B7280" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>最近活动</Text>
          <View style={styles.activityContainer}>
            <View style={styles.activityItem}>
              <Image source={{ uri: "https://picsum.photos/60/60?random=activity1" }} style={styles.activityImage} />
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>完成人像拍摄挑战</Text>
                <Text style={styles.activityTime}>2小时前</Text>
              </View>
            </View>
            <View style={styles.activityItem}>
              <Image source={{ uri: "https://picsum.photos/60/60?random=activity2" }} style={styles.activityImage} />
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>学习了构图基础课程</Text>
                <Text style={styles.activityTime}>1天前</Text>
              </View>
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
  profileHeader: {
    alignItems: "center",
    paddingVertical: 32,
    marginBottom: 24,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "#fff",
  },
  editButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  userName: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  userLevel: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "#1a1a1a",
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  menuContainer: {
    backgroundColor: "#1a1a1a",
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(63, 140, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#fff",
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 12,
    color: "#6B7280",
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 16,
  },
  activityContainer: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  activityImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#fff",
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: "#6B7280",
  },
})

export default ProfileScreen

import { View, TouchableOpacity, Text, StyleSheet } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Icon from "react-native-vector-icons/MaterialIcons"

const TabNavigator = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets()

  const getTabIcon = (routeName, focused) => {
    let iconName

    switch (routeName) {
      case "Home":
        iconName = focused ? "home" : "home"
        break
      case "Template":
        iconName = focused ? "photo-library" : "photo-library"
        break
      case "Profile":
        iconName = focused ? "person" : "person"
        break
      default:
        iconName = "help"
    }

    return iconName
  }

  const getTabLabel = (routeName) => {
    switch (routeName) {
      case "Home":
        return "首页"
      case "Template":
        return "模板"
      case "Profile":
        return "我的"
      default:
        return routeName
    }
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key]
        const label = getTabLabel(route.name)
        const isFocused = state.index === index

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          })

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name)
          }
        }

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID}
            onPress={onPress}
            style={styles.tabButton}
            activeOpacity={0.7}
          >
            <View style={styles.tabContent}>
              <Icon
                name={getTabIcon(route.name, isFocused)}
                size={isFocused ? 28 : 24}
                color={isFocused ? "#3F8CFF" : "#6B7280"}
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isFocused ? "#3F8CFF" : "#6B7280",
                    fontWeight: isFocused ? "500" : "400",
                  },
                ]}
              >
                {label}
              </Text>
              {isFocused && <View style={styles.activeIndicator} />}
            </View>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "#1a1a1a",
    borderTopWidth: 1,
    borderTopColor: "#374151",
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
  },
  tabContent: {
    alignItems: "center",
    position: "relative",
  },
  tabLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  activeIndicator: {
    position: "absolute",
    bottom: -8,
    width: 16,
    height: 2,
    backgroundColor: "#3F8CFF",
    borderRadius: 1,
  },
})

export default TabNavigator

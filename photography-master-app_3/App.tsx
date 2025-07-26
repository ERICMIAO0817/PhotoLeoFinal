import { NavigationContainer } from "@react-navigation/native"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { createStackNavigator } from "@react-navigation/stack"
import { StatusBar } from "expo-status-bar"
import { SafeAreaProvider } from "react-native-safe-area-context"

import HomeScreen from "./src/screens/HomeScreen"
import TemplateScreen from "./src/screens/TemplateScreen"
import ProfileScreen from "./src/screens/ProfileScreen"
import CameraScreen from "./src/screens/CameraScreen"
import TabNavigator from "./src/components/TabNavigator"

const Stack = createStackNavigator()
const Tab = createBottomTabNavigator()

function TabScreens() {
  return (
    <Tab.Navigator tabBar={(props) => <TabNavigator {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Template" component={TemplateScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" backgroundColor="#121212" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Main" component={TabScreens} />
          <Stack.Screen name="Camera" component={CameraScreen} options={{ presentation: "modal" }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  )
}

import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Index from './screens/Index'

// Common Screens
import Login from './screens/common/Login'
import Profile from './screens/common/Profile'
import Home from './screens/common/Home'
import Settings from './screens/common/Settings'

// Feature 1: Hair Check
import Capture from './screens/feature1/Capture'
import Result from './screens/feature1/Result'
import Dashboard from './screens/feature1/Dashboard'
import Report from './screens/feature1/Report'

// Feature 2: Chat Bot
import Chat from './screens/feature2/Chat'
import TeamMeeting from './screens/feature2/TeamMeeting'
import ChatSettings from './screens/feature2/ChatSettings'

// Feature 3: Lifestyle Advisor
import Tendency from './screens/feature3/Tendency'
import Meal from './screens/feature3/Meal'
import FoodRecommend from './screens/feature3/FoodRecommend'
import ExerciseRecommend from './screens/feature3/ExerciseRecommend'
import NearbyStores from './screens/feature3/NearbyStores'

// Layout wrapper for authenticated pages
function AuthenticatedLayout({ children }) {
  return <Layout>{children}</Layout>
}

function App() {
  return (
    <Routes>
      {/* Public Routes (no layout) */}
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<Login />} />

      {/* Authenticated Routes (with layout) */}
      <Route path="/onboarding" element={<AuthenticatedLayout><Profile /></AuthenticatedLayout>} />
      <Route path="/home" element={<AuthenticatedLayout><Home /></AuthenticatedLayout>} />
      <Route path="/settings" element={<AuthenticatedLayout><Settings /></AuthenticatedLayout>} />

      {/* Feature 1: Hair Check */}
      <Route path="/feature1/capture" element={<AuthenticatedLayout><Capture /></AuthenticatedLayout>} />
      <Route path="/feature1/result" element={<AuthenticatedLayout><Result /></AuthenticatedLayout>} />
      <Route path="/feature1/dashboard" element={<AuthenticatedLayout><Dashboard /></AuthenticatedLayout>} />
      <Route path="/feature1/report" element={<AuthenticatedLayout><Report /></AuthenticatedLayout>} />

      {/* Feature 2: Chat Bot */}
      <Route path="/feature2/chat" element={<AuthenticatedLayout><Chat /></AuthenticatedLayout>} />
      <Route path="/feature2/team-meeting" element={<AuthenticatedLayout><TeamMeeting /></AuthenticatedLayout>} />
      <Route path="/feature2/settings" element={<AuthenticatedLayout><ChatSettings /></AuthenticatedLayout>} />

      {/* Feature 3: Lifestyle Advisor */}
      <Route path="/feature3/tendency" element={<AuthenticatedLayout><Tendency /></AuthenticatedLayout>} />
      <Route path="/feature3/meal" element={<AuthenticatedLayout><Meal /></AuthenticatedLayout>} />
      <Route path="/feature3/food-recommend" element={<AuthenticatedLayout><FoodRecommend /></AuthenticatedLayout>} />
      <Route path="/feature3/exercise-recommend" element={<AuthenticatedLayout><ExerciseRecommend /></AuthenticatedLayout>} />
      <Route path="/feature3/nearby-stores" element={<AuthenticatedLayout><NearbyStores /></AuthenticatedLayout>} />

      {/* Default redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App

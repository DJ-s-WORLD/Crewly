import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { NotificationsProvider } from "@/context/NotificationsContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import BottomNav from "@/components/BottomNav";
import { CreatePostUIProvider } from "@/context/CreatePostUIContext";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import AIChat from "./pages/AIChat";
import Profile from "./pages/Profile";
import UserPublicProfile from "./pages/UserPublicProfile";
import Messages from "./pages/Messages";
import MessageThread from "./pages/MessageThread";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";
import Feed from "./pages/Feed";
import CreatePost from "./pages/CreatePost";
import PostDetail from "./pages/PostDetail";
import ArchivedPosts from "./pages/ArchivedPosts";
import PushNotificationBootstrap from "@/components/PushNotificationBootstrap";
import ReminderHandler from "@/components/ReminderHandler";
import ForgotPassword from "@/components/ForgotPassword";
import ResetPassword from "@/components/ResetPassword";

const queryClient = new QueryClient();

const AppLayout = ({ children }: { children: React.ReactNode }) => <>{children}</>;

const ProtectedWithTheme = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <ThemeProvider>
      <NotificationsProvider>
        <CreatePostUIProvider>
          <AppLayout>
            <PushNotificationBootstrap />
            <ReminderHandler />
            {children}
          </AppLayout>
          <BottomNav />
        </CreatePostUIProvider>
      </NotificationsProvider>
    </ThemeProvider>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<ProtectedWithTheme><Dashboard /></ProtectedWithTheme>} />
            <Route path="/feed" element={<ProtectedWithTheme><Feed /></ProtectedWithTheme>} />
            <Route path="/feed/new" element={<ProtectedWithTheme><CreatePost /></ProtectedWithTheme>} />
            <Route path="/post/:id" element={<ProtectedWithTheme><PostDetail /></ProtectedWithTheme>} />
            <Route path="/tasks" element={<ProtectedWithTheme><Tasks /></ProtectedWithTheme>} />
            <Route path="/ai" element={<ProtectedWithTheme><AIChat /></ProtectedWithTheme>} />
            <Route path="/u/:userId" element={<ProtectedWithTheme><UserPublicProfile /></ProtectedWithTheme>} />
            <Route path="/messages/:conversationId" element={<ProtectedWithTheme><MessageThread /></ProtectedWithTheme>} />
            <Route path="/messages" element={<ProtectedWithTheme><Messages /></ProtectedWithTheme>} />
            <Route path="/profile" element={<ProtectedWithTheme><Profile /></ProtectedWithTheme>} />
            <Route path="/profile/archived" element={<ProtectedWithTheme><ArchivedPosts /></ProtectedWithTheme>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

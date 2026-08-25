import type { Strings } from "./types";

const en: Strings = {
  welcome:
    "Hi — I'm MrFarmer, your farming assistant. Ask about crops, pests, diseases, fertilizer, or watering.\n\nAI advice is not a substitute for a local agriculture officer.",
  header: {
    openHistory: "Open chat history",
    newChat: "New chat",
  },
  composer: {
    placeholder: "Type a farming question…",
    send: "Send",
  },
  typing: {
    thinking: "Thinking…",
  },
  suggestions: {
    tryAsking: "Try asking",
    questions: [
      "How to control brown planthopper on rice?",
      "How should I apply urea fertilizer to rice?",
      "How to stake and prune tomato plants?",
      "How to control anthracnose on chili?",
      "How to prevent Fall Armyworm on maize?",
    ],
  },
  message: {
    useful: "Useful",
    notUseful: "Not useful",
    copy: "Copy",
    copied: "Copied",
    feedbackThanks: "Thanks for your feedback!",
    feedbackTitle: "What was wrong with this answer?",
    feedbackReasons: [
      "Wrong information",
      "Not related to my question",
      "Incomplete answer",
      "Unclear wording",
      "Other",
    ],
    feedbackCommentPlaceholder: "Tell us more (optional)…",
    feedbackSubmit: "Submit",
    feedbackCancel: "Cancel",
  },
  drawer: {
    chats: "Chats",
    newChat: "New chat",
    startNewChat: "Start new chat",
    noChatsYet: "No chats yet",
    noMessagesYet: "No messages yet",
    rename: "Rename",
    delete: "Delete",
    renameChat: "Rename chat",
    chatName: "Chat name",
    cancel: "Cancel",
    save: "Save",
    actionsFor: "Actions for",
  },
  settings: {
    darkMode: "Dark mode",
    language: "Language",
    english: "ENG",
    myanmar: "MM",
    logout: "Log out",
    loggedAs: "Logged in as",
    guest: "Guest",
  },
  auth: {
    subtitle: "Your farming assistant",
    login: "Log in",
    signup: "Sign up",
    guestContinue: "Continue as guest",
    or: "OR",
    username: "Username",
    usernamePlaceholder: "Enter username",
    password: "Password",
    passwordPlaceholder: "Enter password",
    confirmPassword: "Confirm password",
    confirmPasswordPlaceholder: "Re-enter password",
    passwordMismatch: "Passwords do not match",
    continueWithGoogle: "Continue with Google",
    googleFailed: "Google sign-in failed. Please try again.",
    googleNotConfigured:
      "Google sign-in is not set up yet. Add your OAuth client ID in src/config.ts.",
    loginSubtitle: "Welcome back",
    signupSubtitle: "Create your account",
    noAccount: "Don't have an account?",
    hasAccount: "Already have an account?",
  },
};

export default en;

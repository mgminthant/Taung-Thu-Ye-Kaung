/** Supported UI languages. */
export type Lang = "en" | "mm";

/** Shape shared by every locale file. Adding a key here forces both locales. */
export type Strings = {
  welcome: string;
  header: {
    openHistory: string;
    newChat: string;
  };
  composer: {
    placeholder: string;
    send: string;
  };
  typing: {
    thinking: string;
  };
  suggestions: {
    tryAsking: string;
    questions: string[];
  };
  message: {
    useful: string;
    notUseful: string;
    copy: string;
    copied: string;
    feedbackThanks: string;
    feedbackTitle: string;
    feedbackReasons: string[];
    feedbackCommentPlaceholder: string;
    feedbackSubmit: string;
    feedbackCancel: string;
  };
  drawer: {
    chats: string;
    newChat: string;
    startNewChat: string;
    noChatsYet: string;
    noMessagesYet: string;
    rename: string;
    delete: string;
    renameChat: string;
    chatName: string;
    cancel: string;
    save: string;
    actionsFor: string;
  };
  settings: {
    darkMode: string;
    language: string;
    english: string;
    myanmar: string;
    logout: string;
    loggedAs: string;
    guest: string;
  };
  auth: {
    subtitle: string;
    login: string;
    signup: string;
    guestContinue: string;
    or: string;
    username: string;
    usernamePlaceholder: string;
    password: string;
    passwordPlaceholder: string;
    confirmPassword: string;
    confirmPasswordPlaceholder: string;
    passwordMismatch: string;
    continueWithGoogle: string;
    googleFailed: string;
    googleNotConfigured: string;
    loginSubtitle: string;
    signupSubtitle: string;
    noAccount: string;
    hasAccount: string;
  };
};

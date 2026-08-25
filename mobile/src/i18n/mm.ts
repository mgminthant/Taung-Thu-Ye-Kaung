import type { Strings } from "./types";

const mm: Strings = {
  welcome:
    "မင်္ဂလာပါ — ကျွန်တော်ကတော့ MrFarmer လယ်ယာစိုက်ပျိုးရေး လက်ထောက်ဖြစ်ပါတယ်။ သီးနှံများ၊ ပိုးမွှားများ၊ ရောဂါများ၊ မြေသြဇာနှင့် ရေသွင်းခြင်းအကြောင်း မေးမြန်းနိုင်ပါတယ်။\n\nAI အကြံပြုချက်သည် ဒေသဆိုင်ရာ စိုက်ပျိုးရေးအရာရှိနှင့် အစားထိုးမဟုတ်ပါ။",
  header: {
    openHistory: "ချတ်မှတ်တမ်း ဖွင့်ရန်",
    newChat: "ချတ်အသစ်",
  },
  composer: {
    placeholder: "လယ်ယာမေးခွန်းတစ်ခု ရိုက်ထည့်ပါ…",
    send: "ပို့မည်",
  },
  typing: {
    thinking: "စဉ်းစားနေသည်…",
  },
suggestions: {
    tryAsking: "မေးကြည့်နိုင်ပါသည်",
    questions: [
      "ဆန်စပါးမှာ ဘုန်းလေးပိုးကို ဘယ်လို ထိန်းချုပ်မလဲ?",
      "ဆန်စပါးအတွက် ယူရီးယားမြေသြဇာ ဘယ်လို သုံးသင့်လဲ?",
      "ခရမ်းချဉ်ပင်ကို ဘယ်လို မျဉ်းထောက်ပြီး ဘေးကိုင်းဖြတ်ရမလဲ?",
      "ငရုတ်သီး အနာကျံရောဂါကို ဘယ်လို ထိန်းချုပ်မလဲ?",
      "ပြောင်းမှာ Fall Armyworm ပိုးကို ဘယ်လို ကာကွယ်မလဲ?",
    ],
  },
  message: {
    useful: "အသုံးဝင်သည်",
    notUseful: "အသုံးမဝင်",
    copy: "ကူးယူမည်",
    copied: "ကူးယူပြီးပါပြီ",
    feedbackThanks: "အကြံပြန်ချက်အတွက် ကျေးဇူးတင်ပါတယ်!",
    feedbackTitle: "ဤအဖြေတွင် ဘာပြဿနာရှိသလဲ?",
    feedbackReasons: [
      "မှားယွင်းသော အချက်အလက်",
      "မေးခွန်းနှင့် မသက်ဆိုင်ပါ",
      "အပြည့်အစုံမဟုတ်ပါ",
      "ရှင်းလင်းမှု မရှိပါ",
      "အခြား",
    ],
    feedbackCommentPlaceholder: "အသေးစိတ် ရေးရန် (မဖြစ်မနေ မဟုတ်ပါ)…",
    feedbackSubmit: "ပို့မည်",
    feedbackCancel: "မလုပ်တော့ပါ",
  },
  drawer: {
    chats: "စကားပြောမှတ်တမ်းများ",
    newChat: "ချတ်အသစ်",
    startNewChat: "ချတ်အသစ် စတင်ရန်",
    noChatsYet: "ချတ်မရှိသေးပါ",
    noMessagesYet: "မက်ဆေ့ချ် မရှိသေးပါ",
    rename: "အမည်ပြောင်းမည်",
    delete: "ဖျက်မည်",
    renameChat: "ချတ်အမည် ပြောင်းရန်",
    chatName: "ချတ်အမည်",
    cancel: "မလုပ်တော့ပါ",
    save: "သိမ်းမည်",
    actionsFor: "လုပ်ဆောင်ချက်များ",
  },
  settings: {
    darkMode: "ညဘက်မုဒ်",
    language: "ဘာသာစကား",
    english: "ENG",
    myanmar: "MM",
    logout: "ထွက်ရန်",
    loggedAs: "အကောင့်ဝင်ထားသည်",
    guest: "ဧည့်သည်",
  },
  auth: {
    subtitle: "သင့်လယ်ယာလက်ထောက်",
    login: "ဝင်ရန်",
    signup: "စာရင်းသွင်းရန်",
    guestContinue: "ဧည့်သည်အဖြစ် ဆက်လက်",
    or: "သို့မဟုတ်",
    username: "အသုံးပြုသူအမည်",
    usernamePlaceholder: "အသုံးပြုသူအမည် ထည့်ပါ",
    password: "စကားဝှက်",
    passwordPlaceholder: "စကားဝှက် ထည့်ပါ",
    confirmPassword: "စကားဝှက် အတည်ပြုပါ",
    confirmPasswordPlaceholder: "စကားဝှက် ထပ်ထည့်ပါ",
    passwordMismatch: "စကားဝှက်များ မတိုက်ညီပါ",
    continueWithGoogle: "Google ဖြင့် ဆက်လက်",
    googleFailed: "Google ဖြင့် ဝင်ရောက်ခြင်း မအောင်မြင်ပါ။ ထပ်စမ်းကြည့်ပါ။",
    googleNotConfigured:
      "Google sign-in ကို မထားရှိရသေးပါ။ src/config.ts တွင် OAuth client ID ထည့်ပါ။",
    loginSubtitle: "ပြန်လည်ကြိုဆိုပါသည်",
    signupSubtitle: "သင့်အကောင့်ကို ဖန်တီးပါ",
    noAccount: "အကောင့်မရှိဘူးလား?",
    hasAccount: "အကောင့်ရှိပြီးသားလား?",
  },
};

export default mm;

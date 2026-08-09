import re

with open("src/App.tsx", "r") as f:
    content = f.read()

# 1. Add ArrowDown to imports
content = content.replace(
    '  Moon\n} from "lucide-react";',
    '  Moon,\n  ArrowDown\n} from "lucide-react";'
)

# 2. Add state and refs for scroll
state_code = """  const [isDetecting, setIsDetecting] = useState(false);

  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const isScrolledUp = scrollHeight - scrollTop - clientHeight > 100;
      setShowScrollBottom(isScrolledUp);
    }
  };

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };
"""
content = content.replace('  const [isDetecting, setIsDetecting] = useState(false);', state_code)

# 3. Auto-scroll on new message
effect_code = """  useEffect(() => {
    if (activeTab === "voice") {
      scrollToBottom();
    }
  }, [chatHistory, isLoadingVoice, activeTab]);

  useEffect(() => {"""
content = content.replace('  useEffect(() => {\n    const handler = setTimeout(() => {', effect_code + '\n    const handler = setTimeout(() => {')

# 4. Attach ref and scroll handler
old_div = '<div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-slate-50 dark:bg-slate-900">'
new_div = '<div \n                ref={chatContainerRef}\n                onScroll={handleScroll}\n                className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-slate-50 dark:bg-slate-900">'
content = content.replace(old_div, new_div)

# 5. Add FAB button
fab_code = """              {/* Floating Scroll to Bottom Button */}
              <AnimatePresence>
                {showScrollBottom && (
                  <motion.button
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                    onClick={scrollToBottom}
                    className="absolute bottom-24 right-6 w-10 h-10 bg-slate-800 dark:bg-slate-700 text-white rounded-full flex items-center justify-center shadow-lg transition-all hover:bg-slate-700 dark:hover:bg-slate-600 z-10"
                  >
                    <ArrowDown className="w-5 h-5" />
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Voice Controls */}"""
content = content.replace('              {/* Voice Controls */}', fab_code)

# 6. Make voice tab relative for absolute positioning of FAB
old_voice_tab = 'className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none overflow-hidden flex flex-col h-[500px]"'
new_voice_tab = 'className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none overflow-hidden flex flex-col h-[500px] relative"'
content = content.replace(old_voice_tab, new_voice_tab)


with open("src/App.tsx", "w") as f:
    f.write(content)


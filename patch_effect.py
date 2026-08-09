import re

with open("src/App.tsx", "r") as f:
    content = f.read()

effect_to_move = """  useEffect(() => {
    if (activeTab === "voice") {
      scrollToBottom();
    }
  }, [chatHistory, isLoadingVoice, activeTab]);

"""

# Remove from old place
content = content.replace(effect_to_move, "")

# Add after audioChunksRef declaration
target = "  const audioChunksRef = useRef<Blob[]>([]);"
content = content.replace(target, target + "\n\n" + effect_to_move)

with open("src/App.tsx", "w") as f:
    f.write(content)


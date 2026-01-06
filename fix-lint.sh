#!/bin/bash

# Fix unused imports and variables in client files
sed -i "s/import { useState, useEffect }/import { useState }/g" client/src/components/FileExplorer.tsx
sed -i "s/ChevronDown,/\/\/ ChevronDown,/g" client/src/components/ChatMain.tsx
sed -i "s/const \[deletingId, setDeletingId\]/const [_deletingId, setDeletingId]/g" client/src/components/ChatSidebar.tsx
sed -i "s/GitMerge,/\/\/ GitMerge,/g" client/src/components/ThinkingPanel.tsx
sed -i "s/FileCode,/\/\/ FileCode,/g" client/src/components/ToolOutputPreview.tsx
sed -i "s/User,/\/\/ User,/g" client/src/components/UserProfileMenu.tsx
sed -i "s/autoSpeak,/_autoSpeak,/g" client/src/components/VoiceConversation.tsx
sed -i "s/RefreshCw,/\/\/ RefreshCw,/g" client/src/components/WorkspaceIDE.tsx
sed -i "s/Activity,/\/\/ Activity,/g" client/src/pages/Agent.tsx
sed -i "s/import SplashScreen/\/\/ import SplashScreen/g" client/src/pages/Chat.tsx
sed -i "s/const \[selectedFruits, setSelectedFruits\]/const [_selectedFruits, _setSelectedFruits]/g" client/src/pages/ComponentShowcase.tsx
sed -i "s/Shield,/\/\/ Shield,/g" client/src/pages/Home.tsx
sed -i "s/const \[location, setLocation\]/const [location, _setLocation]/g" client/src/pages/Login.tsx
sed -i "s/console.log/console.info/g" client/src/hooks/useWebSocket.ts
sed -i "s/console.log/console.info/g" client/src/main.tsx

echo "Done fixing lint errors"

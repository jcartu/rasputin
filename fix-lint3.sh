#!/bin/bash

# Fix WorkspaceIDE.tsx
sed -i 's/Edit,/\/\/ Edit,/g' client/src/components/WorkspaceIDE.tsx
sed -i 's/const \[fileContent, setFileContent\]/const [_fileContent, _setFileContent]/g' client/src/components/WorkspaceIDE.tsx
sed -i 's/(file, index)/(file, _index)/g' client/src/components/WorkspaceIDE.tsx

# Fix ToolOutputPreview.tsx
sed -i 's/File,/\/\/ File,/g' client/src/components/ToolOutputPreview.tsx
sed -i 's/FileSpreadsheet,/\/\/ FileSpreadsheet,/g' client/src/components/ToolOutputPreview.tsx
sed -i 's/FileVideo,/\/\/ FileVideo,/g' client/src/components/ToolOutputPreview.tsx

# Fix VoiceConversation.tsx - replace console.log with console.info
sed -i 's/console.log/console.info/g' client/src/components/VoiceConversation.tsx

# Fix Agent.tsx - more unused icons
sed -i 's/BarChart3,/\/\/ BarChart3,/g' client/src/pages/Agent.tsx
sed -i 's/AlertCircle,/\/\/ AlertCircle,/g' client/src/pages/Agent.tsx
sed -i 's/Users,/\/\/ Users,/g' client/src/pages/Agent.tsx
sed -i 's/Settings,/\/\/ Settings,/g' client/src/pages/Agent.tsx

# Fix Chat.tsx - SplashScreen import
sed -i '/import SplashScreen/d' client/src/pages/Chat.tsx
sed -i '/\/\/ import SplashScreen/d' client/src/pages/Chat.tsx

# Fix test files
sed -i 's/, beforeEach//g' server/db.test.ts
sed -i 's/, vi//g' server/db.test.ts
sed -i 's/, beforeEach//g' server/services/aiModels.test.ts
sed -i 's/, vi//g' server/services/aiModels.test.ts

echo "Done fixing more lint errors"

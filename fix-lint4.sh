#!/bin/bash

# Fix ApprovalWorkflow.tsx - Eye
sed -i 's/Eye,/\/\/ Eye,/g' client/src/components/ApprovalWorkflow.tsx

# Fix FileExplorer.tsx
sed -i 's/FileType,/\/\/ FileType,/g' client/src/components/FileExplorer.tsx
sed -i 's/Edit,/\/\/ Edit,/g' client/src/components/FileExplorer.tsx
sed -i 's/const \[fileContent, setFileContent\]/const [_fileContent, _setFileContent]/g' client/src/components/FileExplorer.tsx

# Fix ThinkingPanel.tsx
sed -i 's/(stage, index)/(stage, _index)/g' client/src/components/ThinkingPanel.tsx

# Fix ToolOutputPreview.tsx
sed -i 's/function renderPreview(input:/function renderPreview(_input:/g' client/src/components/ToolOutputPreview.tsx

# Fix VoiceConversation.tsx
sed -i 's/autoSpeak,/_autoSpeak,/g' client/src/components/VoiceConversation.tsx

echo "Done fixing final lint errors"

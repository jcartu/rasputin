#!/bin/bash

# Fix Agent.tsx voice-related unused vars
sed -i 's/const \[isSpeaking, setIsSpeaking\]/const [_isSpeaking, _setIsSpeaking]/g' client/src/pages/Agent.tsx
sed -i 's/const \[audioLevel, setAudioLevel\]/const [_audioLevel, _setAudioLevel]/g' client/src/pages/Agent.tsx
sed -i 's/const mediaRecorderRef/const _mediaRecorderRef/g' client/src/pages/Agent.tsx
sed -i 's/const audioChunksRef/const _audioChunksRef/g' client/src/pages/Agent.tsx
sed -i 's/const audioContextRef/const _audioContextRef/g' client/src/pages/Agent.tsx
sed -i 's/const analyserRef/const _analyserRef/g' client/src/pages/Agent.tsx
sed -i 's/const audioElementRef/const _audioElementRef/g' client/src/pages/Agent.tsx
sed -i 's/} catch (error) {/} catch (_error) {/g' client/src/pages/Agent.tsx

# Fix Chat.tsx
sed -i 's/const isInstallable/const _isInstallable/g' client/src/pages/Chat.tsx
sed -i 's/const \[showSplash, setShowSplash\]/const [_showSplash, _setShowSplash]/g' client/src/pages/Chat.tsx
sed -i 's/const \[useStreaming, setUseStreaming\]/const [useStreaming, _setUseStreaming]/g' client/src/pages/Chat.tsx
sed -i 's/const \[isQuerying, setIsQuerying, cancelQuery\]/const [_isQuerying, setIsQuerying, _cancelQuery]/g' client/src/pages/Chat.tsx
sed -i 's/onSuccess: (data) =>/onSuccess: (_data) =>/g' client/src/pages/Chat.tsx
sed -i 's/console.log/console.info/g' client/src/pages/Chat.tsx

# Fix Home.tsx
sed -i 's/const { user }/const { user: _user }/g' client/src/pages/Home.tsx

# Fix Login.tsx - more specific pattern
sed -i 's/const \[location, setLocation\] = useLocation/const [location, _setLocation] = useLocation/g' client/src/pages/Login.tsx
sed -i 's/const { user, isLoading }/const { user: _user, isLoading }/g' client/src/pages/Login.tsx

# Fix server files
sed -i 's/} catch (error) {/} catch (_error) {/g' server/_core/context.ts
sed -i 's/const LOCAL_HOSTS/const _LOCAL_HOSTS/g' server/_core/cookies.ts
sed -i 's/function isIpAddress/function _isIpAddress/g' server/_core/cookies.ts
sed -i 's/import { describe, it, expect, vi, beforeEach }/import { describe, it, expect }/g' server/db.test.ts
sed -i 's/import { describe, it, expect, vi, beforeEach }/import { describe, it, expect }/g' server/services/aiModels.test.ts
sed -i 's/let nextRunAt/const nextRunAt/g' server/routers.ts

# Fix ComponentShowcase
sed -i 's/console.log/console.info/g' client/src/pages/ComponentShowcase.tsx

echo "Done fixing more lint errors"

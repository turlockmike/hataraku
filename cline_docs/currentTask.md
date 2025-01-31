# Current Task: Voice Command Integration

## Current Objective
Implement voice command functionality with wake word detection and speech-to-text processing.

## Context
This feature will allow users to interact with Hataraku using voice commands, similar to "Ok Google" or "Hey Alexa". The implementation will prioritize privacy and performance by using local processing.

## Implementation Steps

### 1. Setup Voice Processing Infrastructure
- [ ] Create new voice service directory structure
```
src/services/voice/
├── index.ts
├── VoiceMonitor.ts
├── WakeWordDetector.ts
├── AudioRecorder.ts
└── SpeechProcessor.ts
```

### 2. Dependencies to Add
```json
{
  "dependencies": {
    "@picovoice/porcupine-node": "latest",
    "deepspeech": "latest",
    "node-record-lpcm16": "latest"
  }
}
```

### 3. Core Components Implementation
1. VoiceMonitor Service
   - Initialize wake word detector
   - Manage audio recording lifecycle
   - Handle voice command processing states

2. Wake Word Detection
   - Configure Porcupine with "Hey Hataraku" wake word
   - Implement continuous monitoring
   - Handle wake word detection events

3. Audio Recording
   - Configure audio input settings
   - Implement recording start/stop logic
   - Handle audio stream management

4. Speech-to-Text Processing
   - Initialize DeepSpeech model
   - Process audio stream
   - Convert speech to text commands

### 4. Integration Points
- [ ] Add voice command handler to CLI entry point
- [ ] Integrate with existing command processing pipeline
- [ ] Add voice-specific command mappings
- [ ] Implement error handling and feedback

## Next Steps
1. Set up development environment with required dependencies
2. Create basic voice service structure
3. Implement wake word detection proof of concept
4. Add speech-to-text processing
5. Integrate with existing command pipeline

## Related Tasks
- References task from projectRoadmap.md: "Implement voice prompt listener functionality"
- Will need to update codebaseSummary.md once initial implementation is complete

## Notes
- Ensure proper error handling for microphone access
- Add configuration options for wake word sensitivity
- Consider adding visual feedback for voice command status
- Document system requirements and setup process
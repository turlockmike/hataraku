# Codebase Summary

## Key Components and Their Interactions

### Core Components
1. CLI Interface (src/cli.ts)
   - Main entry point
   - Command processing
   - User interaction handling

2. Voice Processing (planned: src/services/voice/)
   - Wake word detection
   - Audio recording
   - Speech-to-text processing
   - Voice command handling

3. Command Processing Pipeline
   - Text command parsing
   - Command execution
   - Tool integration

### Data Flow
```
Input Sources:
├── Text Commands (existing)
│   └── Direct CLI input
└── Voice Commands (planned)
    ├── Wake Word Detection
    ├── Audio Recording
    └── Speech-to-Text

Command Processing:
├── Command Parser
├── Tool Executor
└── Response Handler
```

## External Dependencies

### Current Key Dependencies
- Various AI providers (Anthropic, OpenAI, etc.)
- Development tools (TypeScript, ESLint, etc.)
- Testing frameworks (Jest)

### Planned Voice Dependencies
- @picovoice/porcupine-node (Wake word detection)
- deepspeech (Speech-to-text)
- node-record-lpcm16 (Audio recording)

## Recent Significant Changes
- Planning voice command integration
- Documenting voice feature architecture
- Preparing for voice processing implementation

## User Feedback Integration
- Voice command feature inspired by user feedback
- Design focuses on privacy and performance
- Local processing approach chosen based on user needs

## Project Structure Impact
New voice functionality will be implemented as a separate service:
```
src/
├── services/
│   ├── browser/
│   ├── glob/
│   ├── mcp/
│   ├── ripgrep/
│   ├── tree-sitter/
│   └── voice/ (planned)
│       ├── index.ts
│       ├── VoiceMonitor.ts
│       ├── WakeWordDetector.ts
│       ├── AudioRecorder.ts
│       └── SpeechProcessor.ts
```

## Integration Points
1. CLI Integration
   - Voice command handler in cli.ts
   - Command processing pipeline updates

2. Service Integration
   - New voice service
   - Integration with existing services

3. Configuration
   - Voice settings in user config
   - Microphone access handling

## Future Considerations
- Voice response capabilities
- Custom wake word support
- Multi-language support
- Voice command shortcuts
# Technical Stack Documentation

## Voice Processing Stack

### Core Voice Technologies
- **Picovoice Porcupine** (Recommended)
  - Wake word detection engine
  - Lightweight and runs locally
  - Cross-platform support
  - Low resource consumption

### Speech-to-Text
- **Mozilla DeepSpeech** (Primary Option)
  - Open-source
  - Local processing for privacy
  - Good accuracy
  - Cross-platform support
  - No external API dependencies

### Audio Processing
- **Node-record-lpcm16**
  - Audio capture library
  - Low latency
  - Compatible with speech recognition engines

### Integration Components
- **Voice Command Service**
  - New service in src/services/voice/
  - Handles wake word detection
  - Manages audio recording lifecycle
  - Processes speech-to-text conversion
  - Integrates with existing command pipeline

### System Requirements
- Microphone access permissions
- Sufficient CPU for real-time processing
- ~150MB additional disk space for voice models

## Architecture Decisions

### Why Local Processing?
1. Privacy - No audio data sent to external services
2. Reliability - Works without internet connection
3. Performance - Lower latency without network calls
4. Cost - No API usage fees

### Why Porcupine for Wake Word?
1. Small footprint (~1MB)
2. High accuracy (95%+)
3. Low CPU usage (<1% on modern processors)
4. Cross-platform compatibility

### Why DeepSpeech for STT?
1. Open source and locally runnable
2. Active community and regular updates
3. Good balance of accuracy and resource usage
4. No usage limits or costs

## Integration Architecture

### Component Flow
1. Voice Monitor Service (Always running)
2. Wake Word Detector (Porcupine)
3. Audio Recorder (node-record-lpcm16)
4. Speech-to-Text Processor (DeepSpeech)
5. Command Parser (Existing)
6. Command Executor (Existing)

### Data Flow
```
[Microphone] -> [Wake Word Detection] -> [Audio Recording] -> [Speech-to-Text] -> [Command Processing] -> [Execution]
```

## Future Considerations
- Custom wake word training
- Multiple language model support
- Voice response synthesis
- Acoustic environment adaptation
- Command context awareness
# Voice Command Support in Hataraku

This guide provides detailed information about Hataraku's voice command capabilities, powered by local speech processing using Ollama.

## Table of Contents
- [Overview](#overview)
- [Setup](#setup)
- [Usage](#usage)
- [Technical Details](#technical-details)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

## Overview

Hataraku's voice command feature allows you to interact with the tool using natural speech, similar to popular voice assistants. The system uses completely local speech processing powered by Ollama, providing privacy and cost-free operation without requiring any cloud services.

### Key Features
- Wake word detection ("Hey Hataraku")
- High-accuracy speech-to-text conversion
- Completely local processing
- No API keys or cloud services needed
- Support for multiple languages
- Zero ongoing costs

## Setup

### Prerequisites
- Node.js 14 or higher
- SoX (Sound eXchange) for audio capture
- Ollama for speech processing
- ~2GB free disk space for models

### Installation Steps

1. Run the setup script to install all dependencies:
```bash
./scripts/setup-voice.sh
```

This script will:
- Install SoX for audio capture
- Install Ollama if not already present
- Download required speech models
- Configure everything automatically

2. Verify installation:
```bash
# Test voice command functionality
hataraku --voice
```

## Usage

### Basic Commands

1. Start Hataraku with voice support:
```bash
hataraku --voice
```

2. Activate voice input:
   - Say "Hey Hataraku"
   - Wait for the activation sound
   - Speak your command

3. Example commands:
   - "Create a new React component"
   - "Optimize this function for performance"
   - "Add error handling to this code"
   - "Create a new API endpoint"

### Command Patterns

Voice commands follow the same patterns as text commands. You can:
- Request code creation or modification
- Ask for explanations or analysis
- Request system operations
- Switch between different modes

### Interactive Mode with Voice

You can combine voice commands with interactive mode:
```bash
hataraku --voice -i
```

This allows you to:
- Use voice for initial commands
- Choose follow-up tasks by voice
- Switch between voice and text input as needed

## Technical Details

### Speech Processing Pipeline

1. **Audio Capture**
   - Uses node-record-lpcm16 for high-quality audio recording
   - 16kHz sampling rate, 16-bit depth
   - Automatic gain control and noise reduction

2. **Wake Word Detection**
   - Uses Ollama's Whisper model
   - Local processing with sliding window
   - Optimized for "Hey Hataraku" detection

3. **Speech-to-Text**
   - Uses Ollama's Whisper model
   - Local processing for privacy
   - High accuracy with technical terms

### Performance Considerations

- CPU Usage: Varies by system
  * Wake word detection: ~5-10% CPU
  * Speech-to-text: ~20-30% CPU during processing
- Memory Usage: ~500MB baseline
- Disk Space: ~2GB for models
- Latency: 300-800ms typical response time

## Best Practices

1. **Environment**
   - Use in a quiet environment
   - Position microphone 6-12 inches from mouth
   - Avoid background noise and echo

2. **Command Structure**
   - Speak clearly and naturally
   - Use complete phrases
   - Pause briefly between commands

3. **System Resources**
   - Close resource-intensive applications
   - Ensure adequate free memory
   - Consider CPU priority if needed

## Troubleshooting

### Common Issues

1. **Wake Word Not Detected**
   - Check microphone permissions
   - Verify audio input levels
   - Ensure Ollama service is running
   - Try restarting the Ollama service

2. **Poor Recognition Accuracy**
   - Check system resource usage
   - Reduce background noise
   - Speak more slowly and clearly
   - Consider using a better microphone

3. **System Errors**
   - Verify Ollama installation
   - Check system audio configuration
   - Ensure SoX is properly installed
   - Review error messages in logs

### Diagnostic Commands
```bash
# Test audio setup
hataraku --voice --test-audio

# Check Ollama service
ollama ps

# View debug logs
hataraku --voice --debug
```

## FAQ

**Q: Does voice processing work offline?**
A: Yes! All processing is done locally on your machine. No internet connection is required.

**Q: How much disk space do I need?**
A: About 2GB for the Whisper model used for both wake word detection and speech recognition.

**Q: How secure is the voice processing?**
A: Very secure. All processing happens locally on your machine. No audio data ever leaves your system.

**Q: Can I customize the wake word?**
A: Currently, "Hey Hataraku" is the default wake word. Custom wake words may be supported in future versions.

**Q: What's the recommended microphone setup?**
A: Any clear audio input works, but a headset or desktop microphone typically provides better results than laptop built-in microphones.

**Q: How can I improve accuracy?**
A: Use a good microphone, speak clearly, minimize background noise, and ensure your system has adequate resources available.

## Future Enhancements

Planned improvements include:
- Custom wake word support
- Optimized model size options
- Voice response capabilities
- Command shortcuts and aliases
- Improved noise handling
- Multi-speaker support

For feature requests or issues, please visit our [GitHub repository](https://github.com/turlockmike/hataraku).

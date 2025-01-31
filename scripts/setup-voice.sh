#!/bin/bash

echo "Setting up voice command dependencies..."

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to verify SoX installation
verify_sox() {
    if command_exists sox; then
        echo "✓ SoX is installed and accessible"
        return 0
    else
        return 1
    fi
}

# Function to verify Ollama installation
verify_ollama() {
    if command_exists ollama; then
        echo "✓ Ollama is installed and accessible"
        return 0
    else
        return 1
    fi
}

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo "Setting up for macOS..."
    
    # Check for Homebrew
    if ! command_exists brew; then
        echo "Homebrew not found. Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        
        # Add Homebrew to PATH for Apple Silicon Macs
        if [[ $(uname -m) == 'arm64' ]]; then
            echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc
            eval "$(/opt/homebrew/bin/brew shellenv)"
        fi
    fi
    
    # Install/Update SoX
    if ! verify_sox; then
        echo "Installing SoX..."
        brew install sox
    fi
    
    # Install/Update Ollama
    if ! verify_ollama; then
        echo "Installing Ollama..."
        curl -fsSL https://ollama.com/install.sh | sh
    fi

elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    echo "Setting up for Linux..."
    
    if command_exists apt-get; then
        # Debian/Ubuntu
        echo "Detected Debian/Ubuntu system"
        
        # Install SoX
        if ! verify_sox; then
            echo "Installing SoX..."
            sudo apt-get update
            sudo apt-get install -y sox libsox-fmt-all
        fi
        
        # Install Ollama
        if ! verify_ollama; then
            echo "Installing Ollama..."
            curl -fsSL https://ollama.com/install.sh | sh
        fi
        
    elif command_exists yum; then
        # RHEL/CentOS
        echo "Detected RHEL/CentOS system"
        
        # Install SoX
        if ! verify_sox; then
            echo "Installing SoX..."
            sudo yum install -y sox sox-devel
        fi
        
        # Install Ollama
        if ! verify_ollama; then
            echo "Installing Ollama..."
            curl -fsSL https://ollama.com/install.sh | sh
        fi
        
    else
        echo "Unsupported Linux distribution. Please install SoX and Ollama manually."
        exit 1
    fi
else
    echo "Unsupported operating system: $OSTYPE"
    exit 1
fi

# Verify installations
echo -e "\nVerifying installations..."

if ! verify_sox; then
    echo "❌ Error: SoX installation failed or not in PATH"
    echo "Please try installing manually:"
    echo "- macOS: brew install sox"
    echo "- Debian/Ubuntu: sudo apt-get install sox libsox-fmt-all"
    echo "- RHEL/CentOS: sudo yum install sox sox-devel"
    exit 1
fi

if ! verify_ollama; then
    echo "❌ Error: Ollama installation failed or not in PATH"
    echo "Please try installing manually from https://ollama.com"
    exit 1
fi

# Start Ollama service
echo -e "\nStarting Ollama service..."
if ! pgrep -x "ollama" > /dev/null; then
    ollama serve &> /dev/null &
    sleep 2 # Give it a moment to start
fi

# Pull required models
echo -e "\nDownloading required models (this may take a few minutes)..."
ollama pull openhermes

echo -e "\n✨ Setup complete! Voice commands are ready to use.

Features:
- Completely local voice processing - no cloud services needed
- Wake word detection and speech recognition using OpenHermes
- High-quality speech recognition
- No API keys or costs involved

To use voice commands:
1. Start Hataraku with: hataraku --voice
2. Say 'Hey Hataraku' to activate
3. Speak your command

Note: Voice processing runs entirely on your machine. First-time wake word
detection might be slightly slower as the model warms up.

Tips for best performance:
- Use a good quality microphone
- Speak clearly and at a normal pace
- Keep background noise to a minimum

For troubleshooting, check the detailed guide at:
./docs/voice-commands.md
"
# Using Glow with Hataraku

This guide explains how to install and use [Glow](https://github.com/charmbracelet/glow), a terminal-based markdown viewer, with Hataraku to enhance the readability of Hataraku's output.

## What is Glow?

Glow is a terminal-based markdown renderer that makes reading markdown files in the terminal a pleasant experience. It supports styling, code highlighting, and other markdown features, making it perfect for viewing Hataraku's markdown-formatted output.

## Installation Guide

### macOS

Using Homebrew:
```bash
brew install glow
```

### Linux

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install glow
```

#### Arch Linux
```bash
sudo pacman -S glow
```

#### Using Snap
```bash
sudo snap install glow
```

### Windows

Using Scoop:
```bash
scoop install glow
```

Using Chocolatey:
```bash
choco install glow
```

### Using Go
If you have Go installed:
```bash
go install github.com/charmbracelet/glow@latest
```

## Setting Up Glow with Hataraku

### Option 1: Using an Alias

Add the following to your shell configuration file (`.bashrc`, `.zshrc`, etc.):

```bash
# Simple alias to pipe hataraku output to glow
alias hg="hataraku | glow -"
```

### Option 2: Using a Function (Recommended)

A function provides more flexibility, allowing you to pass arguments to Hataraku:

```bash
# Function to pipe hataraku output to glow
hd() {
  hataraku "$@" | glow -
}
```

This function is already set up in your `.zshrc` file:
```bash
alias h="hataraku"
hd () (h "$@" | glow -)
```

## Usage Examples

### Basic Usage

```bash
# Using the alias
hg task run hello-world

# Using the function
hd task run hello-world
```

### With Arguments

```bash
# Pass arguments to Hataraku
hd task run hello-world --input '{"name": "World"}'
```

### With Custom Glow Options

If you want to customize Glow's behavior, you can modify the function:

```bash
# Function with custom Glow options
hd_custom() {
  hataraku "$@" | glow -p -w 80 -
}
```

Options:
- `-p`: Enable paging
- `-w 80`: Set width to 80 characters
- `-s dark`: Use dark style (or `light`)

## Glow Configuration

You can customize Glow's appearance by creating a config file:

```bash
mkdir -p ~/.config/glow
touch ~/.config/glow/glow.yml
```

Example configuration:
```yaml
# ~/.config/glow/glow.yml
style: dark
pager: true
width: 80
```

## Troubleshooting

### Glow Not Found

If you get a "command not found" error:
1. Make sure Glow is installed correctly
2. Check that the installation directory is in your PATH
3. Try reinstalling using one of the methods above

### Formatting Issues

If the output doesn't look right:
1. Make sure Hataraku is producing valid markdown
2. Try different Glow styling options
3. Check terminal compatibility (some terminals support more features than others)

## Additional Resources

- [Glow GitHub Repository](https://github.com/charmbracelet/glow)
- [Glow Documentation](https://github.com/charmbracelet/glow#usage)
- [Markdown Guide](https://www.markdownguide.org/) 
class WenkerRouter < Formula
  desc "Local AI Proxy Router Gateway - Unified API for 180+ AI providers"
  homepage "https://github.com/WENKER-AI/wenker-router"
  version "2.1.16"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/WENKER-AI/wenker-router/releases/download/v#{version}/wenker-router-v#{version}-darwin-arm64.tar.gz"
      sha256 "REPLACE_WITH_ARM64_SHA256"
    else
      url "https://github.com/WENKER-AI/wenker-router/releases/download/v#{version}/wenker-router-v#{version}-darwin-x64.tar.gz"
      sha256 "REPLACE_WITH_X64_SHA256"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/WENKER-AI/wenker-router/releases/download/v#{version}/wenker-router-v#{version}-linux-arm64.tar.gz"
      sha256 "REPLACE_WITH_LINUX_ARM64_SHA256"
    else
      url "https://github.com/WENKER-AI/wenker-router/releases/download/v#{version}/wenker-router-v#{version}-linux-x64.tar.gz"
      sha256 "REPLACE_WITH_LINUX_X64_SHA256"
    end
  end

  depends_on "node@20" => :build

  def install
    # Install the binary
    bin.install "wenker"
    
    # Install completion scripts
    bash_completion.install "completions/wenker.bash" if File.exist?("completions/wenker.bash")
    zsh_completion.install "completions/wenker.zsh" if File.exist?("completions/wenker.zsh")
    fish_completion.install "completions/wenker.fish" if File.exist?("completions/wenker.fish")
  end

  def post_install
    # Create data directory
    (var/"wenker").mkpath
  end

  def caveats
    <<~EOS
      WENKER Router installed successfully!
      
      Quick start:
        wenker
      
      Configuration:
        Config directory: #{var}/wenker
        Dashboard: http://localhost:3600
        API Base: http://localhost:3600/v1
      
      For Claude Code:
        export ANTHROPIC_BASE_URL=http://localhost:3600/v1
        export ANTHROPIC_API_KEY=your-key
      
      Documentation: https://github.com/WENKER-AI/wenker-router
    EOS
  end

  test do
    system "#{bin}/wenker", "--version"
  end
end
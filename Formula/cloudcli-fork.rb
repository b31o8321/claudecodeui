require "fileutils"
require "json"

class CloudcliFork < Formula
  desc "Self-hosted web UI for Claude Code (fork of siteboon/claudecodeui)"
  homepage "https://github.com/b31o8321/claudecodeui"
  url "https://github.com/b31o8321/claudecodeui/archive/refs/tags/v1.32.0-fork.1.tar.gz"
  sha256 "PLACEHOLDER_SHA256_REPLACE_BEFORE_PUBLISHING"
  license "MIT"
  head "https://github.com/b31o8321/claudecodeui.git", branch: "main"

  depends_on "node@22"

  def install
    system "npm", "ci"
    system "npm", "run", "build"

    # Install the built artifacts + needed runtime files
    libexec.install Dir["*"]

    (bin/"cloudcli-fork").write <<~SH
      #!/bin/bash
      set -e
      export NODE_PATH="#{libexec}/node_modules"
      cd "#{libexec}"
      exec "#{Formula["node@22"].opt_bin}/node" dist-server/server/index.js "$@"
    SH
    chmod 0755, bin/"cloudcli-fork"
  end

  def post_install
    # Scaffold default config at ~/.cloudcli/config.json if absent
    config_dir = "#{Dir.home}/.cloudcli"
    config_path = "#{config_dir}/config.json"
    unless File.exist?(config_path)
      FileUtils.mkdir_p(config_dir)
      File.write(config_path, JSON.pretty_generate({
        "bind" => "lan",
        "port" => 3001,
        "publicUrl" => nil,
      }) + "\n")
    end
  end

  service do
    run [opt_bin/"cloudcli-fork"]
    keep_alive true
    log_path var/"log/cloudcli-fork.log"
    error_log_path var/"log/cloudcli-fork.err.log"
    working_dir HOMEBREW_PREFIX
  end

  test do
    assert_predicate bin/"cloudcli-fork", :exist?
    assert_predicate bin/"cloudcli-fork", :executable?
  end
end

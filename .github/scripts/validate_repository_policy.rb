#!/usr/bin/env ruby
# frozen_string_literal: true

require "pathname"
require "psych"
require "set"

WORKFLOW_ROOT = Pathname.new(".github/workflows")
ALLOWED_TARGET_WORKFLOWS = Set["codex-review-gate.yml"].freeze
STATUS_WRITE_WORKFLOWS = ALLOWED_TARGET_WORKFLOWS
ALLOWED_RUNNER = "ubuntu-24.04"
ACTION_SHA_PATTERN = /\A[^@\s]+@[0-9a-f]{40}\z/
FORBIDDEN_GIT_PATTERN = /\bgit\s+(?:clone|checkout|switch|fetch|pull)\b/i

class PolicyError < StandardError; end

module Ast
  module_function

  def parse_file(path)
    document = Psych.parse_file(path.to_s)
    raise PolicyError, "#{path}: empty YAML document" unless document&.root

    document.root
  rescue Psych::SyntaxError => e
    raise PolicyError, "#{path}: invalid YAML: #{e.message}"
  end

  def parse_string(text)
    document = Psych.parse(text)
    raise PolicyError, "fixture: empty YAML document" unless document&.root

    document.root
  end

  def mapping_entries(node, context)
    unless node.is_a?(Psych::Nodes::Mapping)
      raise PolicyError, "#{context}: expected mapping, got #{node.class}"
    end

    node.children.each_slice(2).map do |key, value|
      unless key.is_a?(Psych::Nodes::Scalar)
        raise PolicyError, "#{context}: non-scalar mapping key is not allowed"
      end

      [key.value, value]
    end
  end

  def mapping_value(node, key, context)
    mapping_entries(node, context).find { |name, _| name == key }&.last
  end

  def event_names(root, context)
    on_node = mapping_value(root, "on", context)
    return [] unless on_node

    case on_node
    when Psych::Nodes::Scalar
      [on_node.value]
    when Psych::Nodes::Sequence
      on_node.children.map do |child|
        unless child.is_a?(Psych::Nodes::Scalar)
          raise PolicyError, "#{context}: on sequence items must be scalar event names"
        end

        child.value
      end
    when Psych::Nodes::Mapping
      mapping_entries(on_node, "#{context}: on").map(&:first)
    else
      raise PolicyError, "#{context}: unsupported on syntax #{on_node.class}"
    end
  end

  def values_for_key(node, target, context, results = [])
    case node
    when Psych::Nodes::Mapping
      mapping_entries(node, context).each do |key, value|
        results << value if key == target
        values_for_key(value, target, context, results)
      end
    when Psych::Nodes::Sequence
      node.children.each { |child| values_for_key(child, target, context, results) }
    when Psych::Nodes::Document
      values_for_key(node.root, target, context, results) if node.root
    when Psych::Nodes::Scalar, Psych::Nodes::Alias
      # Leaf node.
    else
      raise PolicyError, "#{context}: unsupported YAML node #{node.class}"
    end

    results
  end

  def scalar_value(node, context)
    unless node.is_a?(Psych::Nodes::Scalar)
      raise PolicyError, "#{context}: expected scalar, got #{node.class}"
    end

    node.value
  end
end

class RepositoryPolicy
  def initialize(workflow_root: WORKFLOW_ROOT)
    @workflow_root = workflow_root
  end

  def run!
    workflows = [*@workflow_root.glob("*.yml"), *@workflow_root.glob("*.yaml")].sort
    raise PolicyError, "No workflow files found" if workflows.empty?

    parsed = workflows.to_h { |path| [path, Ast.parse_file(path)] }

    validate_workflows!(parsed)
    validate_trusted_context!(parsed)
    validate_codex_gate!
    validate_public_notices!
    run_regression_fixtures!

    puts "Validated #{workflows.length} workflows and public repository policy invariants."
  end

  private

  def validate_workflows!(parsed)
    target_workflows = Set.new

    parsed.each do |path, root|
      context = path.to_s
      target_workflows << path.basename.to_s if Ast.event_names(root, context).include?("pull_request_target")
      jobs = Ast.mapping_value(root, "jobs", context)
      raise PolicyError, "#{context}: jobs mapping is required" unless jobs

      Ast.mapping_entries(jobs, "#{context}: jobs").each do |job_name, job_node|
        runs_on = Ast.mapping_value(job_node, "runs-on", "#{context}: job #{job_name}")
        raise PolicyError, "#{context}: job #{job_name} must define runs-on" unless runs_on

        runner = Ast.scalar_value(runs_on, "#{context}: job #{job_name} runs-on")
        unless runner == ALLOWED_RUNNER
          raise PolicyError,
                "#{context}: job #{job_name} must use #{ALLOWED_RUNNER.inspect}, got #{runner.inspect}"
        end
      end

      Ast.values_for_key(root, "uses", context).each do |node|
        action = Ast.scalar_value(node, "#{context}: uses")
        unless ACTION_SHA_PATTERN.match?(action)
          raise PolicyError, "#{context}: action is not pinned to a full commit SHA: #{action}"
        end
      end

      Ast.values_for_key(root, "permissions", context).each do |permissions|
        validate_permissions!(path.basename.to_s, permissions, context)
      end
    end

    unless target_workflows == ALLOWED_TARGET_WORKFLOWS
      raise PolicyError,
            "pull_request_target allowlist mismatch: actual=#{target_workflows.to_a.sort} " \
            "expected=#{ALLOWED_TARGET_WORKFLOWS.to_a.sort}"
    end
  end

  def validate_permissions!(workflow_name, node, context)
    if node.is_a?(Psych::Nodes::Scalar)
      value = node.value
      raise PolicyError, "#{context}: permissions #{value.inspect} is forbidden" unless value == "read-all"
      return
    end

    Ast.mapping_entries(node, "#{context}: permissions").each do |permission, value_node|
      value = Ast.scalar_value(value_node, "#{context}: permission #{permission}")
      next unless value == "write"

      unless permission == "statuses" && STATUS_WRITE_WORKFLOWS.include?(workflow_name)
        raise PolicyError, "#{context}: #{permission}: write is not allowed"
      end
    end
  end

  def validate_trusted_context!(parsed)
    ALLOWED_TARGET_WORKFLOWS.each do |name|
      path = @workflow_root / name
      root = parsed.fetch(path) { raise PolicyError, "Missing trusted workflow #{path}" }
      context = path.to_s

      unless Ast.event_names(root, context).include?("pull_request_target")
        raise PolicyError, "#{context}: trusted workflow lost pull_request_target"
      end

      Ast.values_for_key(root, "uses", context).each do |node|
        action = Ast.scalar_value(node, "#{context}: uses")
        raise PolicyError, "#{context}: trusted workflow must never use checkout" if action.start_with?("actions/checkout@")
      end

      Ast.values_for_key(root, "run", context).each do |node|
        script = Ast.scalar_value(node, "#{context}: run")
        if FORBIDDEN_GIT_PATTERN.match?(script)
          raise PolicyError, "#{context}: trusted workflow must never fetch pull-request code"
        end
      end

      permissions = Ast.mapping_value(root, "permissions", context)
      raise PolicyError, "#{context}: explicit permissions mapping is required" unless permissions

      entries = Ast.mapping_entries(permissions, "#{context}: permissions").to_h
      contents = Ast.scalar_value(entries.fetch("contents"), "#{context}: contents permission")
      statuses = Ast.scalar_value(entries.fetch("statuses"), "#{context}: statuses permission")
      raise PolicyError, "#{context}: contents permission must be read" unless contents == "read"
      raise PolicyError, "#{context}: statuses permission must be write" unless statuses == "write"
    end
  end

  def validate_codex_gate!
    path = @workflow_root / "codex-review-gate.yml"
    text = path.read
    source_expression = "SOURCE_REPOSITORY: $" + "{{ github.event.pull_request.head.repo.full_name }}"
    required = [
      source_expression,
      "steps.classify.outputs.trusted == 'true'",
      "short_sha_resolves_to_head",
      "External PR uses manual owner review; Codex token withheld",
      "issues/comments/${REQUEST_COMMENT_ID}/reactions?per_page=100",
      "REQUEST_CREATED_AT"
    ]

    required.each do |marker|
      raise PolicyError, "#{path}: missing security marker #{marker.inspect}" unless text.include?(marker)
    end
  end

  def validate_public_notices!
    license_text = Pathname.new("LICENSE").read
    readme = Pathname.new("README.md").read
    notice = Pathname.new("NOTICE").read
    security = Pathname.new("SECURITY.md").read
    contributing = Pathname.new("CONTRIBUTING.md").read

    unless license_text.include?("PolyForm Noncommercial License 1.0.0")
      raise PolicyError, "LICENSE: expected PolyForm Noncommercial 1.0.0 text is missing"
    end
    unless license_text.start_with?("Required Notice: Copyright 2026 Benjamin Hornung.")
      raise PolicyError, "LICENSE: required copyright notice is missing"
    end
    unless readme.include?("source-available, not open source")
      raise PolicyError, "README.md: public noncommercial status is not prominent"
    end
    unless notice.include?("Commercial use is not permitted")
      raise PolicyError, "NOTICE: commercial-use prohibition is missing"
    end
    unless security.include?("security/advisories/new")
      raise PolicyError, "SECURITY.md: private reporting path is missing"
    end
    unless contributing.include?("The repository owner decides whether and when a pull request is merged.")
      raise PolicyError, "CONTRIBUTING.md: replacement maintainer merge authority is missing"
    end
    unless contributing.include?("No separate SHA comment is required.")
      raise PolicyError, "CONTRIBUTING.md: removal of the SHA-comment gate is not documented"
    end
  end

  def run_regression_fixtures!
    [
      "on:\n  pull_request_target:\n    types: [opened]\njobs: {}\n",
      "on: pull_request_target\njobs: {}\n",
      "on: [push, pull_request_target]\njobs: {}\n"
    ].each do |yaml|
      root = Ast.parse_string(yaml)
      unless Ast.event_names(root, "fixture").include?("pull_request_target")
        raise PolicyError, "Regression fixture failed to detect pull_request_target"
      end
    end

    multiline_runner = Ast.parse_string(
      "on: push\njobs:\n  unsafe:\n    runs-on:\n      - self-hosted\n      - linux\n    steps: []\n"
    )
    jobs = Ast.mapping_value(multiline_runner, "jobs", "fixture")
    unsafe_job = Ast.mapping_entries(jobs, "fixture jobs").first.last
    runs_on = Ast.mapping_value(unsafe_job, "runs-on", "fixture job")
    if runs_on.is_a?(Psych::Nodes::Scalar)
      raise PolicyError, "Regression fixture unexpectedly normalized multiline runs-on to a scalar"
    end

    puts "Regression fixtures detected alternate privileged-event and runner syntaxes."
  end
end

begin
  RepositoryPolicy.new.run!
rescue PolicyError, KeyError => e
  warn "ERROR: #{e.message}"
  exit 1
end

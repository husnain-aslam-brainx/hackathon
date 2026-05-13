# frozen_string_literal: true

module BriefPipeline
  # Ordered steps from upload → final tasks. Update `status` as each step ships.
  class Manifest
    Step = Struct.new(:id, :label, :http_method, :path, :status, keyword_init: true)

    STEPS = [
      Step.new(
        id: "validate_upload",
        label: "Accept .docx and verify file (type, size, ZIP signature)",
        http_method: "POST",
        path: "/brief_pipeline/step/validate_upload",
        status: :implemented
      ),
      Step.new(
        id: "parse_document",
        label: "Deterministic DOCX → canonical block JSON (Phase 1)",
        http_method: "POST",
        path: "/brief_pipeline/step/parse_document",
        status: :pending
      ),
      Step.new(
        id: "requirement_slices",
        label: "LLM: requirement slices + JSON Schema validation",
        http_method: "POST",
        path: "/brief_pipeline/step/requirement_slices",
        status: :pending
      ),
      Step.new(
        id: "traceability",
        label: "Deterministic traceability verifier (quotes ↔ blocks)",
        http_method: "POST",
        path: "/brief_pipeline/step/traceability",
        status: :pending
      ),
      Step.new(
        id: "final_tasks",
        label: "LLM: dev-ready tasks (contract TBD)",
        http_method: "POST",
        path: "/brief_pipeline/step/final_tasks",
        status: :pending
      )
    ].freeze

    def self.to_h
      {
        pipeline: "brief_to_tasks",
        schema_version: "brief_pipeline.manifest.v1",
        steps: STEPS.map { |s| step_json(s) }
      }
    end

    def self.step_json(step)
      {
        id: step.id,
        label: step.label,
        http_method: step.http_method,
        path: step.path,
        status: step.status.to_s
      }
    end

    private_class_method :step_json
  end
end

# frozen_string_literal: true

module Contracts
  module Llm
    # Validates LLM output against config/schemas/llm/requirement_slices/v1.json
    class RequirementSlicesValidator
      SCHEMA_VERSION = "llm.requirement_slices.v1"
      SCHEMA_PATH = Rails.root.join("config/schemas/llm/requirement_slices/v1.json")

      class << self
        def schema_path
          SCHEMA_PATH
        end

        def schemer
          @schemer ||= JSONSchemer.schema(Pathname.new(SCHEMA_PATH))
        end

        # @param data [Hash] parsed JSON (symbol keys are coerced to strings)
        # @return [Array<Hash>] human-oriented error hashes: pointer, schema_path, message (best-effort)
        def errors_for(data)
          normalized = stringify_keys(data)
          schemer.validate(normalized).map { |err| normalize_error(err) }
        end

        def valid?(data)
          errors_for(data).empty?
        end

        private

        def stringify_keys(obj)
          case obj
          when Hash
            obj.transform_keys(&:to_s).transform_values { |v| stringify_keys(v) }
          when Array
            obj.map { |v| stringify_keys(v) }
          else
            obj
          end
        end

        def normalize_error(err)
          {
            "data_pointer" => err["data_pointer"],
            "schema_pointer" => err["schema_pointer"],
            "type" => err["type"],
            "details" => err.except("data", "root_schema", "schema")
          }
        end
      end
    end
  end
end

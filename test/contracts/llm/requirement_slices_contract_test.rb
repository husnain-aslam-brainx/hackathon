# frozen_string_literal: true

require "test_helper"

class RequirementSlicesContractTest < ActiveSupport::TestCase
  VALID_FIXTURE = Rails.root.join("test/fixtures/contracts/llm/requirement_slices_valid.json")

  test "schema file exists" do
    assert_path_exists ::Contracts::Llm::RequirementSlicesValidator.schema_path
  end

  test "accepts valid fixture" do
    data = JSON.parse(VALID_FIXTURE.read)
    assert ::Contracts::Llm::RequirementSlicesValidator.valid?(data), lambda {
      ::Contracts::Llm::RequirementSlicesValidator.errors_for(data).inspect
    }
  end

  test "rejects supported slice without evidence" do
    data = JSON.parse(VALID_FIXTURE.read)
    data["slices"][0]["evidence"] = []

    errors = ::Contracts::Llm::RequirementSlicesValidator.errors_for(data)
    assert errors.any?, "expected schema errors, got none"
  end

  test "rejects not_found slice without blocking questions" do
    data = JSON.parse(VALID_FIXTURE.read)
    data["slices"][1]["blocking_questions"] = []

    errors = ::Contracts::Llm::RequirementSlicesValidator.errors_for(data)
    assert errors.any?, "expected schema errors, got none"
  end

  test "rejects wrong schema_version" do
    data = JSON.parse(VALID_FIXTURE.read)
    data["schema_version"] = "wrong"

    errors = ::Contracts::Llm::RequirementSlicesValidator.errors_for(data)
    assert errors.any?
  end

  test "rejects additional root properties" do
    data = JSON.parse(VALID_FIXTURE.read)
    data["extra"] = "nope"

    errors = ::Contracts::Llm::RequirementSlicesValidator.errors_for(data)
    assert errors.any?
  end
end

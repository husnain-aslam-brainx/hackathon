# frozen_string_literal: true

require "test_helper"

class BriefPipelinePipelineIntegrationTest < ActionDispatch::IntegrationTest
  test "GET manifest lists steps with validate_upload implemented" do
    get "/brief_pipeline/manifest"
    assert_response :success
    body = JSON.parse(response.body)
    assert_equal "brief_to_tasks", body["pipeline"]
    assert_kind_of Array, body["steps"]
    validate = body["steps"].find { |s| s["id"] == "validate_upload" }
    assert_equal "implemented", validate["status"]
    assert_equal "POST", validate["http_method"]
    assert_equal "/brief_pipeline/step/validate_upload", validate["path"]

    pending = body["steps"].find { |s| s["id"] == "parse_document" }
    assert_equal "pending", pending["status"]
  end

  test "POST validate_upload accepts a docx-shaped file" do
    io = StringIO.new("PK\x03\x04" + ("Y" * 100))
    tmp = Tempfile.new(["brief", ".docx"])
    tmp.binmode
    tmp.write(io.string.b)
    tmp.rewind

    uploaded = Rack::Test::UploadedFile.new(tmp.path, "application/octet-stream", original_filename: "ClientBrief.docx")

    post "/brief_pipeline/step/validate_upload", params: { document: uploaded }
    assert_response :success
    body = JSON.parse(response.body)
    assert body["ok"]
    assert_equal "validate_upload", body["step_id"]
    assert_equal "ClientBrief.docx", body["data"]["filename"]
  ensure
    tmp.close!
  end

  test "GET brief pipeline UI" do
    get brief_pipeline_root_path
    assert_response :success
    assert_select "form[action=?]", brief_pipeline_upload_path
    assert_select "input[name=document][type=file]"
  end

  test "POST upload verifies docx via HTML form" do
    io = StringIO.new("PK\x03\x04" + ("Y" * 100))
    tmp = Tempfile.new(["brief", ".docx"])
    tmp.binmode
    tmp.write(io.string.b)
    tmp.rewind
    uploaded = Rack::Test::UploadedFile.new(tmp.path, "application/octet-stream", original_filename: "ClientBrief.docx")

    get brief_pipeline_root_path
    assert_response :success
    csrf = css_select('input[name="authenticity_token"]').first
    assert csrf, "expected hidden authenticity_token in form"
    token = csrf["value"]

    post brief_pipeline_upload_path, params: { authenticity_token: token, document: uploaded }
    assert_response :success
    assert_match(/Upload OK/i, response.body)
    assert_match(/ClientBrief\.docx/, response.body)
  ensure
    tmp.close!
  end

  test "POST validate_upload rejects wrong extension" do
    tmp = Tempfile.new(["brief", ".txt"])
    tmp.binmode
    tmp.write("PK\x03\x04")
    tmp.rewind

    uploaded = Rack::Test::UploadedFile.new(tmp.path, "text/plain", original_filename: "brief.txt")

    post "/brief_pipeline/step/validate_upload", params: { document: uploaded }
    assert_response :unprocessable_entity
    body = JSON.parse(response.body)
    assert_not body["ok"]
    assert_kind_of Array, body["errors"]
  ensure
    tmp.close!
  end
end

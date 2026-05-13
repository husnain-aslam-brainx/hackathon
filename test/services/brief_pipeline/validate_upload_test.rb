# frozen_string_literal: true

require "test_helper"

class BriefPipelineValidateUploadTest < ActiveSupport::TestCase
  test "rejects missing file" do
    result = BriefPipeline::ValidateUpload.call(document: nil)
    assert_not result[:ok]
    assert_includes result[:errors].join, "No file"
  end

  test "rejects non-docx extension" do
    io = StringIO.new("PK\x03\x04fakezip")
    doc = ActionDispatch::Http::UploadedFile.new(
      tempfile: tempfile_from_io(io),
      filename: "notes.txt",
      type: "text/plain"
    )
    result = BriefPipeline::ValidateUpload.call(document: doc)
    assert_not result[:ok]
    assert_includes result[:errors].join, ".docx"
  end

  test "rejects docx extension without zip magic" do
    io = StringIO.new("NOTAZIP")
    doc = ActionDispatch::Http::UploadedFile.new(
      tempfile: tempfile_from_io(io),
      filename: "fake.docx",
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    result = BriefPipeline::ValidateUpload.call(document: doc)
    assert_not result[:ok]
    assert_includes result[:errors].join, "PK"
  end

  test "accepts minimal docx-shaped upload" do
    io = StringIO.new("PK\x03\x04" + ("Z" * 500))
    doc = ActionDispatch::Http::UploadedFile.new(
      tempfile: tempfile_from_io(io),
      filename: "Brief.docx",
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    result = BriefPipeline::ValidateUpload.call(document: doc)
    assert result[:ok], result.inspect
    assert_equal "validate_upload", result[:step_id]
    assert_equal "Brief.docx", result[:data][:filename]
    assert result[:data][:byte_size].positive?
  end

  private

  def tempfile_from_io(io)
    tmp = Tempfile.new(["upload", ".bin"])
    tmp.binmode
    tmp.write(io.string.b)
    tmp.rewind
    tmp
  end
end

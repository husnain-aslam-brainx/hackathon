# frozen_string_literal: true

module BriefPipeline
  # Step 1 — no parsing yet: only accept and verify the upload.
  class ValidateUpload
    MAX_BYTES = 15.megabytes
    DOCX_MAGIC = "PK\x03\x04"

    class << self
      # @param document [ActionDispatch::Http::UploadedFile, #read, #original_filename, #size]
      # @return [Hash] { ok:, step_id:, data?: , errors?: }
      def call(document:)
        step_id = "validate_upload"

        if document.blank?
          return failure(step_id, ["No file provided. Use multipart field name: document"])
        end

        filename = document.original_filename.to_s
        unless filename.downcase.end_with?(".docx")
          return failure(step_id, ["File must be a .docx document (got #{filename.inspect})."])
        end

        size = document.size.to_i
        if size <= 0
          return failure(step_id, ["Uploaded file is empty."])
        end

        if size > MAX_BYTES
          return failure(step_id, ["File too large (#{size} bytes). Maximum is #{MAX_BYTES} bytes."])
        end

        head = read_leading_bytes(document, DOCX_MAGIC.bytesize)
        unless head.start_with?(DOCX_MAGIC.b)
          rewind_document(document)
          return failure(
            step_id,
            ["File does not look like a .docx (Office Open XML is a ZIP; expected leading bytes PK)."]
          )
        end

        rewind_document(document)

        success(step_id, {
          filename: filename,
          byte_size: size,
          content_type: document.content_type.to_s.presence || "application/octet-stream"
        })
      end

      private

      def rewind_document(document)
        document.rewind if document.respond_to?(:rewind)
      end

      def read_leading_bytes(document, n)
        rewind_document(document)
        document.read(n).to_s.b
      end

      def success(step_id, data)
        { ok: true, step_id: step_id, data: data }
      end

      def failure(step_id, errors)
        { ok: false, step_id: step_id, errors: errors }
      end
    end
  end
end

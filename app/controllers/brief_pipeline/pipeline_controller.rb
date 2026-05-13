# frozen_string_literal: true

module BriefPipeline
  class PipelineController < BaseController
    # GET /brief_pipeline/manifest
    def manifest
      render json: BriefPipeline::Manifest.to_h
    end

    # POST /brief_pipeline/step/validate_upload  (multipart: document)
    def validate_upload
      result = BriefPipeline::ValidateUpload.call(document: params[:document])
      status = result[:ok] ? :ok : :unprocessable_entity
      render json: result, status: status
    end
  end
end

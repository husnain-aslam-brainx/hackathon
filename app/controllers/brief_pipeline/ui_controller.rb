# frozen_string_literal: true

module BriefPipeline
  # Monolith HTML for the brief pipeline (CSRF-protected forms).
  class UiController < ApplicationController
    def show
      @manifest = BriefPipeline::Manifest.to_h
    end

    def validate
      @manifest = BriefPipeline::Manifest.to_h
      @result = BriefPipeline::ValidateUpload.call(document: params[:document])
      status = @result[:ok] ? :ok : :unprocessable_entity
      render :show, status: status
    end
  end
end

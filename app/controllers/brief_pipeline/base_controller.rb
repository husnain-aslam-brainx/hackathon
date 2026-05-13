# frozen_string_literal: true

module BriefPipeline
  # JSON-only pipeline for incremental verification (curl / Postman / automated tests).
  # Same-origin browser calls should pass the CSRF token; API clients may need
  # skip_forgery_protection narrowed or an API token strategy later.
  class BaseController < ActionController::Base
    skip_forgery_protection

    before_action :ensure_json

    private

    def ensure_json
      request.format = :json unless request.format.json?
    end
  end
end

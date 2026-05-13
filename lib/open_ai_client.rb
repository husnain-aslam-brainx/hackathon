# frozen_string_literal: true

require "json"
require "net/http"
require "uri"

# Thin HTTP client for OpenAI Chat Completions.
#
# Credentials (encrypted): bin/rails credentials:edit
#
#   openai:
#     api_key: sk-...
#     model: gpt-4.1-nano   # optional; defaults to gpt-4.1-nano
#
class OpenAiClient
  class Error < StandardError; end

  DEFAULT_MODEL = "gpt-4.1-nano"
  CHAT_URL = URI("https://api.openai.com/v1/chat/completions")

  def initialize(api_key: nil, model: nil)
    creds = Rails.application.credentials
    @api_key = api_key.presence || creds.dig(:openai, :api_key)
    @model = model.presence || creds.dig(:openai, :model).presence || DEFAULT_MODEL
  end

  # Sends a single user message; returns assistant text content.
  def chat(user_message)
    raise Error, "Configure openai:api_key in Rails credentials (bin/rails credentials:edit)." if @api_key.blank?

    body = {
      model: @model,
      messages: [{ role: "user", content: user_message.to_s }]
    }

    response = perform_post(body)
    parsed = parse_json(response.body)

    unless response.is_a?(Net::HTTPSuccess)
      message = parsed.dig("error", "message") || response.message
      raise Error, message.presence || "OpenAI request failed (#{response.code})."
    end

    content = parsed.dig("choices", 0, "message", "content")
    raise Error, "Empty response from OpenAI." if content.blank?

    content.to_s.strip
  end

  private

  def perform_post(payload)
    http = Net::HTTP.new(CHAT_URL.host, CHAT_URL.port)
    http.use_ssl = true
    http.open_timeout = 15
    http.read_timeout = 120

    request = Net::HTTP::Post.new(CHAT_URL)
    request["Authorization"] = "Bearer #{@api_key}"
    request["Content-Type"] = "application/json"
    request.body = JSON.generate(payload)

    http.request(request)
  end

  def parse_json(raw)
    JSON.parse(raw.to_s)
  rescue JSON::ParserError
    {}
  end
end

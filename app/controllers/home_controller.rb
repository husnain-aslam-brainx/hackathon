class HomeController < ApplicationController
  def index
    @prompt ||= ""
    @feedback ||= nil
    @error ||= nil
  end

  def ask
    @prompt = ask_params[:prompt].to_s.strip

    if @prompt.blank?
      @error = "Please enter a message."
      return render :index, status: :unprocessable_entity, formats: :html
    end

    @feedback = OpenAiClient.new.chat(@prompt)
    render :index, formats: :html
  rescue OpenAiClient::Error => e
    @error = e.message
    render :index, status: :unprocessable_entity, formats: :html
  end

  private

  def ask_params
    params.permit(:prompt, :commit)
  end
end

Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  root "home#index"
  post "ask", to: "home#ask", as: :ask

  # Client brief → tasks pipeline (HTML UI + JSON API for the same steps)
  namespace :brief_pipeline, path: "brief_pipeline" do
    root to: "ui#show"
    post "upload", to: "ui#validate", as: :upload

    get "manifest", to: "pipeline#manifest"
    post "step/validate_upload", to: "pipeline#validate_upload"
  end
end
